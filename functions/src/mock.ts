import * as functions from "firebase-functions";
import * as firebaseAdmin from "firebase-admin";
import * as uuid from "uuid";
import { Partner } from "./database/partner";
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
import { Pagarme } from "./vendors/pagarme";

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

export const createMockPartners = async (amount: number) => {
  const db = firebaseAdmin.database();
  const storage = firebaseAdmin.storage();
  let defaultVehicle: Partner.Vehicle = {
    brand: "honda",
    model: "CG-150",
    year: 2020,
    plate: "PTU-2021",
  };
  let now = Date.now();
  // create 'amount' partners
  for (var i = 0; i < amount; i++) {
    // store database info
    let uid = uuid.v4();
    let partner = {
      uid: uid,
      pagarme_recipient_id: "re_cko91zvv600b60i9tv2qvf24o", // everyboyd uses same test receiver ID for now
      name: "Alberto",
      last_name: "Silva",
      cpf: "00000000000",
      gender: "masculino",
      account_status: "approved",
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

    partner.current_zone = getZoneNameFromCoordinate(
      Number(partner.current_latitude),
      Number(partner.current_longitude)
    );
    db.ref("partners").child(partner.uid).set(partner);

    // upload mock profile image
    storage.bucket().upload("./mock-partner.jpg", {
      destination: "partner-photos/" + uid + "/profile.jpg",
    });
  }
};

const mockTripAccept = async (partner: Partner.Interface) => {
  console.log("mockTripAccept began execution");

  // make sure the partner's status is requested and trip's current_client_id is set
  if (
    partner == null ||
    partner.status != Partner.Status.requested ||
    partner.current_client_uid == null
  ) {
    console.log("partner " + partner.uid + " is no longer requested!");
    return;
  }

  // get a reference to user's trip request
  const tr = new TripRequest(partner.current_client_uid);

  // set trip's partner_id in a transaction only if it is null or empty. Otherwise,
  // it means another partner already picked the trip ahead of us. Throw error in that case.
  await transaction(
    tr.ref,
    (tripRequest: TripRequest.Interface) => {
      if (tripRequest == null) {
        // we always check for null in transactions.
        return {};
      }

      // if trip has not been picked up by another partner
      if (tripRequest.partner_id == null || tripRequest.partner_id == "") {
        // set trip's partner_id in a transaction only if it is null or empty.
        tripRequest.partner_id = partner.uid;
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
        // another partner has already requested the trip, so throw error.
        console.log("another partner has already picked up the trip");
        return;
      }
      console.log("partner has succesfully tried to accept the trip!");
    }
  );

  // TODO: may be abel to delete this
  // wait enough time for confirmTrip to run transaction on partner status
  await sleep(500);

  // wait until partner's status is set to busy or available by confirmTrip
  const p = new Partner(partner.uid);
  let updatedPartner = await p.getPartner();
  while (
    updatedPartner?.status != Partner.Status.busy &&
    updatedPartner?.status != Partner.Status.available
  ) {
    await sleep(20);
    updatedPartner = await p.getPartner();
  }

  // if it was set to available, confirmTrip denied trip to the partner
  if (updatedPartner.status == Partner.Status.available) {
    console.log("trip denied to the partner");
    return;
  }

  // if it was set busy, confirmTrip indeed granted the trip to the partner.
  if (updatedPartner.status == Partner.Status.busy) {
    console.log("trip granted trip to the partner");
    await mockDrivingToClient(updatedPartner as Partner.Interface);
    return;
  }
};

const mockDrivingToClient = async (partner: Partner.Interface) => {
  console.log("mockDrivingToClient began execution");
  if (partner.current_client_uid == null) {
    console.log("mockDrivingToClient couldn't find 'current_client_id'");
    return;
  }

  // get partner's current coordinates
  let partnerCoordinates = {
    lat: Number(partner.current_latitude),
    lng: Number(partner.current_longitude),
  };

  // get trip request reference
  const tr = new TripRequest(partner.current_client_uid);
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
        origin: partnerCoordinates,
        destination: "place_id:" + originPlaceID,
        language: Language.pt_BR,
      },
    });
  } catch (e) {
    console.log(
      "mockDrivingToClient failed to request directions from partner to client"
    );
    return;
  }

  // get reference to partner's entry in the database
  const p = new Partner(partner.uid);

  // iterate over response updating partner's coordiantes every 1 second
  const steps = directionsResponse.data.routes[0].legs[0].steps;
  for (var i = 0; i < steps.length; i++) {
    await transaction(p.ref, (partner) => {
      if (partner == null) {
        return {};
      }
      partner.current_latitude = steps[i].start_location.lat.toString();
      partner.current_longitude = steps[i].start_location.lng.toString();
      return partner;
    });
    await sleep(1000);
  }
  await transaction(p.ref, (partner) => {
    if (partner == null) {
      return {};
    }
    partner.current_latitude =
      steps[steps.length - 1].end_location.lat.toString();
    partner.current_longitude =
      steps[steps.length - 1].end_location.lng.toString();
    return partner;
  });

  // after arriving to trip's origin, wait 0.5 second before starting trip
  await sleep(4000);

  // get partner's updated coordinates
  let updatedPartner = await p.getPartner();
  if (updatedPartner == undefined) {
    console.log(
      "failed to retrieve partner from database before starting trip."
    );
    return;
  }

  // start trip
  await mockTripStart(updatedPartner);
};

