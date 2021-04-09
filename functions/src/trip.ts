import * as functions from "firebase-functions";
import * as firebaseAdmin from "firebase-admin";
import { findPilots } from "./pilots";
import { calculateFare } from "./fare";
import { Client, Language } from "@googlemaps/google-maps-services-js";
import { StandardError, treatDirectionsError } from "./errors";
import { HttpsError } from "firebase-functions/lib/providers/https";
import { getZoneNameFromCoordinate } from "./zones";
import {
  RequestTripInterface,
  TripInterface,
  TripStatus,
  PilotInterface,
  PilotStatus,
} from "./interfaces";

// initialize google maps API client
const googleMaps = new Client({});

function validateRequest(obj: any) {
  if (
    !(typeof obj.origin_place_id === "string") ||
    obj.origin_place_id.length === 0
  ) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "argument origin_place_id must be a string with length greater than 0."
    );
  }

  if (
    !(typeof obj.destination_place_id === "string") ||
    obj.destination_place_id.length === 0
  ) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "argument destination_place_id must be a string with length greater than 0."
    );
  }

  // if destination_place_id and origin_place_id are the same, return REQUEST_DENIED
  if (obj.origin_place_id === obj.destination_place_id) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "destination_place_id and origin_place_id are the same."
    );
  }
}

// TODO: only accept requests departing from Paracatu
const requestTrip = async (
  data: any,
  context: functions.https.CallableContext
) => {
  // validate authentication and request
  if (context.auth == null) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "Missing authentication credentials."
    );
  }
  validateRequest(data);

  // define the db
  const db = firebaseAdmin.database();

  // type cast data
  const body = data as RequestTripInterface;

  // get a reference to user's trip request
  const tripRequestRef = db.ref("trip-requests").child(context.auth?.uid);

  // request directions API for further route information
  let directionsResponse;
  try {
    directionsResponse = await googleMaps.directions({
      params: {
        key: functions.config().googleapi.key,
        origin: "place_id:" + body.origin_place_id,
        destination: "place_id:" + body.destination_place_id,
        language: Language.pt_BR,
      },
    });
  } catch (e) {
    const error: StandardError = treatDirectionsError(e);
    throw new functions.https.HttpsError(error.code, error.message);
  }

  // create a trip request entry in the database
  const route = directionsResponse.data.routes[0];
  const leg = route.legs[0]; // we don't support multiple stops in same route
  const result: TripInterface = {
    uid: context.auth?.uid,
    trip_status: TripStatus.waitingConfirmation,
    origin_place_id: body.origin_place_id,
    origin_zone: getZoneNameFromCoordinate(
      leg.start_location.lat,
      leg.start_location.lng
    ),
    destination_place_id: body.destination_place_id,
    fare_price: calculateFare(leg.distance.value),
    distance_meters: leg.distance.value.toString(),
    distance_text: leg.distance.text,
    duration_seconds: leg.duration.value.toString(),
    duration_text: leg.duration.text,
    encoded_points: route.overview_polyline.points,
    request_time: Date.now(),
  };
  await tripRequestRef.set(result);

  return result;
};

const editTrip = async (
  data: any,
  context: functions.https.CallableContext
) => {
  return requestTrip(data, context);
};

const cancelTrip = async (_: any, context: functions.https.CallableContext) => {
  // validate authentication
  if (context.auth == null) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "Missing authentication credentials."
    );
  }

  // get a reference to user's trip request
  const tripRequestRef = firebaseAdmin
    .database()
    .ref("trip-requests")
    .child(context.auth?.uid);

  // delete trip request
  return tripRequestRef.remove().then(() => {
    return {};
  });
};

