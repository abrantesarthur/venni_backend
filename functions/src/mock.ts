import * as functions from "firebase-functions";
import * as firebaseAdmin from "firebase-admin";
import * as uuid from "uuid";
import {
  VehicleInterface,
  PilotInterface,
  PilotStatus,
  TripInterface,
  TripStatus,
  ClientInterface,
} from "./interfaces";
import { getZoneNameFromCoordinate, LatLimit, LngLimit } from "./zones";
import { database, Change, EventContext } from "firebase-functions";
import { sleep, transaction } from "./utils";
import { Client, Language } from "@googlemaps/google-maps-services-js";
import { freePilot } from "./pilots";

// initialize google maps API client
const googleMaps = new Client({});

// returns a random latitude between LatLimit.highest and LatLimit.ninthHighest
export const getRandomLatitude = () => {
  return (
    Math.floor(
      (Math.random() * (LatLimit.highest - LatLimit.ninthHighest) +
        LatLimit.ninthHighest) *
        1000000
    ) / 1000000
  );
};

// returns a random latitude between LngLimit.highest and LngLimit.seventhHighest
export const getRandomLongitude = () => {
  return (
    Math.floor(
      (Math.random() * (LngLimit.highest - LngLimit.seventhHighest) +
        LngLimit.seventhHighest) *
        1000000
    ) / 1000000
  );
};

export const createMockPilots = async (amount: number) => {
  const db = firebaseAdmin.database();
  const storage = firebaseAdmin.storage();
  let defaultVehicle: VehicleInterface = {
    brand: "honda",
    model: "CG-150",
    year: 2020,
    plate: "PTU-2021",
  };
  let now = Date.now();
  // create 'amount' pilots
  for (var i = 0; i < amount; i++) {
    // store database info
    let uid = uuid.v4();
    let pilot = {
      uid: uid,
      name: "Alberto",
      last_name: "Silva",
      total_trips: 142,
      member_since: Date.now(),
      phone_number: "(38) 99999-9999",
      current_client_uid: "",
      current_latitude: getRandomLatitude(),
      current_longitude: getRandomLongitude(),
      status: "available",
      vehicle: defaultVehicle,
      idle_since: now,
      rating: 4.9,
      current_zone: "",
    };

    pilot.current_zone = getZoneNameFromCoordinate(
      pilot.current_latitude,
      pilot.current_longitude
    );
    db.ref("pilots").child(pilot.uid).set(pilot);

    // upload mock profile image
    storage.bucket().upload("./mock-driver.jpg", {
      destination: "pilot-photos/" + uid + "/profile.jpg",
    });
  }
};

const mockTripAccept = async (pilot: PilotInterface) => {
  console.log("mockTripAccept began execution");

  // make sure the pilot's status is requested and trip's current_client_id is set
  if (
    pilot == null ||
    pilot.status != PilotStatus.requested ||
    pilot.current_client_uid == null
  ) {
    console.log("pilot " + pilot.uid + " is no longer requested!");
    return;
  }

  // get a reference to user's trip request
  const tripRequestRef = firebaseAdmin
    .database()
    .ref("trip-requests")
    .child(pilot.current_client_uid);

  // set trip's driver_id in a transaction only if it is null or empty. Otherwise,
  // it means another pilot already picked the trip ahead of us. Throw error in that case.
  tripRequestRef.transaction(
    (tripRequest: TripInterface) => {
      if (tripRequest == null) {
        // we always check for null in transactions.
        return {};
      }

      // if trip has not been picked up by another pilot
      if (tripRequest.driver_id == null || tripRequest.driver_id == "") {
        // set trip's driver_id in a transaction only if it is null or empty.
        tripRequest.driver_id = pilot.uid;
        return tripRequest;
      }

      // otherwise, abort
      return;
    },
    (error, completed, _) => {
      // if transaction failed abnormally
      if (error) {
        console.log(error);
        return;
      }

      // if transaction was aborted
      if (completed == false) {
        // another pilot has already requested the trip, so throw error.
        console.log("another pilot has already picked up the trip");
        return;
      }
      console.log("pilot has succesfully tried to accept the trip!");
    }
  );

  // wait enough time for confirmTrip to run transaction on pilot status
  await sleep(500);

  // wait until pilot's status is set to busy or available by confirmTrip
  let pilotRef = firebaseAdmin.database().ref("pilots").child(pilot.uid);
  let pilotSnapshot = await pilotRef.once("value");
  let updatedPilot = pilotSnapshot.val() as PilotInterface;
  while (
    updatedPilot.status != PilotStatus.busy &&
    updatedPilot.status != PilotStatus.available
  ) {
    await sleep(1);
    pilotSnapshot = await pilotRef.once("value");
    updatedPilot = pilotSnapshot.val() as PilotInterface;
  }

  // if it was set to available, confirmTrip denied trip to the pilot
  if (updatedPilot.status == PilotStatus.available) {
    console.log("trip denied to the pilot");
    return;
  }

  // if it was set busy, confirmTrip indeed granted the trip to the pilot.
  if (updatedPilot.status == PilotStatus.busy) {
    console.log("trip granted trip to the pilot");
    await mockDrivingToClient(updatedPilot as PilotInterface);
    return;
  }
};

