import * as functions from "firebase-functions";
import * as firebaseAdmin from "firebase-admin";
import * as uuid from "uuid";
import { Pilot } from "./database/pilot";
import { TripRequest } from "./database/tripRequest";
import { Client } from "./database/client";
import { getZoneNameFromCoordinate, LatLimit, LngLimit } from "./zones";
import { database, Change, EventContext } from "firebase-functions";
import { sleep } from "./utils";
import {
  Client as GoogleMapsClient,
  Language,
} from "@googlemaps/google-maps-services-js";
import { transaction } from "./database";

// initialize google maps API client
const googleMaps = new GoogleMapsClient({});

// returns a random latitude between LatLimit.highest and LatLimit.ninthHighest
export const getRandomLatitude = () => {
  return (
    Math.floor(
      (Math.random() * (LatLimit.highest - LatLimit.ninthHighest) +
        LatLimit.ninthHighest) *
        1000000
    ) / 1000000
  ).toString();
};

// returns a random latitude between LngLimit.highest and LngLimit.seventhHighest
export const getRandomLongitude = () => {
  return (
    Math.floor(
      (Math.random() * (LngLimit.highest - LngLimit.seventhHighest) +
        LngLimit.seventhHighest) *
        1000000
    ) / 1000000
  ).toString();
};

export const createMockPilots = async (amount: number) => {
  const db = firebaseAdmin.database();
  const storage = firebaseAdmin.storage();
  let defaultVehicle: Pilot.VehicleInterface = {
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
      total_trips: "142",
      member_since: Date.now().toString(),
      phone_number: "(38) 99999-9999",
      current_client_uid: "",
      current_latitude: getRandomLatitude(),
      current_longitude: getRandomLongitude(),
      status: "available",
      vehicle: defaultVehicle,
      idle_since: now.toString(),
      rating: "4.9",
      current_zone: "",
    };

    pilot.current_zone = getZoneNameFromCoordinate(
      Number(pilot.current_latitude),
      Number(pilot.current_longitude)
    );
    db.ref("pilots").child(pilot.uid).set(pilot);

    // upload mock profile image
    storage.bucket().upload("./mock-pilot.jpg", {
      destination: "pilot-photos/" + uid + "/profile.jpg",
    });
  }
};

