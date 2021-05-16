import * as functions from "firebase-functions";
import * as firebaseAdmin from "firebase-admin";
import { calculateFare } from "./fare";
import {
  Client as GoogleMapsClient,
  Language,
} from "@googlemaps/google-maps-services-js";
import { StandardError, treatDirectionsError } from "./errors";
import { HttpsError } from "firebase-functions/lib/providers/https";
import { AsyncTimeout, sleep, LooseObject, validateArgument } from "./utils";
import { getZoneNameFromCoordinate } from "./zones";
import { TripRequest } from "./database/tripRequest";
import { Pilot } from "./database/pilot";
import { Client } from "./database/client";
import "./database/index";
import { transaction } from "./database/index";
import { Pilots } from "./database/pilots";
import { ClientPastTrips, PilotPastTrips } from "./database/pastTrips";
import { Pagarme } from "./vendors/pagarme";
// initialize google maps API client
const googleMaps = new GoogleMapsClient({});

function validateRequestTripArguments(obj: any) {
  validateArgument(
    obj,
    ["origin_place_id", "destination_place_id"],
    ["string", "string"],
    [true, true]
  );

  // if destination_place_id and origin_place_id are the same, return REQUEST_DENIED
  if (obj.origin_place_id === obj.destination_place_id) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "destination_place_id and origin_place_id are the same."
    );
  }
}

function validateAcceptTripArguments(obj: any) {
  validateArgument(obj, ["client_id"], ["string"], [true]);
  if (obj.client_id.length === 0) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "argument client_id must have length greater than 0."
    );
  }
}

function validateCompleteTripArguments(obj: any) {
  validateArgument(obj, ["client_rating"], ["number"], [true]);
  if (obj.client_rating > 5 || obj.client_rating < 0) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "argument client_rating must be a number between 0 and 5."
    );
  }
}

// validateRatePilotArguments enforces PilotRating interface
// plus pilot_id
// {
//   pilot_id: string;
//   score: number;
//   cleanliness_went_well?: bool;
//   safety_went_well?: bool;
//   waiting_time_went_well?: bool;
//   feedback: string;
// }
function validateRatePilotArguments(obj: any) {
  validateArgument(
    obj,
    [
      "pilot_id",
      "score",
      "cleanliness_went_well",
      "safety_went_well",
      "waiting_time_went_well",
      "feedback",
    ],
    ["string", "number", "boolean", "boolean", "boolean", "string"],
    [true, true, false, false, false, false]
  );

  if (obj.score > 5 || obj.score < 0) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "argument 'score' must be a number between 0 and 5."
    );
  }
}

function validateClientGetPastTripsArguments(obj: any) {
  // it's ok if client passes no argument
  if (obj == undefined || obj == null) {
    return;
  }
  validateArgument(
    obj,
    ["page_size", "max_request_time"],
    ["number", "number"],
    [false, false]
  );
  if (obj.page_size <= 0) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "argument 'page_size' must greater than 0."
    );
  }

  if (obj.max_request_time <= 0) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "argument 'max_request_time' must greater than 0."
    );
  }
}

export interface RequestTripInterface {
  origin_place_id: string;
  destination_place_id: string;
}

// TODO: only accept requests departing from Paracatu
// TODO: check that client doesn't have pending payments. If so, return cancelled status
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

  // type cast data
  const body = data as RequestTripInterface;

  // get a reference to user's trip request
  const tr = new TripRequest(context.auth.uid);

  // fail if there exists an ongoing trip
  const tripRequest = await tr.getTripRequest();
  if (
    tripRequest != null &&
    tripRequest != undefined &&
    (tripRequest.trip_status == TripRequest.Status.inProgress ||
      tripRequest.trip_status == TripRequest.Status.lookingForPilot ||
      tripRequest.trip_status == TripRequest.Status.waitingPilot ||
      tripRequest.trip_status == TripRequest.Status.waitingPayment)
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
  const result: TripRequest.Interface = {
    uid: context.auth?.uid,
    trip_status: TripRequest.Status.waitingConfirmation,
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
    request_time: Date.now().toString(),
    origin_address: leg.start_address,
    destination_address: leg.end_address,
  };
  await tr.ref.set(result);

  return result;
};