const mockDrivingToClient = async (pilot: PilotInterface) => {
  console.log("mockDrivingToClient began execution");
  if (pilot.current_client_uid == null) {
    console.log("mockDrivingToClient couldn't find 'current_client_id'");
    return;
  }

  // get pilot's current coordinates
  let pilotCoordinates = {
    lat: pilot.current_latitude,
    lng: pilot.current_longitude,
  };

  // get trip request reference
  const tripRequestRef = firebaseAdmin
    .database()
    .ref("trip-requests")
    .child(pilot.current_client_uid);
  let tripRequestSnapshot = await tripRequestRef.once("value");
  if (tripRequestSnapshot.val() == null) {
    console.log("mockDrivingToClient couldn't find trip-request");
    return;
  }
  let tripRequest = tripRequestSnapshot.val() as TripInterface;

  // get trip origin's place ID
  let originPlaceID = tripRequest.origin_place_id;

  // send request to google directions api
  let directionsResponse;
  try {
    directionsResponse = await googleMaps.directions({
      params: {
        key: functions.config().googleapi.key,
        origin: pilotCoordinates,
        destination: "place_id:" + originPlaceID,
        language: Language.pt_BR,
      },
    });
  } catch (e) {
    console.log(
      "mockDrivingToClient failed to request directions from pilot to client"
    );
    return;
  }

  // get reference to pilot's entry in the database
  const pilotRef = firebaseAdmin.database().ref("pilots").child(pilot.uid);

  // iterate over response updating pilot's coordiantes every 1 second
  const steps = directionsResponse.data.routes[0].legs[0].steps;
  for (var i = 0; i < steps.length; i++) {
    pilotRef.transaction((pilot) => {
      if (pilot == null) {
        return {};
      }
      pilot.current_latitude = steps[i].start_location.lat;
      pilot.current_longitude = steps[i].start_location.lng;
      return pilot;
    });
    await sleep(1000);
  }
  pilotRef.transaction((pilot) => {
    if (pilot == null) {
      return {};
    }
    pilot.current_latitude = steps[steps.length - 1].end_location.lat;
    pilot.current_longitude = steps[steps.length - 1].end_location.lng;
    return pilot;
  });

  // after arriving to trip's origin, wait 1 seconds before starting trip
  await sleep(1000);

  // get pilot's updated coordinates
  let pilotSnapshot = await pilotRef.once("value");
  if (pilotSnapshot.val() == null) {
    console.log("failed to retrieve pilot from database before starting trip.");
    return;
  }
  pilot = pilotSnapshot.val() as PilotInterface;

  // start trip
  await mockTripStart(pilot);
};

const mockTripStart = async (pilot: PilotInterface) => {
  console.log("mockTripStart began execution");

  // make sure the pilot's status is busy and trip's current_client_id is set
  if (
    pilot == null ||
    pilot.status != PilotStatus.busy ||
    pilot.current_client_uid == null
  ) {
    console.log("pilot " + pilot.uid + " is not busy!");
    return;
  }

  // get a reference to user's trip request
  const tripRequestRef = firebaseAdmin
    .database()
    .ref("trip-requests")
    .child(pilot.current_client_uid);

  // update trip's status in a transaction only if is waiting for our driver.
  tripRequestRef.transaction(
    (tripRequest: TripInterface) => {
      if (tripRequest == null) {
        // we always check for null in transactions.
        return {};
      }

      // if trip is waiting for our driver
      if (
        tripRequest.trip_status == "waiting-driver" &&
        tripRequest.driver_id == pilot.uid
      ) {
        // set trip's status to inProgress
        tripRequest.trip_status = TripStatus.inProgress;
        return tripRequest;
      }

      // otherwise, abort
      return;
    },
    (error, completed, _) => {
      // if transaction failed abnormally
      if (error) {
        console.log(error);
        return;
      }

      // if transaction was aborted
      if (completed == false) {
        // another pilot has already requested the trip, so throw error.
        console.log("trip is not waiting for pilot " + pilot.uid);
        return;
      }
      console.log("pilot has succesfully started the trip!");
    }
  );

  let pilotRef = firebaseAdmin.database().ref("pilots").child(pilot.uid);
  let pilotSnapshot = await pilotRef.once("value");
  if (pilotSnapshot.val() == null) {
    console.log("mockTripStart failed to retrieve pilot from database");
    return;
  }
  pilot = pilotSnapshot.val() as PilotInterface;

  // after accepting trip, wait 1 seconds before driving to destination
  await sleep(1000);

  await mockDriveToDestination(pilot);
};