const mockTripAccept = async (pilot: Pilot.Interface) => {
  console.log("mockTripAccept began execution");

  // make sure the pilot's status is requested and trip's current_client_id is set
  if (
    pilot == null ||
    pilot.status != Pilot.Status.requested ||
    pilot.current_client_uid == null
  ) {
    console.log("pilot " + pilot.uid + " is no longer requested!");
    return;
  }

  // get a reference to user's trip request
  const tr = new TripRequest(pilot.current_client_uid);

  // set trip's pilot_id in a transaction only if it is null or empty. Otherwise,
  // it means another pilot already picked the trip ahead of us. Throw error in that case.
  await transaction(
    tr.ref,
    (tripRequest: TripRequest.Interface) => {
      if (tripRequest == null) {
        // we always check for null in transactions.
        return {};
      }

      // if trip has not been picked up by another pilot
      if (tripRequest.pilot_id == null || tripRequest.pilot_id == "") {
        // set trip's pilot_id in a transaction only if it is null or empty.
        tripRequest.pilot_id = pilot.uid;
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

  // TODO: may be abel to delete this
  // wait enough time for confirmTrip to run transaction on pilot status
  await sleep(500);

  // wait until pilot's status is set to busy or available by confirmTrip
  const p = new Pilot(pilot.uid);
  let updatedPilot = await p.getPilot();
  while (
    updatedPilot?.status != Pilot.Status.busy &&
    updatedPilot?.status != Pilot.Status.available
  ) {
    await sleep(1);
    updatedPilot = await p.getPilot();
  }

  // if it was set to available, confirmTrip denied trip to the pilot
  if (updatedPilot.status == Pilot.Status.available) {
    console.log("trip denied to the pilot");
    return;
  }

  // if it was set busy, confirmTrip indeed granted the trip to the pilot.
  if (updatedPilot.status == Pilot.Status.busy) {
    console.log("trip granted trip to the pilot");
    await mockDrivingToClient(updatedPilot as Pilot.Interface);
    return;
  }
};

const mockDrivingToClient = async (pilot: Pilot.Interface) => {
  console.log("mockDrivingToClient began execution");
  if (pilot.current_client_uid == null) {
    console.log("mockDrivingToClient couldn't find 'current_client_id'");
    return;
  }

  // get pilot's current coordinates
  let pilotCoordinates = {
    lat: Number(pilot.current_latitude),
    lng: Number(pilot.current_longitude),
  };

  // get trip request reference
  const tr = new TripRequest(pilot.current_client_uid);
  const tripRequest = await tr.getTripRequest();
  if (tripRequest == null || tripRequest == undefined) {
    console.log("mockDrivingToClient couldn't find trip-request");
    return;
  }

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
  const p = new Pilot(pilot.uid);

  // iterate over response updating pilot's coordiantes every 1 second
  const steps = directionsResponse.data.routes[0].legs[0].steps;
  for (var i = 0; i < steps.length; i++) {
    await transaction(p.ref, (pilot) => {
      if (pilot == null) {
        return {};
      }
      pilot.current_latitude = steps[i].start_location.lat.toString();
      pilot.current_longitude = steps[i].start_location.lng.toString();
      return pilot;
    });
    await sleep(500);
  }
  await transaction(p.ref, (pilot) => {
    if (pilot == null) {
      return {};
    }
    pilot.current_latitude = steps[
      steps.length - 1
    ].end_location.lat.toString();
    pilot.current_longitude = steps[
      steps.length - 1
    ].end_location.lng.toString();
    return pilot;
  });

  // after arriving to trip's origin, wait 0.5 second before starting trip
  await sleep(500);

  // get pilot's updated coordinates
  let updatedPilot = await p.getPilot();
  if (updatedPilot == undefined) {
    console.log("failed to retrieve pilot from database before starting trip.");
    return;
  }

  // start trip
  await mockTripStart(updatedPilot);
};

const mockTripStart = async (pilot: Pilot.Interface) => {
  console.log("mockTripStart began execution");

  // make sure the pilot's status is busy and trip's current_client_id is set
  if (
    pilot == null ||
    pilot.status != Pilot.Status.busy ||
    pilot.current_client_uid == null
  ) {
    console.log("pilot " + pilot.uid + " is not busy!");
    return;
  }

  // get a reference to user's trip request
  const tr = new TripRequest(pilot.current_client_uid);

  // update trip's status in a transaction only if is waiting for our pilot.
  await transaction(
    tr.ref,
    (tripRequest: TripRequest.Interface) => {
      if (tripRequest == null) {
        // we always check for null in transactions.
        return {};
      }

      // if trip is waiting for our pilot
      if (
        tripRequest.trip_status == "waiting-pilot" &&
        tripRequest.pilot_id == pilot.uid
      ) {
        // set trip's status to inProgress
        tripRequest.trip_status = TripRequest.Status.inProgress;
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

  const p = new Pilot(pilot.uid);
  let updatedPilot = await p.getPilot();
  if (updatedPilot == null) {
    console.log("mockTripStart failed to retrieve pilot from database");
    return;
  }

  // after accepting trip, wait 0.5 seconds before driving to destination
  await sleep(500);

  await mockDriveToDestination(updatedPilot);
};

const mockDriveToDestination = async (pilot: Pilot.Interface) => {
  console.log("mockDriveToDestination began execution");
  if (pilot.current_client_uid == null) {
    console.log("mockDriveToDestination couldn't find 'current_client_id'");
    return;
  }

  // get pilot's current coordinates
  let pilotCoordinates = {
    lat: Number(pilot.current_latitude),
    lng: Number(pilot.current_longitude),
  };

  // get trip request reference
  const tr = new TripRequest(pilot.current_client_uid);
  let tripRequest = await tr.getTripRequest();
  if (tripRequest == null || tripRequest == undefined) {
    console.log("mockDriveToDestination couldn't find trip-request");
    return;
  }

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
  const p = new Pilot(pilot.uid);

  // iterate over directions response updating pilot's coordiantes every 1 second
  const steps = directionsResponse.data.routes[0].legs[0].steps;
  for (var i = 0; i < steps.length; i++) {
    await transaction(p.ref, (pilot) => {
      if (pilot == null) {
        return {};
      }
      pilot.current_latitude = steps[i].start_location.lat.toString();
      pilot.current_longitude = steps[i].start_location.lng.toString();
      return pilot;
    });
    await sleep(500);
  }
  await transaction(p.ref, (pilot) => {
    if (pilot == null) {
      return {};
    }
    pilot.current_latitude = steps[
      steps.length - 1
    ].end_location.lat.toString();
    pilot.current_longitude = steps[
      steps.length - 1
    ].end_location.lng.toString();
    return pilot;
  });

  // wait 0.5 seconds before completing the trip
  await sleep(500);
  await mockTripComplete(pilot.uid);
};

const mockTripComplete = async (pilotID: string) => {
  console.log("mockTripComplete began execution");

  // make sure the pilot's status is busy and trip's current_client_id is set
  const p = new Pilot(pilotID);
  let pilot = await p.getPilot();
  if (
    pilot == null ||
    pilot.status != Pilot.Status.busy ||
    pilot.current_client_uid == null
  ) {
    console.log("pilot " + pilotID + " is not busy!");
    return;
  }

  // make sure the pilot is handling an inProgress trip for some client
  const clientID = pilot.current_client_uid;
  const tr = new TripRequest(clientID);
  let trip = await tr.getTripRequest();
  if (trip == null) {
    throw new functions.https.HttpsError(
      "not-found",
      "There is no trip request being handled by the pilot '" + pilotID + "'"
      // TODO: change message to include clientID
    );
  } else if (trip.trip_status != "in-progress") {
    // it was aborted because trip is not in valid in-progress status
    throw new functions.https.HttpsError(
      "failed-precondition",
      "cannot complete trip in status '" + trip.trip_status + "'"
    );
  } else if (trip.pilot_id != pilotID) {
    // it was aborted because it is not being handled by our pilot_id
    throw new functions.https.HttpsError(
      "failed-precondition",
      "pilot has not been designated to this trip"
    );
  }

  // free the pilot to handle other trips
  await p.free();

  // add trip with completed status to pilot's list of past trips
  trip.trip_status = TripRequest.Status.completed;
  let pastTripRefKey = await p.pushPastTrip(trip);

  // save past trip's reference key in trip request's pilot_past_trip_ref_key
  // this is so the client can retrieve it later when rating the pilot
  await transaction(tr.ref, (tripRequest: TripRequest.Interface) => {
    if (tripRequest == null) {
      return {};
    }
    if (pastTripRefKey != null) {
      tripRequest.pilot_past_trip_ref_key = pastTripRefKey;
    }
    return tripRequest;
  });

  // make sure there exists a client entry
  const c = new Client(clientID);
  let client = await c.getClient();
  if (client == null || client == undefined) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "there exists no client with id '" + clientID + "'"
    );
  }

  // save trip to client's list of past trips and rate client
  // we are hardcoding the rate, but in real example the pilot
  // passes it by argument
  if(pastTripRefKey != null) {
    trip.pilot_past_trip_ref_key = pastTripRefKey;
  }
  await c.pushPastTripAndRate(trip, 4);

  // set trip's status to completed only if it is being handled by our pilot
  await transaction(tr.ref, (tripRequest: TripRequest.Interface) => {
    if (tripRequest == null) {
      // we always check for null in transactions.
      return {};
    }
    // set trip's status to completed
    tripRequest.trip_status = TripRequest.Status.completed;
    return tripRequest;
  });
};

// mock pilot behaves as a pilot accepting a trip request would behave
// TODO: delete on production
export const pilot_handling_trip = database
  .ref("pilots/{pilotID}")
  .onUpdate(
    async (change: Change<database.DataSnapshot>, context: EventContext) => {
      // make sure the status changed to requested and current_client_id did too
      let pilot = change.after.val();
      await mockTripAccept(pilot as Pilot.Interface);
    }
  );