const editTrip = async (
  data: any,
  context: functions.https.CallableContext
) => {
  return requestTrip(data, context);
};

// TODO: charge the customer for cancelation if pilot is already coming or trip
// is already in progress
const clientCancelTrip = async (
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

  // get a reference to user's trip request
  const tr = new TripRequest(context.auth.uid);

  // trip must be in a valid status to be cancelled
  const tripRequest = await tr.getTripRequest();
  if (
    tripRequest == null ||
    tripRequest == undefined ||
    (tripRequest.trip_status != TripRequest.Status.waitingConfirmation &&
      tripRequest.trip_status != TripRequest.Status.paymentFailed &&
      tripRequest.trip_status != TripRequest.Status.noPilotsAvailable &&
      tripRequest.trip_status != TripRequest.Status.lookingForPilot &&
      tripRequest.trip_status != TripRequest.Status.waitingPilot &&
      tripRequest.trip_status != TripRequest.Status.inProgress)
  ) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "Trip request can't be cancelled when in status '" +
        tripRequest?.trip_status +
        "'"
    );
  }

  // if a pilot is handling the trip, free him to handle other trips
  const pilotID = tripRequest.pilot_id;
  if (pilotID != undefined && pilotID.length > 0) {
    const p = new Pilot(pilotID);
    p.free();
  }

  // set trip status to cancelled-by-client
  await transaction(tr.ref, (tripRequest: TripRequest.Interface) => {
    if (tripRequest == null) {
      return {};
    }
    tripRequest.trip_status = TripRequest.Status.cancelledByClient;
    return tripRequest;
  });

  // return updated trip-request to client
  return await tr.getTripRequest();
};

