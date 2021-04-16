import * as functions from "firebase-functions";
import * as firebaseAdmin from "firebase-admin";
import { findPilots } from "./pilots";
import { calculateFare } from "./fare";
import { Client, Language } from "@googlemaps/google-maps-services-js";
import { StandardError, treatDirectionsError } from "./errors";
import { HttpsError } from "firebase-functions/lib/providers/https";
import { AsyncTimeout, sleep } from "./utils";
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

function validateRequestTripArguments(obj: any) {
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

function validateAcceptTripArguments(obj: any) {
  if (!(typeof obj.client_id === "string") || obj.client_id.length === 0) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "argument client_id must be a string with length greater than 0."
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
  validateRequestTripArguments(data);

  // define the db
  const db = firebaseAdmin.database();

  // type cast data
  const body = data as RequestTripInterface;

  // get a reference to user's trip request
  const tripRequestRef = db.ref("trip-requests").child(context.auth?.uid);

  // fail if there exists an ongoing trip
  const snapshot = await tripRequestRef.once("value");
  const tripRequest = snapshot.val() as TripInterface;
  if (
    tripRequest != null &&
    (tripRequest.trip_status == TripStatus.inProgress ||
      tripRequest.trip_status == TripStatus.lookingForDriver ||
      tripRequest.trip_status == TripStatus.waitingDriver ||
      tripRequest.trip_status == TripStatus.waitingPayment ||
      tripRequest.trip_status == TripStatus.waitingConfirmation)
  ) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "Can't request a trip if client has an ongoing trip in status '" +
        tripRequest.trip_status +
        "'"
    );
  }


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


