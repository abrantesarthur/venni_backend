import * as functions from "firebase-functions";
import * as firebaseAdmin from "firebase-admin";
import { calculateFare } from "./fare";
import { Client, Language } from "@googlemaps/google-maps-services-js";
import { StandardError, treatDirectionsError } from "./errors";

enum TripStatus {
  waitingConfirmation = "waiting-confirmation",
}

interface TripRequestInterface {
  origin_place_id: string;
  destination_place_id: string;
}

interface TripResponseInterface {
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
}

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
  const body = data as TripRequestInterface;

  // get a reference to user's trip request
  const tripRequestRef = db.ref("trip-requests").child(context.auth?.uid);

  return tripRequestRef.once("value").then(async (snapshot) => {
    // otherwise, request directions API for further route information
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
    const result: TripResponseInterface = {
      trip_status: TripStatus.waitingConfirmation,
      origin_place_id: body.origin_place_id,
      destination_place_id: body.destination_place_id,
      fare_price: calculateFare(route.legs[0].distance.value),
      distance_meters: route.legs[0].distance.value.toString(),
      distance_text: route.legs[0].distance.text,
      duration_seconds: route.legs[0].duration.value.toString(),
      duration_text: route.legs[0].duration.text,
      encoded_points: route.overview_polyline.points,
    };
    await tripRequestRef.set(result);

    // enrich result with uid and return it.
    result.uid = context.auth?.uid;
    return result;
  }).catch((e) => {
    throw new functions.https.HttpsError("internal", "failed to request trip.");
  });;
};

const editTrip = async (
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
  const body = data as TripRequestInterface;

  // get a reference to user's trip request
  const tripRequestRef = db.ref("trip-requests").child(context.auth?.uid);

  return tripRequestRef.once("value").then(async (snapshot) => {
    if (snapshot.val() == null) {
      // if a a trip request doesn't exist for the user, throw not-found
      throw new functions.https.HttpsError(
        "not-found",
        "The user already has no active trip request"
      );
    }

    // otherwise, request directions API for further route information
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
    const result: TripResponseInterface = {
      trip_status: TripStatus.waitingConfirmation,
      origin_place_id: body.origin_place_id,
      destination_place_id: body.destination_place_id,
      fare_price: calculateFare(route.legs[0].distance.value),
      distance_meters: route.legs[0].distance.value.toString(),
      distance_text: route.legs[0].distance.text,
      duration_seconds: route.legs[0].duration.value.toString(),
      duration_text: route.legs[0].duration.text,
      encoded_points: route.overview_polyline.points,
    };

    await tripRequestRef.set(result);

    // enrich result with uid and return it.
    result.uid = context.auth?.uid;
    return result;
  }).catch((e) => {
    throw new functions.https.HttpsError("internal", "failed to edit trip.");
  });
};

const cancelTrip = async (
  context: functions.https.CallableContext
) => {
  // validate authentication
  if (context.auth == null) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "Missing authentication credentials."
    );
  }

  // define the db
  const db = firebaseAdmin.database();

  // get a reference to user's trip request
  const tripRequestRef = db.ref("trip-requests").child(context.auth?.uid);

  // delete trip request
  return tripRequestRef.remove().then(() => {
    return {};
  }).catch((e) => {
    throw new functions.https.HttpsError("unknown", "failed to cancel trip");
  })
};

export const request = functions.https.onCall(requestTrip);
export const edit = functions.https.onCall(editTrip);
export const cancel = functions.https.onCall(cancelTrip);

/**
 * TESTS
 *  1) if user already has an active trip request, return "REQUEST_DENIED"
 *  2) request wiht missing body fields receive "INVALID_REQUEST"
 */