const confirmTrip = async (
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
  validateArgument(data, ["card_id"], ["string"], [false]);

  // get a reference to the user's trip request and pilot_id
  const tr = new TripRequest(context.auth.uid);
  let tripRequest = await tr.getTripRequest();

  // throw error if user has no active trip request
  if (tripRequest == null || tripRequest == undefined) {
    throw new functions.https.HttpsError(
      "not-found",
      "User with uid " + context.auth.uid + " has no active trip request."
    );
  }

  // throw error if trip request is not waiting confirmation
  // or any status that mean the user is trying again
  if (
    tripRequest.trip_status != "waiting-confirmation" &&
    tripRequest.trip_status != "payment-failed" &&
    tripRequest.trip_status != "no-pilots-available" &&
    tripRequest.trip_status != "looking-for-pilot" &&
    tripRequest.trip_status != "cancelled-by-pilot"
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

  // variable that will store promises to await all before returning
  let promises: Promise<any>[] = [];

  // change trip-request status to waiting-payment
  // important: only use set to modify trip request values befores sending
  // requests to pilots. Use only transactions after that, because pilots
  // use transactions to modify trip request, and us using set would
  // cancel their transactions.
  tripRequest.trip_status = TripRequest.Status.waitingPayment;
  promises.push(tr.ref.set(tripRequest));

  // make sure that 'card_id', if specified, corresponds to existing card
  const c = new Client(context.auth.uid);
  let client = await c.getClient();
  let creditCard: Client.Interface.Card | undefined;
  if (
    data.card_id != undefined &&
    client != undefined &&
    client.cards != undefined
  ) {
    for (var i = 0; i < client.cards.length; i++) {
      if (data.card_id === client.cards[i].id) {
        creditCard = client.cards[i];
        break;
      }
    }
    if (creditCard === undefined) {
      tripRequest.trip_status = TripRequest.Status.paymentFailed;
      promises.push(tr.ref.set(tripRequest));
      await Promise.all(promises);
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Could not find card with id '" + data.card_id + "'."
      );
    }
  }

  let paymentFailed = false;
  let pagarmeError;
  if (creditCard == undefined) {
    // if paying with cash, update trip request's payment method
    tripRequest.payment_method = "cash";
    promises.push(tr.ref.set(tripRequest));
  } else {
    // if paying with credit card
    const p = new Pagarme();
    await p.ensureInitialized();
    try {
      // create a transaction to be captured later
      let transaction = await p.createTransaction(
        creditCard.id,
        tripRequest.fare_price,
        {
          id: creditCard.pagarme_customer_id,
          name: creditCard.holder_name,
        },
        creditCard.billing_address
      );

      if (transaction.status !== "authorized") {
        paymentFailed = true;
      } else {
        // if authorization succeded, save transaction info to capture later
        tripRequest.payment_method = "credit_card";
        tripRequest.credit_card = creditCard;
        tripRequest.transaction_id = transaction.tid.toString();
        promises.push(tr.ref.set(tripRequest));
      }
    } catch (e) {
      paymentFailed = true;
      pagarmeError = e;
    }
  }

  // if transaction was not authorized, update trip status and throw error
  if (paymentFailed) {
    tripRequest.trip_status = TripRequest.Status.paymentFailed;
    promises.push(tr.ref.set(tripRequest));
    await Promise.all(promises);
    throw new functions.https.HttpsError(
      "cancelled",
      "Payment was not authorized.",
      pagarmeError?.response.errors[0]
    );
  }
  // change trip-request status to lookingForPilot
  tripRequest.trip_status = TripRequest.Status.lookingForPilot;
  promises.push(tr.ref.set(tripRequest));

  // search available pilots nearby client
  let nearbyPilots: Pilot.Interface[];
  let ps = new Pilots();
  try {
    nearbyPilots = await ps.findAllAvailable(tripRequest);
  } catch (e) {
    let error: HttpsError = e as HttpsError;
    // if failed to find pilots, update trip-request status to no-pilots-available
    tripRequest.trip_status = TripRequest.Status.noPilotsAvailable;
    promises.push(tr.ref.set(tripRequest));
    await Promise.all(promises);
    throw new functions.https.HttpsError(error.code, error.message);
  }

  // if didn't find pilots, update trip-reqeust status to noPilotsAvailable and throw exception
  if (nearbyPilots.length == 0) {
    tripRequest.trip_status = TripRequest.Status.noPilotsAvailable;
    promises.push(tr.ref.set(tripRequest));
    await Promise.all(promises);
    throw new functions.https.HttpsError(
      "failed-precondition",
      "There are no available pilots. Try again later."
    );
  }

  // variable that will hold list of pilots who received trip request
  let requestedPilotsUIDs: string[] = [];

  // reference to pilots
  const pilotsRef = firebaseAdmin.database().ref("pilots");

  // requestPilot is the callback used to update pilots' statuses to requested.
  // it tires to set availablePilot's status to 'requested' and current_client_id to client's uid
  const requestPilot = (pilot: Pilot.Interface) => {
    if (pilot == null) {
      // this will run in a transaction. When running a function in a transaction,
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
      pilot.status == Pilot.Status.available &&
      (pilot.current_client_uid == undefined || pilot.current_client_uid == "")
    ) {
      // if pilot is still available, change its status to 'requested'
      // and current_client_uid to uid of client making requests.
      // each pilot has 20 seconds to reply on their end.
      // they will use the current_client_uid to find the trip-request entry for the
      // client and try updating its pilot_id field.
      pilot.status = Pilot.Status.requested;
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
  const unrequestPilot = (pilot: Pilot.Interface) => {
    if (pilot == null) {
      // we always check for null. Read comments above for explanation.
      return {};
    }
    if (
      pilot.status == "requested" &&
      pilot.current_client_uid == context.auth?.uid
    ) {
      // if pilot was requested to this trip, cancel request.
      pilot.status = Pilot.Status.available;
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
    // when timeout expires, stop listening for changes in pilot_id
    tr.ref.off("value");

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

  // start listening for changes in trip request's pilot_id before actually
  // sending requests to pilots. Have  with 30 seconds timeout to account for
  // time to send all requests and for pilots to accept them.
  // pilots are listening for changes in their 'status'. When they see its value
  // change to 'requested' they can accept the trip by sending an accept-trip request
  // which will update the trip-request's pilot_id field with the uid of the pilot.
  // we detect that change to pilot_id here. It's important to note that we continue
  // listening even if confirmTrip returns. The only way to stop listening is by calling
  // tripRequestRef.off
  let cancelFurtherPilotRequests = false;
  let asyncTimeout = new AsyncTimeout();
  let timeoutPromise = asyncTimeout.set(cancelRequest, 30000);
  let confirmTripResponse: LooseObject = {};
  tr.ref.on("value", async (snapshot) => {
    if (snapshot.val() == null) {
      // this should never happen! If it does, something is very broken!
      await Promise.all(promises);
      throw new functions.https.HttpsError(
        "internal",
        "Something wrong happend. Try again later."
      );
    }
    let trip = snapshot.val() as TripRequest.Interface;
    // if one of the pilots accepts the trip, they will call accept-trip which
    // will update the trip's pilot_id with the id of the accepting pilot
    if (trip.pilot_id != undefined && trip.pilot_id.length > 0) {
      // make sure the pilot_id belongs to one for the nearby pilots
      let isValidPilotID = false;
      nearbyPilots.forEach((nearbyPilot) => {
        if (nearbyPilot.uid == trip.pilot_id) {
          isValidPilotID = true;
        }
      });
      if (!isValidPilotID) {
        // clear pilot_id so other pilots have the chance of claiming the trip
        promises.push(
          tr.ref.transaction((tripRequest: TripRequest.Interface) => {
            if (tripRequest == null) {
              return {};
            }
            tripRequest.pilot_id = "";
            return tripRequest;
          })
        );
        // abort and continue listening for changes
        return;
      }

      // if pilot_id does belong to a nearby pilot, clear timeout
      // so we no longer execute cancelRequests
      asyncTimeout.clear();

      // stop sending requests to more pilots;
      cancelFurtherPilotRequests = true;

      // stop listening for changes in pilot_id
      tr.ref.off("value");

      // set status of pilot who successfully picked the ride to busy.
      // and current_client_id to the id of requesting client. Also, set
      // confirmTripResponse, which will be returned to the client later.
      promises.push(
        pilotsRef.child(trip.pilot_id).transaction((pilot: Pilot.Interface) => {
          if (pilot == null) {
            // always check for null on transactoins
            return {};
          }

          pilot.status = Pilot.Status.busy;
          pilot.current_client_uid = context.auth?.uid;

          // populate final confirmTrip response with data from pilot
          confirmTripResponse.pilot_id = pilot.uid;
          confirmTripResponse.pilot_name = pilot.name;
          confirmTripResponse.pilot_last_name = pilot.last_name;
          confirmTripResponse.pilot_total_trips =
            pilot.total_trips == undefined ? "0" : pilot.total_trips;
          confirmTripResponse.pilot_member_since = pilot.member_since;
          confirmTripResponse.pilot_phone_number = pilot.phone_number;
          confirmTripResponse.current_client_uid = pilot.current_client_uid;
          confirmTripResponse.pilot_current_latitude = pilot.current_latitude;
          confirmTripResponse.pilot_current_longitude = pilot.current_longitude;
          confirmTripResponse.pilot_current_zone = pilot.current_zone;
          confirmTripResponse.pilot_status = pilot.status;
          confirmTripResponse.pilot_vehicle = pilot.vehicle;
          confirmTripResponse.pilot_idle_since = pilot.idle_since;
          confirmTripResponse.pilot_rating = pilot.rating;
          // update pilot in database
          return pilot;
        })
      );

      // set trip_status to waiting-pilot. this is how the client knows that
      // confirm-trip was successful.
      promises.push(
        tr.ref.transaction((tripRequest: TripRequest.Interface) => {
          if (tripRequest == null) {
            return {};
          }
          tripRequest.trip_status = TripRequest.Status.waitingPilot;
          return tripRequest;
        })
      );
    }
  });

  // send request to each pilot after we start listening for pilot_id changes
  for (var i = 0; i < nearbyPilots.length; i++) {
    if (cancelFurtherPilotRequests) {
      // in case we hear a valid pilot_id, the listener callback will cancel
      // further requests by setting this variable, so we abort loop.
      break;
    }

    promises.push(
      pilotsRef.child(nearbyPilots[i].uid).transaction(requestPilot)
    );

    // wait at most 4 seconds before tring to turn next pilot into 'requested'
    // this is so that first pilot to receive request has 5 seconds of
    // advantage to respond. Don't wait after runnign transactoin for last pilot, though.
    // in case cancelFurtherPilotRequests is set to true, we stop waiting.
    if (i != nearbyPilots.length - 1) {
      let msPassed = 0;
      do {
        await sleep(1);
        if (cancelFurtherPilotRequests) {
          break;
        }
        msPassed += 1;
      } while (msPassed < 4000);
    }
  }

  // wait for timeout to end or for rider to accept trip, thus clearing timeout
  // and resolving timeoutPromise
  await timeoutPromise;

  // we want to return from confirmTrip only after trip_status has reached its final
  // state. If timeoutPromse was cleared, this may not be the case yet. If clear()
  // is called late enough but before timeout goes off, the code will already be waiting for
  // timeoutPromise. This way, as soon as clear() is called, confirmTrip returns
  // before the listener has time to update status to waitingPilot. That's why we
  // wait here until waitingPilot state is reached.
  if (asyncTimeout.wasCleared) {
    // listen for trip status and only continue when it has waiting-pilot status
    // we want to exit confirmTrip if trip having its final status
    do {
      await sleep(1);
      tripRequest = await tr.getTripRequest();
    } while (
      tripRequest == null ||
      tripRequest == undefined ||
      tripRequest.trip_status != "waiting-pilot"
    );
    // important: sleep a bit to guarantee that waiting-pilot status is persisted
    await sleep(300);

    // for pilots who were requested but failed to respond in time, set status to available
    // and clear current_client_id as long as its status equals requested and current_client_id
    // equals the client's uuid. This means it received our request, didn't respond in time,
    // and didn't reset the pilot's status.
    const j = requestedPilotsUIDs.length;
    for (var i = 0; i < j; i++) {
      promises.push(
        pilotsRef.child(requestedPilotsUIDs[0]).transaction(unrequestPilot)
      );

      // remove pilot from list of requested pilots.
      requestedPilotsUIDs = requestedPilotsUIDs.slice(1);
    }

    // respond with confirmTripResponse, which should be already set by this point, but we await
    // just to be sure.
    do {
      await sleep(1);
    } while (confirmTripResponse == undefined);
    // pupulate response with trip status
    confirmTripResponse.trip_status = tripRequest.trip_status;
    await Promise.all(promises);
    return confirmTripResponse;
  }

  // otherwise, return object with trip_status
  // TODO: why do we do this? if timeout expires, the function throws error!
  do {
    await sleep(1);
    tripRequest = await tr.getTripRequest();
  } while (tripRequest == null || tripRequest == undefined);
  // important: sleep a bit to guarantee that final status is persisted
  await sleep(300);
  await Promise.all(promises);
  return { trip_status: tripRequest.trip_status };
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
  let pilot = pilotSnapshot.val() as Pilot.Interface;
  if (
    pilot == null ||
    pilot.status != Pilot.Status.requested ||
    pilot.current_client_uid != clientID
  ) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "pilot has not been requested for trip or trip has already been picked."
    );
  }

  // get a reference to user's trip request
  const tr = new TripRequest(clientID);

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
        tripRequest.pilot_id = pilotID;
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

  // wait until pilot's status is set to busy or available by confirmTrip
  pilotSnapshot = await pilotRef.once("value");
  pilot = pilotSnapshot.val() as Pilot.Interface;
  while (
    pilot.status != Pilot.Status.busy &&
    pilot.status != Pilot.Status.available
  ) {
    await sleep(1);
    pilotSnapshot = await pilotRef.once("value");
    pilot = pilotSnapshot.val() as Pilot.Interface;
  }

  // if it was set to available, confirmTrip denied trip to the pilot
  if (pilot.status == Pilot.Status.available) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "trip denied to the pilot"
    );
  }

  // if it was set busy, confirmTrip indeed granted the trip to the pilot.
  if (pilot.status == Pilot.Status.busy) {
    return;
  }
};