const mockDriveToDestination = async (pilot: PilotInterface) => {
  console.log("mockDriveToDestination began execution");
  if (pilot.current_client_uid == null) {
    console.log("mockDriveToDestination couldn't find 'current_client_id'");
    return;
  }

  // get pilot's current coordinates
  let pilotCoordinates = {
    lat: pilot.current_latitude,
    lng: pilot.current_longitude,
  };

  // get trip request reference
  const tripRequestRef = firebaseAdmin
    .database()
    .ref("trip-requests")
    .child(pilot.current_client_uid);
  let tripRequestSnapshot = await tripRequestRef.once("value");
  if (tripRequestSnapshot.val() == null) {
    console.log("mockDriveToDestination couldn't find trip-request");
    return;
  }
  let tripRequest = tripRequestSnapshot.val() as TripInterface;

  // get trip destination's place id
  let destinationPlaceID = tripRequest.destination_place_id;

  // send request to google directions api
  let directionsResponse;
  try {
    directionsResponse = await googleMaps.directions({
      params: {
        key: functions.config().googleapi.key,
        origin: pilotCoordinates,
        destination: "place_id:" + destinationPlaceID,
        language: Language.pt_BR,
      },
    });
  } catch (e) {
    console.log(
      "mockTripStart failed to request directions from pilot to client"
    );
    return;
  }

  // get reference to pilot's entry in the database
  const pilotRef = firebaseAdmin.database().ref("pilots").child(pilot.uid);

  // iterate over directions response updating pilot's coordiantes every 1 second
  const steps = directionsResponse.data.routes[0].legs[0].steps;
  for (var i = 0; i < steps.length; i++) {
    await transaction(pilotRef, (pilot) => {
      if (pilot == null) {
        return {};
      }
      pilot.current_latitude = steps[i].start_location.lat;
      pilot.current_longitude = steps[i].start_location.lng;
      return pilot;
    });
    await sleep(1000);
  }
  await transaction(pilotRef, (pilot) => {
    if (pilot == null) {
      return {};
    }
    pilot.current_latitude = steps[steps.length - 1].end_location.lat;
    pilot.current_longitude = steps[steps.length - 1].end_location.lng;
    return pilot;
  });

  await mockTripComplete(pilot);
};

const mockTripComplete = async (pilot: PilotInterface) => {
  console.log("mockTripComplete began execution");

  // make sure the pilot's status is busy and trip's current_client_id is set
  if (
    pilot == null ||
    pilot.status != PilotStatus.busy ||
    pilot.current_client_uid == null
  ) {
    console.log("pilot " + pilot.uid + " is not busy!");
    return;
  }

  // get a reference to user's trip request
  const tripRequestRef = firebaseAdmin
    .database()
    .ref("trip-requests")
    .child(pilot.current_client_uid);

  // set trip's status to completed only if it is being handled by our driver
  await transaction(
    tripRequestRef,
    (tripRequest: TripInterface) => {
      if (tripRequest == null) {
        // we always check for null in transactions.
        return {};
      }

      // if trip is waiting for our driver
      if (
        tripRequest.trip_status == "in-progress" &&
        tripRequest.driver_id == pilot.uid
      ) {
        // set trip's status to completed
        tripRequest.trip_status = TripStatus.completed;
        return tripRequest;
      }

      // otherwise, abort
      return;
    },
    async (error, completed, _) => {
      // if transaction failed abnormally
      if (error) {
        console.log(error);
        return;
      }

      // if transaction was aborted
      if (completed == false) {
        // another pilot was handling  the trip, so throw error.
        console.log("trip is not being handled by pilot " + pilot.uid);
        return;
      }
      console.log("pilot has succesfully completed the trip!");

      // free the pilot to handle other trips
      await freePilot(pilot.uid, true);

      // update client's data
      if (pilot.current_client_uid != undefined) {
        const clientRef = firebaseAdmin
          .database()
          .ref("clients")
          .child(pilot.current_client_uid);
        let clientSnapshot = await clientRef.once("value");
        let client = clientSnapshot.val() as ClientInterface;
        let totalTrips =
          client.total_trips == undefined ? 1 : client.total_trips + 1;
        let totalRating =
          client.total_rating == undefined ? 5 : client.total_rating + 5;
        await clientRef.child("total_trips").set(totalTrips);
        await clientRef.child("total_rating").set(totalRating);
        await clientRef.child("rating").set(totalRating / totalTrips);
        await clientRef.child("past_trips").push({ mock_trip: "mock_trip" });
      }
    }
  );
};

// mock driver behaves as a driver accepting a trip request would behave
// TODO: delete on production
export const pilot_accepting_trip = database
  .ref("pilots/{pilotID}")
  .onUpdate(
    async (change: Change<database.DataSnapshot>, context: EventContext) => {
      // make sure the status changed to requested and current_client_id did too
      let pilot = change.after.val();
      await mockTripAccept(pilot as PilotInterface);
    }
  );