// returns a promise which resolves after ms milliseconds
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const confirmTrip = async (
  _: any,
  context: functions.https.CallableContext
) => {
  // validate authentication
  if (context.auth == null) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "Missing authentication credentials."
    );
  }

  // get a reference to the user's trip request
  const tripRequestRef = firebaseAdmin
    .database()
    .ref("trip-requests")
    .child(context.auth.uid);

  // throw error if user has no active trip request
  const snapshot = await tripRequestRef.once("value");
  if (snapshot.val() == null) {
    return new functions.https.HttpsError(
      "not-found",
      "User with uid " + context.auth.uid + " has no active trip request."
    );
  }

  // save original trip-request value
  const tripRequest = snapshot.val() as TripInterface;

  // change trip-request status to waiting-payment
  tripRequest.trip_status = TripStatus.waitingPayment;
  tripRequestRef.set(tripRequest);

  // start processing payment
  // TODO: substitute this for actual payment processing
  // await sleep(1500);
  let paymentSucceeded = true;

  // if payment failed
  if (!paymentSucceeded) {
    // set trip-request status to payment-failed
    tripRequest.trip_status = TripStatus.paymentFailed;
    tripRequestRef.set(tripRequest);
    // TODO: give more context in the message.
    return new functions.https.HttpsError(
      "cancelled",
      "Failed to process payment."
    );
  }

  // change trip-request status to lookingForDriver
  tripRequest.trip_status = TripStatus.lookingForDriver;
  tripRequestRef.set(tripRequest);

  // search available drivers according to the matching algorithm
  let availablePilots: PilotInterface[];
  try {
    availablePilots = await findPilots(tripRequest);
  } catch (e) {
    let error: HttpsError = e as HttpsError;
    // if failed to find pilots, update trip-request status to no-drivers-available
    tripRequest.trip_status = TripStatus.noDriversAvailable;
    tripRequestRef.set(tripRequest);
    return new functions.https.HttpsError(error.code, error.message);
  }

  // if didn't find pilots, update trip-reqeust status to noDriversAvailable and throw exception
  if (availablePilots.length == 0) {
    tripRequest.trip_status = TripStatus.noDriversAvailable;
    tripRequestRef.set(tripRequest);
    return new functions.https.HttpsError(
      "not-found",
      "there are no available pilots. Try again later."
    );
  }

  // transactionUpdate is the callback used to update pilots' statuses
  // it tires to set availablePilot's status to 'requested' and current_client_id to client's uid
  const transactionUpdate = (pilot: PilotInterface) => {
    if (pilot == null) {
      // we should always check for null even if there is data at this reference in the server.
      // If there is no cached data for this node, the SDK will 'guess' its value as 'null'.
      // The server lets the SDK know the actual value it stores. If it is not null, the transaction
      // is retried with the correct value. If data on server is actually null
      // this transaction will be completed and not retried.
      // In our case, we return {} for this case. After all, if the data is indeed null, we don't want
      // to replace it with something else.
      return {};
    }
    if (
      pilot.status == PilotStatus.available &&
      (pilot.current_client_uid == undefined || pilot.current_client_uid == "")
    ) {
      // if pilot is still available, change its status to 'requested'
      // and current_client_uid to uid of client making requests.
      // each pilot has 20 seconds to reply on their end.
      pilot.status = PilotStatus.requested;
      pilot.current_client_uid = context.auth?.uid;
      return pilot;
    } else {
      // abort transaction if pilot is no longer available
      return;
    }
  };

  // start listening for changes in client's driver_id in database with
  // 30 seconds timeout to account for delay when sending requests to pilots.
  // pilots will set this driver_id
  // const clientRef = firebaseAdmin
  //   .database()
  //   .ref("users")
  //   .child(context.auth.uid);

  // run transaction for each pilot
  const pilotsRef = firebaseAdmin.database().ref("pilots");
  for (var i = 0; i < availablePilots.length; i++) {
    await pilotsRef
      .child(availablePilots[i].uid)
      .transaction(transactionUpdate);
    // wait 4 seconds before tring to turn next pilot into 'requested'
    // this is so that first pilot to receive request has 5 seconds of
    // advantage to respond. Don't wait after runnign transactoin for last pilot, though.
    if (i != availablePilots.length - 1) {
      await sleep(4000);
    }
  }

  return;
};

/**
when hears change in driver_id
cancel sending of requests to pilots who were not yet requested.
for those who were requested but failed to respond in time, set status to available and current_client_id to null as long as it status equals requested and current_client_id equals the user's uuid, meaning it received our request, didn't respond in time, and didn't reset the pilot's status.
set status of pilot who successfully picked the ride to busy.
set trip_status to waiting-driver
if timeout expires
set status of pilots who failed to pick a ride back to available and current_client_id to null as long as it status equals requested and current_client_id equals the user's uuid, meaning it received our request, didn't respond in time, and didn't reset the pilot's status.
*/

export const request = functions.https.onCall(requestTrip);
export const edit = functions.https.onCall(editTrip);
export const cancel = functions.https.onCall(cancelTrip);
export const confirm = functions.https.onCall(confirmTrip);

/**
 * TESTS
 *  1) if user already has an active trip request, return "REQUEST_DENIED"
 *  2) request wiht missing body fields receive "INVALID_REQUEST"
 */