const startTrip = async (
  _data: any,
  context: functions.https.CallableContext
) => {
  // validate authentication
  if (context.auth == null) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "Missing authentication credentials."
    );
  }

  const pilotID = context.auth.uid;

  // get a reference to pilot data
  const pilotRef = firebaseAdmin.database().ref("pilots").child(pilotID);

  // make sure the pilot's status is busy and trip's current_client_id is set correctly
  let pilotSnapshot = await pilotRef.once("value");
  let pilot = pilotSnapshot.val() as Pilot.Interface;
  if (
    pilot == null ||
    pilot.status != Pilot.Status.busy ||
    pilot.current_client_uid == undefined ||
    pilot.current_client_uid == ""
  ) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "pilot has not been requested for the trip."
    );
  }

  // get a reference to user's trip request
  const clientID = pilot.current_client_uid;
  const tr = new TripRequest(clientID);

  // set trip's status to in-progress in a transaction only if it is waiting for
  // pilot who is trying to start the trip
  await transaction(
    tr.ref,
    (tripRequest: TripRequest.Interface) => {
      if (tripRequest == null) {
        // we always check for null in transactions.
        return {};
      }

      // set trip's status only if it is waiting for our pilot
      if (
        tripRequest.trip_status == "waiting-pilot" &&
        tripRequest.pilot_id == context.auth?.uid
      ) {
        tripRequest.trip_status = TripRequest.Status.inProgress;
        return tripRequest;
      }

      // otherwise, abort
      return;
    },
    (error, completed, snapshot) => {
      // if transaction failed abnormally
      if (error) {
        throw new functions.https.HttpsError(
          "internal",
          "Something went wrong."
        );
      }

      // if there was no trip request for the user
      if (
        snapshot?.val() == {} ||
        snapshot?.val() == undefined ||
        snapshot?.val() == null
      ) {
        throw new functions.https.HttpsError(
          "not-found",
          "There is no trip request being handled by the pilot " +
            context.auth?.uid
        );
      }

      // if transaction was aborted
      if (completed == false) {
        if (snapshot?.val().trip_status != "waiting-pilot") {
          // it was aborted because trip is not in valid waiting-pilot status
          throw new functions.https.HttpsError(
            "failed-precondition",
            "cannot accept trip in status '" + snapshot?.val().trip_status + "'"
          );
        } else {
          // it was aborted because it is not waiting for our pilot_id
          throw new functions.https.HttpsError(
            "failed-precondition",
            "pilot has not been designated to this trip"
          );
        }
      }
    }
  );
};

