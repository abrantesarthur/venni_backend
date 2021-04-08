import * as functions from "firebase-functions";
import * as firebaseAdmin from "firebase-admin";
import { calculateFare } from "./fare";
import { Client, Language } from "@googlemaps/google-maps-services-js";
import { StandardError, treatDirectionsError } from "./errors";

enum TripStatus {
  waitingConfirmation = "waiting-confirmation",
  waitingPayment = "waiting-payment",
  waitingDriver = "waiting-driver",
  lookingForDriver = "looking-for-driver",
  noDriversAvailable = "no-drivers-available",
  inProgress = "in-progress",
  completed = "completed",
  canceled = "canceled",
  paymentFailed = "payment-failed",
}

interface RequestTripInterface {
  origin_place_id: string;
  destination_place_id: string;
  origin_latitude: string;
  origin_longitude: string;
}

/**
 * TODO: add payment_method
 * TODO: add used_card_number
 */
interface TripInterface {
  uid?: string;
  trip_status: TripStatus;
  origin_place_id: string;
  destination_place_id: string;
  fare_price: string;
  distance_meters: string;
  distance_text: string;
  duration_seconds: string;
  duration_text: string;
  encoded_points: string;
  request_time: number; // number of milliseconds since 01/01/1970
  driver_id?: string;
  origin_latitude: number,
  origin_longitude: number,
}

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

  if (
    !(typeof obj.origin_latitude === "string") ||
    obj.origin_latitude.length === 0
  ) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "argument origin_latitude is missing."
    );
  }

  // origin_latitude must be numeric
  if(isNaN(obj.origin_latitude) || isNaN(Number.parseFloat(obj.origin_latitude))) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "argument origin_latitude can't be parsed to a number."
    );
  }

  if (
    !(typeof obj.origin_longitude === "string") ||
    obj.origin_longitude.length === 0
  ) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "argument origin_longitude is missing."
    );
  }

  // origin_longitude must be numeric
  if(isNaN(obj.origin_longitude) || isNaN(Number.parseFloat(obj.origin_longitude))) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "argument origin_longitude can't be parsed to a number."
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
  const result: TripInterface = {
    trip_status: TripStatus.waitingConfirmation,
    origin_place_id: body.origin_place_id,
    destination_place_id: body.destination_place_id,
    fare_price: calculateFare(route.legs[0].distance.value),
    distance_meters: route.legs[0].distance.value.toString(),
    distance_text: route.legs[0].distance.text,
    duration_seconds: route.legs[0].duration.value.toString(),
    duration_text: route.legs[0].duration.text,
    encoded_points: route.overview_polyline.points,
    request_time: Date.now(),
    origin_latitude: Number.parseFloat(body.origin_latitude),
    origin_longitude: Number.parseFloat(body.origin_longitude),
  };
  await tripRequestRef.set(result);

  // enrich result with uid and return it.
  result.uid = context.auth?.uid;
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

  // save request value
  const tripRequest = snapshot.val() as TripInterface;

  // change trip-request status to waiting-payment
  tripRequest.trip_status = TripStatus.waitingPayment;
  tripRequestRef.set(tripRequest);

  // start processing payment
  // TODO: substitute this for actual payment processing
  await sleep(1500);
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

  // change trip-request status to looking-for-drivers
  tripRequest.trip_status = TripStatus.lookingForDriver;
  tripRequestRef.set(tripRequest);

  // TODO: start looking for drivers according to the matching algorithm
  // let availableDrivers = [];

  return {};
};

/**
change trip-request status to looking-for-drivers
start looking for drivers according to Matching Algorithm, which looks for available drivers.
Matching Algorithm returns list of drivers or error
if receive error
set trip-request status to no-drivers-available
return NO_DRIVERS_AVAILABLE
if receive list of drivers
listen for changes in user's driver_id in the database with a generous timeout of 30 seconds.
then, use transaction to set picked drivers' status to requested and current_client_id to the user's uuid as long as it status is not already requested. Iterate over a list of picked drivers and set status with a delay of 5 seconds between each. Each client has 20 seconds to respond according to their accept-trip implementation.
when hears change in driver_id
cancel sending of requests to pilots who were not yet requested.
for those who were requested but failed to respond in time, set status to available and current_client_id to null as long as it status equals requested and current_client_id equals the user's uuid, meaning it received our request, didn't respond in time, and didn't reset the pilot's status.
set status of pilot who successfully picked the ride to busy.
set trip_status to waiting-driver
if timeout expires
set status of pilots who failed to pick a ride back to available and current_client_id to null as long as it status equals requested and current_client_id equals the user's uuid, meaning it received our request, didn't respond in time, and didn't reset the pilot's status.
*/

// TODO: if pilot goes offline or u
// const findPilots = async (
//   originPlaceID: String,
//   destinationLatitude: number,
//   destinationLongitude: number
// ) => {
//   googleMaps.distancematrix({
//     params: {
//       key: functions.config().googleapi.key,
//       origins: []
//     },
//   });
// };
/**
Looks for 3 pilots in the area of the client and rank them according to:
1) D - Distance to the client (50% weight)
below 100m is 50 points
above 4999m is 0pt
between 100m and 4999m is (5000 - D) / 98
2) T - For how long the pilot has been idle (40% weight)
it varies linearly according to (4/30) * T, such that idle for 0 seconds gives 0 points and idle for 5 minutes gives 40 points
3) S - Pilot score (10%)
less than 3 gives 0 points
from 3 to 5 it varies according to to 5S - 15
Distance gives at most 50 points, score at most 10points, and time idle is unlimited. This way, no matter a pilot's distance and score, at some point they will receive a ride.
The city is divided into squares that are stored in the database. As pilots drive around, they send their new latitude and longitude to the system every time they move 100 meters. The system places them in the square to which they belong.
The matching algorithm receives the client position as an argument and uses it to determine the client's square.
Select all available pilots in the client's square and squares adjacent to the pilot's square.
If there is no pilot, it picks pilots in squares adjacent to the adjacent squares, and so on until it finds up to 3 riders.
If it doesn't find any pilots, throw failure and notify the client.
If it finds pilots, rank them according to the above criteria and return the top three pilots.
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