const mockTripStart = async (partner: Partner.Interface) => {
  console.log("mockTripStart began execution");

  // make sure the partner's status is busy and trip's current_client_id is set
  if (
    partner == null ||
    partner.status != Partner.Status.busy ||
    partner.current_client_uid == null
  ) {
    console.log("partner " + partner.uid + " is not busy!");
    return;
  }

  // get a reference to user's trip request
  const tr = new TripRequest(partner.current_client_uid);

  // update trip's status in a transaction only if is waiting for our partner.
  await transaction(
    tr.ref,
    (tripRequest: TripRequest.Interface) => {
      if (tripRequest == null) {
        // we always check for null in transactions.
        return {};
      }

      // if trip is waiting for our partner
      if (
        tripRequest.trip_status == "waiting-partner" &&
        tripRequest.partner_id == partner.uid
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
        // another partner has already requested the trip, so throw error.
        console.log("trip is not waiting for partner " + partner.uid);
        return;
      }
      console.log("partner has succesfully started the trip!");
    }
  );

  const p = new Partner(partner.uid);
  let updatedPartner = await p.getPartner();
  if (updatedPartner == null) {
    console.log("mockTripStart failed to retrieve partner from database");
    return;
  }

  // after accepting trip, wait 0.5 seconds before driving to destination
  await sleep(500);

  await mockDriveToDestination(updatedPartner);
};

const mockDriveToDestination = async (partner: Partner.Interface) => {
  console.log("mockDriveToDestination began execution");
  if (partner.current_client_uid == null) {
    console.log("mockDriveToDestination couldn't find 'current_client_id'");
    return;
  }

  // get partner's current coordinates
  let partnerCoordinates = {
    lat: Number(partner.current_latitude),
    lng: Number(partner.current_longitude),
  };

  // get trip request reference
  const tr = new TripRequest(partner.current_client_uid);
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
        origin: partnerCoordinates,
        destination: "place_id:" + destinationPlaceID,
        language: Language.pt_BR,
      },
    });
  } catch (e) {
    console.log(
      "mockTripStart failed to request directions from partner to client"
    );
    return;
  }

  // get reference to partner's entry in the database
  const p = new Partner(partner.uid);

  // iterate over directions response updating partner's coordiantes every 1 second
  const steps = directionsResponse.data.routes[0].legs[0].steps;
  for (var i = 0; i < steps.length; i++) {
    await transaction(p.ref, (partner) => {
      if (partner == null) {
        return {};
      }
      partner.current_latitude = steps[i].start_location.lat.toString();
      partner.current_longitude = steps[i].start_location.lng.toString();
      return partner;
    });
    await sleep(1000);
  }
  await transaction(p.ref, (partner) => {
    if (partner == null) {
      return {};
    }
    partner.current_latitude =
      steps[steps.length - 1].end_location.lat.toString();
    partner.current_longitude =
      steps[steps.length - 1].end_location.lng.toString();
    return partner;
  });

  // wait 0.5 seconds before completing the trip
  await sleep(3000);
  await mockTripComplete(partner.uid);
};