/**
 * TODO: capture transaction
 * TODO: if it fails, flag customer as owing us money and save pastTrip ID in Client for reference
 * TODO: if payment was cash, increase amount pilot owes Venni
 * TODO: do the same things for cancellations that need to be paid.
 * TODO: modify tripRequest to make sure the customer doesn't owe us anything! Need to update frontend as well.
 * TODO: need to create a new endpoint for capture failed transactions later.
 */
const completeTrip = async (
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

  // validate arguments
  validateCompleteTripArguments(data);

  // make sure the pilot's status is busy and trip's current_client_id is set
  const pilotID = context.auth.uid;
  let p = new Pilot(pilotID);
  let pilot = await p.getPilot();
  if (
    pilot == undefined ||
    pilot.status != Pilot.Status.busy ||
    pilot.current_client_uid == undefined ||
    pilot.current_client_uid == ""
  ) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "pilot is not handling a trip."
    );
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

  // save trip with pilot_past_trip_ref_key to client's list of past trips and rate client
  if (pastTripRefKey != null) {
    trip.pilot_past_trip_ref_key = pastTripRefKey;
  }
  if (trip != undefined) {
    await c.pushPastTripAndRate(trip, data.client_rating);
  }

  // set trip's status to completed in a transaction
  await transaction(tr.ref, (tripRequest: TripRequest.Interface) => {
    if (tripRequest == null) {
      return {};
    }
    tripRequest.trip_status = TripRequest.Status.completed;
    return tripRequest;
  });
};