const clientCancelTrip = async (_: any, context: functions.https.CallableContext) => {
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

  // trip must be in a valid status to be cancelled
  const tripRequestSnapshot = await tripRequestRef.once("value");
  const tripRequest = tripRequestSnapshot.val() as TripInterface;
  if (
    tripRequest == null ||
    (tripRequest.trip_status != TripStatus.waitingConfirmation &&
      tripRequest.trip_status != TripStatus.waitingDriver &&
      tripRequest.trip_status != TripStatus.inProgress)
  ) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "Trip request can't be cancelled when in status '" +
        tripRequest.trip_status +
        "'"
    );
  }

  // get id of possible pilot handling the trip
  const pilotID = tripRequest.driver_id;

  // set trip status to cancelled-by-client
  await tripRequestRef.transaction((tripRequest: TripInterface) => {
    if (tripRequest == null) {
      return {};
    }
    tripRequest.trip_status = TripStatus.cancelledByClient;
    return tripRequest;
  });

  // if a pilot is handling the trip, set him available and update idle_since
  if (pilotID != null) {
    const pilotRef = firebaseAdmin.database().ref("pilots").child(pilotID);
    await pilotRef.transaction((pilot: PilotInterface) => {
      if (pilot == null) {
        return {};
      }
      // TODO: export this to another function in pilots.ts
      pilot.status = PilotStatus.available;
      pilot.current_client_uid = "";
      pilot.idle_since = Date.now();
      pilot.total_trips = pilot.total_trips + 1;
      return pilot;
    });
  }
};

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

  // get a reference to the user's trip request and driver_id
  const tripRequestRef = firebaseAdmin
    .database()
    .ref("trip-requests")
    .child(context.auth.uid);

  // throw error if user has no active trip request
  const snapshot = await tripRequestRef.once("value");
  if (snapshot.val() == null) {
    throw new functions.https.HttpsError(
      "not-found",
      "User with uid " + context.auth.uid + " has no active trip request."
    );
  }

  // save original trip-request value
  let tripRequest = snapshot.val() as TripInterface;

  // throw error if trip request is not waiting confirmation
  // or any status that mean the user is trying again
  if (
    tripRequest.trip_status != "waiting-confirmation" &&
    tripRequest.trip_status != "payment-failed" &&
    tripRequest.trip_status != "no-drivers-available" &&
    tripRequest.trip_status != "looking-for-driver"
  ) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "Trip request of user with uid " +
        context.auth.uid +
        " has invalid status '" +
        tripRequest.trip_status +
        "'"
    );
  }

  // change trip-request status to waiting-payment
  // important: only use set to modify trip request values befores sending
  // requests to pilots. Use only transactions after that, because pilots
  // use transactions to modify trip request, and us using set would
  // cancel their transactions.
  tripRequest.trip_status = TripStatus.waitingPayment;
  tripRequestRef.set(tripRequest);

  // start processing payment
  // TODO: substitute this for actual payment processing
  await sleep(1);
  let paymentSucceeded = true;

  // if payment failed
  if (!paymentSucceeded) {
    // set trip-request status to payment-failed
    tripRequest.trip_status = TripStatus.paymentFailed;
    tripRequestRef.set(tripRequest);
    // TODO: give more context in the message.
    throw new functions.https.HttpsError(
      "cancelled",
      "Failed to process payment."
    );
  }

  // change trip-request status to lookingForDriver
  tripRequest.trip_status = TripStatus.lookingForDriver;
  tripRequestRef.set(tripRequest);

  // search available drivers nearby client
  let nearbyPilots: PilotInterface[];
  try {
    nearbyPilots = await findPilots(tripRequest);
  } catch (e) {
    let error: HttpsError = e as HttpsError;
    // if failed to find pilots, update trip-request status to no-drivers-available
    tripRequest.trip_status = TripStatus.noDriversAvailable;
    tripRequestRef.set(tripRequest);
    throw new functions.https.HttpsError(error.code, error.message);
  }

  // if didn't find pilots, update trip-reqeust status to noDriversAvailable and throw exception
  if (nearbyPilots.length == 0) {
    tripRequest.trip_status = TripStatus.noDriversAvailable;
    tripRequestRef.set(tripRequest);
    throw new functions.https.HttpsError(
      "failed-precondition",
      "There are no available pilots. Try again later."
    );
  }

  // TODO: remove
  nearbyPilots.forEach((pilot) => {
  });

  // variable that will hold list of pilots who received trip request
  let requestedPilotsUIDs: string[] = [];

  // reference to pilots
  const pilotsRef = firebaseAdmin.database().ref("pilots");

  // requestPilot is the callback used to update pilots' statuses to requested.
  // it tires to set availablePilot's status to 'requested' and current_client_id to client's uid
  const requestPilot = (pilot: PilotInterface) => {
    if (pilot == null) {
      // we should always check for null even if there is data at this reference in the server.
      // If there is no cached data for this node, the SDK will 'guess' its value as 'null'.
      // The server lets the SDK know the actual value it stores. If it is not null, the transaction
      // is retried with the correct value. If data on server is actually null,
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
      // they will use the current_client_uid to find the trip-request entry for the
      // client and try updating its driver_id field.
      pilot.status = PilotStatus.requested;
      pilot.current_client_uid = context.auth?.uid;

      // mark pilot as requested.
      requestedPilotsUIDs.push(pilot.uid);

      return pilot;
    } else {
      // abort transaction if pilot is no longer available
      return;
    }
  };

  // unrequestPilot undoes what requestPilot does.
  const unrequestPilot = (pilot: PilotInterface) => {
    if (pilot == null) {
      // we always check for null. Read comments above for explanation.
      return {};
    }
    if (
      pilot.status == "requested" &&
      pilot.current_client_uid == context.auth?.uid
    ) {
      // if pilot was requested to this trip, cancel request.
      pilot.status = PilotStatus.available;
      pilot.current_client_uid = "";
      return pilot;
    }
    // abort transaction in other cases
    return;
  };

  // cancelRequest is a callback that is triggered if pilots fail
  // to accept a trip in 30 seconds. It stops listening for their responses
  // and unrequests them, setting their statuses back to available.
  const cancelRequest = () => {
    // when timeout expires, stop listening for changes in driver_id
    tripRequestRef.off("value");

    const j = requestedPilotsUIDs.length;
    for (var i = 0; i < j; i++) {
      // set status of pilots who failed to pick trip back to available
      pilotsRef.child(requestedPilotsUIDs[0]).transaction(unrequestPilot);

      // remove pilot from list of requested pilots.
      requestedPilotsUIDs = requestedPilotsUIDs.slice(1);
    }

    // send failure response back
    throw new functions.https.HttpsError(
      "deadline-exceeded",
      "No pilot accepted trip request."
    );
  };

  // start listening for changes in trip request's driver_id before actually
  // sending requests to pilots. Have  with 30 seconds timeout to account for
  // time to send all requests and for pilots to accept them.
  // pilots are listening for changes in their 'status'. When they see its value
  // change to 'requested' they can accept the trip by sending an accept-trip request
  // which will update the trip-request's driver_id field with the uid of the pilot.
  // we detect that change to driver_id here. It's important to note that we continue
  // listening even if confirmTrip returns. The only way to stop listening is by calling
  // tripRequestRef.off
  let cancelFurtherPilotRequests = false;
  let asyncTimeout = new AsyncTimeout();
  let timeoutPromise = asyncTimeout.set(cancelRequest, 30000);
  let isWaitingDriver: boolean = false;
  tripRequestRef.on("value", (snapshot) => {
    if (snapshot.val() == null) {
      // this should never happen! If it does, something is very broken!
      throw new functions.https.HttpsError(
        "internal",
        "Something wrong happend. Try again later."
      );
    }
    let trip = snapshot.val() as TripInterface;
    // if one of the pilots accepts the trip, they will call accept-trip which
    // will update the trip's driver_id with the id of the accepting pilot
    if (trip.driver_id != undefined && trip.driver_id.length > 0) {
      // make sure the driver_id belongs to one for the nearby pilots
      let isValidDriverID = false;
      nearbyPilots.forEach((nearbyPilot) => {
        if (nearbyPilot.uid == trip.driver_id) {
          isValidDriverID = true;
        }
      });
      if (!isValidDriverID) {
        // clear driver_id so other pilots have the chance of claiming thr trip
        tripRequestRef.child("driver_id").set("");
        // abort and continue listening for changes
        return;
      }

      // if driver_id does belong to a nearby pilot, clear timeout
      // so we no longer execute cancelRequests
      asyncTimeout.clear();

      // stop sending requests to more pilots;
      cancelFurtherPilotRequests = true;

      // stop listening for changes in driver_id
      tripRequestRef.off("value");

      // for pilots who were requested but failed to respond in time, set status to available
      // and clear current_client_id as long as its status equals requested and current_client_id
      // equals the client's uuid. This means it received our request, didn't respond in time,
      // and didn't reset the pilot's status.
      const j = requestedPilotsUIDs.length;
      for (var i = 0; i < j; i++) {
        pilotsRef.child(requestedPilotsUIDs[0]).transaction(unrequestPilot);

        // remove pilot from list of requested pilots.
        requestedPilotsUIDs = requestedPilotsUIDs.slice(1);
      }

      // set status of pilot who successfully picked the ride to busy.
      // and current_client_id to the id of requesting client
      pilotsRef.child(trip.driver_id).transaction((pilot: PilotInterface) => {
        if (pilot == null) {
          // always check for null on transactoins
          return {};
        }
        pilot.status = PilotStatus.busy;
        pilot.current_client_uid = context.auth?.uid;
        return pilot;
      });

      // set trip_status to waiting-driver. this is how the client knows that
      // confirm-trip was successful.
      tripRequestRef.transaction((tripRequest: TripInterface) => {
        if (tripRequest == null) {
          return {};
        }
        tripRequest.trip_status = TripStatus.waitingDriver;
        isWaitingDriver = true;
        return tripRequest;
      });
    }
  });

  // send request to each pilot after we start listening for driver_id changes
  for (var i = 0; i < nearbyPilots.length; i++) {
    if (cancelFurtherPilotRequests) {
      // in case we hear a valid driver_id, the listener callback will cancel
      // further requests by setting this variable, so we abort loop.
      break;
    }

    await pilotsRef.child(nearbyPilots[i].uid).transaction(requestPilot);

    // wait 4 seconds before tring to turn next pilot into 'requested'
    // this is so that first pilot to receive request has 5 seconds of
    // advantage to respond. Don't wait after runnign transactoin for last pilot, though.
    if (i != nearbyPilots.length - 1) {
      await sleep(4000);
    }
  }

  // wait for timeout to end or for rider to accept trip, thus clearing timeout
  // and resolving timeoutPromise
  await timeoutPromise;

  // stop listenign for changes
  tripRequestRef.off("value");

  // we want to return from confirmTrip only after trip_status has reached its final
  // state. If timeoutPromse was cleared, this may not be the case yet. If clear()
  // is called late enough but before timeout goes off, the code will already be waiting for
  // timeoutPromise. This way, as soon as clear() is called, confirmTrip returns
  // before the listener has time to update status to waitingDriver. Thats why we
  // wait here until waitingDriver state is reached.
  if (asyncTimeout.wasCleared) {
    do {
      await sleep(1);
    } while (!isWaitingDriver);
  }

  // although the function finishes its execution here, the client
  // must pay attention to the trip's status to know whether the call was
  // succesfull (i.e., when it has waitingDriver value). This is because,
  // although the function may be returning here, it may still be waiting
  // for drivers to respond. In case no driver responds, the trip state becomes
  // timedOutWaitingDriverAcceptance, in which case the client can also
  // consider the request done.
  return;
};