const mockTripComplete = async (partnerID: string) => {
  console.log("mockTripComplete began execution");

  // make sure the partner's status is busy and trip's current_client_id is set
  const p = new Partner(partnerID);
  let partner = await p.getPartner();
  if (
    partner == null ||
    partner.status != Partner.Status.busy ||
    partner.current_client_uid == null
  ) {
    console.log("partner " + partnerID + " is not busy!");
    return;
  }

  // make sure the partner is handling an inProgress trip for some client
  const clientID = partner.current_client_uid;
  const tr = new TripRequest(clientID);
  let trip = await tr.getTripRequest();
  if (trip == null) {
    throw new functions.https.HttpsError(
      "not-found",
      "There is no trip request being handled by the partner '" +
        partnerID +
        "'"
      // TODO: change message to include clientID
    );
  } else if (trip.trip_status != "in-progress") {
    // it was aborted because trip is not in valid in-progress status
    throw new functions.https.HttpsError(
      "failed-precondition",
      "cannot complete trip in status '" + trip.trip_status + "'"
    );
  } else if (trip.partner_id != partnerID) {
    // it was aborted because it is not being handled by our partner_id
    throw new functions.https.HttpsError(
      "failed-precondition",
      "partner has not been designated to this trip"
    );
  }

  // variable that will tell us whether capture succeeded
  let captureSucceeded = true;
  // variable that will hold how much to discount from partner's receivables
  let partnerReceivableDiscount;
  // if payment is through credit card
  if (
    trip.payment_method == "credit_card" &&
    trip.transaction_id != undefined
  ) {
    let amountOwed = await p.getOwedCommission();
    let venniAmount;
    // if partner owes us money
    if (amountOwed != null && amountOwed > 0) {
      // decrease what partner receives by the rounded minimum between
      // 80% of fare price and what he owes us
      partnerReceivableDiscount = Math.ceil(
        Math.min(0.8 * trip.fare_price, amountOwed)
      );

      // venni should receive 20% + whatever was discounted from the partner.
      // we calculate Math.min here just to guarantee that client won't pay more than
      // trip.fare_price
      venniAmount = Math.floor(
        Math.min(
          trip.fare_price,
          0.2 * trip.fare_price + partnerReceivableDiscount
        )
      );
    }

    // try to capture transaction, setting 'captureSucceeded' to false if it fails
    const pagarme = new Pagarme();
    await pagarme.ensureInitialized();
    try {
      let transaction = await pagarme.captureTransaction(
        trip.transaction_id,
        trip.fare_price,
        partner.pagarme_recipient_id,
        venniAmount
      );
      if (transaction.status != "paid") {
        captureSucceeded = false;
      }
    } catch (e) {
      captureSucceeded = false;
    }
  } else {
    // if payment is cash, increase amount partner owes venni by 20% of fare price
    await p.increaseAmountOwedBy(Math.ceil(0.2 * trip.fare_price));
  }

  if (captureSucceeded && partnerReceivableDiscount != undefined) {
    // if capture succeeded and the partner paid some amount he owed us, decrease amount owed
    await p.decreaseAmountOwedBy(partnerReceivableDiscount);
  }

  // free the partner to handle other trips
  await p.free();

  // add trip with completed status to partner's list of past trips
  trip.trip_status = TripRequest.Status.completed;
  let partnerPastTripRefKey = await p.pushPastTrip(trip);

  // save past trip's reference key in trip request's partner_past_trip_ref_key
  // this is so the client can retrieve it later when rating the partner
  await transaction(tr.ref, (tripRequest: TripRequest.Interface) => {
    if (tripRequest == null) {
      return {};
    }
    if (partnerPastTripRefKey != null) {
      tripRequest.partner_past_trip_ref_key = partnerPastTripRefKey;
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
  // we are hardcoding the rate, but in real example the partner
  // passes it by argument
  if (partnerPastTripRefKey != null) {
    trip.partner_past_trip_ref_key = partnerPastTripRefKey;
  }
  let clientPastTripRefKey = await c.pushPastTripAndRate(trip, 4);
  // if credit card payment failed
  if (!captureSucceeded && clientPastTripRefKey != null) {
    // flag customer as owing us money
    await c.setUnpaidTrip(clientPastTripRefKey);
  }

  // set trip's status to completed in a transaction
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

// mock partner behaves as a partner accepting a trip request would behave
// TODO: delete on production
export const partner_handling_trip = database
  .ref("partners/{partnerID}")
  .onUpdate(
    async (change: Change<database.DataSnapshot>, context: EventContext) => {
      // make sure the status changed to requested and current_client_id did too
      let partner = change.after.val();
      await mockTripAccept(partner as Partner.Interface);
    }
  );