const ratePilot = async (
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

  // validate arguments
  validateRatePilotArguments(data);

  // make sure the trip has already been completed and by pilot with id pilotID
  // and has pilot_past_trip_ref_key field set
  const clientID: string = context.auth.uid;
  const pilotID: string = data.pilot_id;
  const tr = new TripRequest(clientID);
  const tripRequest = await tr.getTripRequest();
  if (tripRequest == undefined) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "could not find a trip request for client with id '" + clientID + "'"
    );
  }
  if (tripRequest.trip_status != TripRequest.Status.completed) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "could not find a trip request with 'completed' status for client with id '" +
        clientID +
        "'"
    );
  }
  if (tripRequest.pilot_id != pilotID) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "could not find a trip request handled by a pilot with id '" +
        pilotID +
        "' for client with id '" +
        clientID +
        "'"
    );
  }
  if (tripRequest.pilot_past_trip_ref_key == undefined) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "trip request has undefined field 'pilot_past_trip_ref_key'"
    );
  }

  // make sure pilot exists
  let p = new Pilot(pilotID);
  const pilot = await p.getPilot();
  if (pilot == undefined) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "could not find a pilot wiht id id '" + pilotID + "'"
    );
  }

  // add rating to pilot's past-trip's record of the trip
  delete data["pilot_id"];
  await p.rate(tripRequest.pilot_past_trip_ref_key, { pilot_rating: data });

  // delete trip-request after rating it, so the client can't rate the same trip twice
  await tr.remove();
};