const acceptTrip = async (
  data: any,
  context: functions.https.CallableContext
) => {
  // validate authentication
  if (context.auth == null) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "Missing authentication credentials."
    );
  }

  // validate data
  validateAcceptTripArguments(data);

  const pilotID = context.auth.uid;
  const clientID = data.client_id;

  // get a reference to pilot data
  const pilotRef = firebaseAdmin.database().ref("pilots").child(pilotID);

  // make sure the pilot's status is requested and trip's current_client_id is set
  let pilotSnapshot = await pilotRef.once("value");
  let pilot = pilotSnapshot.val() as PilotInterface;
  if (
    pilot == null ||
    pilot.status != PilotStatus.requested ||
    pilot.current_client_uid != clientID
  ) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "pilot has not been requested for trip or trip has already been picked."
    );
  }

  // get a reference to user's trip request
  const tripRequestRef = firebaseAdmin
    .database()
    .ref("trip-requests")
    .child(clientID);

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
        tripRequest.driver_id = pilotID;
        return tripRequest;
      }

      // otherwise, abort
      return;
    },
    (error, completed, _) => {
      // if transaction failed abnormally
      if (error) {
        throw new functions.https.HttpsError(
          "internal",
          "Something went wrong."
        );
      }

      // if transaction was aborted
      if (completed == false) {
        // another pilot has already requested the trip, so throw error.
        throw new functions.https.HttpsError(
          "failed-precondition",
          "another pilot has already picked up the trip"
        );
      }
    }
  );

  // wait enough time for confirmTrip to run transaction on pilot status
  await sleep(500);

  // wait until pilot's status is set to busy or available by confirmTrip
  pilotSnapshot = await pilotRef.once("value");
  pilot = pilotSnapshot.val() as PilotInterface;
  while (
    pilot.status != PilotStatus.busy &&
    pilot.status != PilotStatus.available
  ) {
    await sleep(1);
    pilotSnapshot = await pilotRef.once("value");
    pilot = pilotSnapshot.val() as PilotInterface;
  }

  // if it was set to available, confirmTrip denied trip to the pilot
  if (pilot.status == PilotStatus.available) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "trip denied to the pilot"
    );
  }

  // if it was set busy, confirmTrip indeed granted the trip to the pilot.
  if (pilot.status == PilotStatus.busy) {
    return;
  }
};

export const request = functions.https.onCall(requestTrip);
export const edit = functions.https.onCall(editTrip);
export const client_cancel = functions.https.onCall(clientCancelTrip);
export const confirm = functions.https.onCall(confirmTrip);
export const accept = functions.https.onCall(acceptTrip);

/**
 * TESTS
 *  1) if user already has an active trip request, return "REQUEST_DENIED"
 *  2) request wiht missing body fields receive "INVALID_REQUEST"
 */

// TODO: request directions to get encoded points when pilot reports his position