// clientGetPastTrips returns a list of the client's past trips.
const clientGetPastTrips = async (
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

  // validate arguments
  validateClientGetPastTripsArguments(data);

  const cpt = new ClientPastTrips(context.auth.uid);
  return await cpt.getPastTrips(data?.page_size, data?.max_request_time);
};

const pilotGetTripRating = async (
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

  // validate argument
  validateArgument(
    data,
    ["pilot_id", "past_trip_ref_key"],
    ["string", "string"],
    [true, true]
  );

  // get pilot's trip
  const ppt = new PilotPastTrips(data.pilot_id);
  const trip = await ppt.getPastTrip(data.past_trip_ref_key);

  if (trip != undefined && trip.pilot_rating != undefined) {
    return { pilot_rating: trip.pilot_rating.score };
  }
  return;
};

export const request = functions.https.onCall(requestTrip);
export const edit = functions.https.onCall(editTrip);
export const client_cancel = functions.https.onCall(clientCancelTrip);
export const confirm = functions.https.onCall(confirmTrip);
export const accept = functions.https.onCall(acceptTrip);
export const start = functions.https.onCall(startTrip);
export const complete = functions.https.onCall(completeTrip);
export const rate_pilot = functions.https.onCall(ratePilot);
export const client_get_past_trips = functions.https.onCall(clientGetPastTrips);
export const pilot_get_trip_rating = functions.https.onCall(pilotGetTripRating);

// TODO: request directions to get encoded points when pilot reports his position
