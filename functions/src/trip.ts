import * as functions from "firebase-functions";
import * as firebaseAdmin from "firebase-admin";
import { calculateFare } from "./algorithms";
import {
  Client as GoogleMapsClient,
  DirectionsRoute,
  Language,
  TrafficModel,
  TravelMode,
} from "@googlemaps/google-maps-services-js";
import { StandardError, treatDirectionsError } from "./errors";
import { HttpsError } from "firebase-functions/lib/providers/https";
import { AsyncTimeout, sleep, LooseObject, validateArgument } from "./utils";
import { getZoneNameFromCoordinate } from "./zones";
import { TripRequest } from "./database/tripRequest";
import { Partner } from "./database/partner";
import { Client } from "./database/client";
import "./database/index";
import { transaction } from "./database/index";
import { Partners } from "./database/partners";
import { ClientPastTrips, PartnerPastTrips } from "./database/pastTrips";
import { Pagarme } from "./vendors/pagarme";
import { captureTripPayment } from "./payment";
import { DemandByZone } from "./database/demandByZone";
import { Amplitude } from "./vendors/amplitude";
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

function validateCompleteTripArguments(obj: any) {
  validateArgument(obj, ["client_rating"], ["number"], [true]);
  if (obj.client_rating > 5 || obj.client_rating < 0) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "argument client_rating must be a number between 0 and 5."
    );
  }
}

// validateRatePartnerArguments enforces PartnerRating interface
// plus partner_id
// {
//   partner_id: string;
//   score: number;
//   cleanliness_went_well?: bool;
//   safety_went_well?: bool;
//   waiting_time_went_well?: bool;
//   feedback: string;
// }
function validateRatePartnerArguments(obj: any) {
  validateArgument(
    obj,
    [
      "partner_id",
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

function validatePartnerGetPastTripsArguments(obj: any) {
  // it's ok if client passes no argument
  if (obj == undefined || obj == null) {
    return;
  }
  validateArgument(
    obj,
    ["page_size", "max_request_time", "min_request_time"],
    ["number", "number", "number"],
    [false, false, false]
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

  if (obj.min_request_time <= 0) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "argument 'min_request_time' must greater than 0."
    );
  }

  if (obj.min_request_time >= obj.max_request_time) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "argument 'max_request_time' must greater than argument 'min_request_time'."
    );
  }
}

export interface RequestTripInterface {
  origin_place_id: string;
  destination_place_id: string;
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
  validateRequestTripArguments(data);

  // make sure the client doens't have an unpaid trip
  const c = new Client(context.auth.uid);
  const client = await c.getClient();
  if (
    client == undefined ||
    (client.unpaid_past_trip_id != undefined &&
      client.unpaid_past_trip_id.length > 0)
  ) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "the client has an unpaid past trip"
    );
  }

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
      tripRequest.trip_status == TripRequest.Status.lookingForPartner ||
      tripRequest.trip_status == TripRequest.Status.waitingPartner ||
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
        mode: TravelMode.driving,
        departure_time: Date.now() + 4 * 60 * 1000, // estimate departing 4 minutes from now
        traffic_model: TrafficModel.optimistic, // optimistic so travel time is as small as possible
        alternatives: true, // so we can receive multiple routes and pick the one with the smallest fare price
        language: Language.pt_BR,
      },
    });
  } catch (e) {
    const error: StandardError = treatDirectionsError(e);
    throw new functions.https.HttpsError(error.code, error.message);
  }

  let route: DirectionsRoute;

  // if more than one route was returned
  if (directionsResponse.data.routes.length > 1) {
    // pick the one that will yield the smallest credit_card price.
    // we don't estimate based on cash price, because 'cash' prices
    // are rounded
    route = directionsResponse.data.routes.sort(
      (routeA, routeB) =>
        calculateFare(
          routeA.legs[0].distance.value,
          routeA.legs[0].duration_in_traffic != null
            ? routeA.legs[0].duration_in_traffic.value
            : routeA.legs[0].duration.value,
          "credit_card"
        ) -
        calculateFare(
          routeB.legs[0].distance.value,
          routeB.legs[0].duration_in_traffic != null
            ? routeB.legs[0].duration_in_traffic.value
            : routeB.legs[0].duration.value,
          "credit_card"
        )
    )[0];
  } else {
    // otherwise, pick the one route returned
    route = directionsResponse.data.routes[0];
  }

  // create a trip request entry in the database
  const leg = route.legs[0]; // we don't support multiple stops in same route

  const result: TripRequest.Interface = {
    uid: context.auth?.uid,
    trip_status: TripRequest.Status.waitingConfirmation,
    origin_place_id: body.origin_place_id,
    origin_zone: getZoneNameFromCoordinate(
      leg.start_location.lat,
      leg.start_location.lng
    ),
    destination_zone: getZoneNameFromCoordinate(
      leg.end_location.lat,
      leg.end_location.lng
    ),
    destination_place_id: body.destination_place_id,
    origin_lat: leg.start_location.lat.toString(),
    origin_lng: leg.start_location.lng.toString(),
    destination_lat: leg.end_location.lat.toString(),
    destination_lng: leg.end_location.lng.toString(),
    fare_price: calculateFare(
      leg.distance.value,
      leg.duration_in_traffic != undefined
        ? leg.duration_in_traffic.value
        : leg.duration.value,
      client.payment_method.default
    ),
    distance_meters: leg.distance.value.toString(),
    distance_text: leg.distance.text,
    duration_seconds: leg.duration.value.toString(),
    duration_text: leg.duration.text,
    encoded_points: route.overview_polyline.points,
    request_time: Date.now().toString(),
    origin_address: leg.start_address,
    destination_address: leg.end_address,
    partner_is_near: false,
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
      tripRequest.trip_status != TripRequest.Status.noPartnersAvailable &&
      tripRequest.trip_status != TripRequest.Status.cancelledByPartner &&
      tripRequest.trip_status != TripRequest.Status.lookingForPartner &&
      tripRequest.trip_status != TripRequest.Status.waitingPartner &&
      tripRequest.trip_status != TripRequest.Status.inProgress)
  ) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "Trip request can't be cancelled when in status '" +
        tripRequest?.trip_status +
        "'"
    );
  }

  // if a partner is handling the trip, free him to handle other trips
  const partnerID = tripRequest.partner_id;
  if (partnerID != undefined && partnerID.length > 0) {
    const p = new Partner(partnerID);
    // don't reset idle since. it's not the partner's fault and he didn't earn
    // anything here
    p.free(false);
  }

  // set trip status to cancelled-by-client
  await transaction(tr.ref, (tripRequest: TripRequest.Interface) => {
    if (tripRequest == null) {
      return {};
    }
    tripRequest.trip_status = TripRequest.Status.cancelledByClient;
    tripRequest.partner_id = "";
    tripRequest.client_cancel_time = Date.now().toString();
    return tripRequest;
  });

  // return updated trip-request to client
  return await tr.getTripRequest();
};

const partnerCancelTrip = async (
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

  // get partner
  const partnerID = context.auth.uid;
  const p = new Partner(partnerID);
  const partner = await p.getPartner();
  // make sure partner exists
  if (partner == undefined) {
    throw new functions.https.HttpsError(
      "not-found",
      "could not find partner with uid " + partnerID
    );
  }
  // make sure partner is handling a trip
  if (
    partner.current_client_uid == undefined ||
    partner.current_client_uid == "" ||
    partner.status != Partner.Status.busy
  ) {
    throw new functions.https.HttpsError(
      "not-found",
      "partner with uid " + partnerID + " it not handling any trip"
    );
  }

  // get trip request
  const clientID = partner.current_client_uid;
  const tr = new TripRequest(clientID);
  const tripRequest = await tr.getTripRequest();

  // trip must be in a valid status to be cancelled
  if (
    tripRequest == null ||
    tripRequest == undefined ||
    (tripRequest.trip_status != TripRequest.Status.waitingPartner &&
      tripRequest.trip_status != TripRequest.Status.inProgress)
  ) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "Trip request can't be cancelled when in status '" +
        tripRequest?.trip_status +
        "'"
    );
  }

  // free the partner to handle other trips and reset his idle_since
  await p.free();

  // set trip status to cancelled-by-partner
  await transaction(tr.ref, (tripRequest: TripRequest.Interface) => {
    if (tripRequest == null) {
      return {};
    }
    tripRequest.trip_status = TripRequest.Status.cancelledByPartner;
    tripRequest.partner_id = "";
    tripRequest.partner_cancel_time = Date.now().toString();
    return tripRequest;
  });

  // notify client about cancellation
  const c = new Client(clientID);
  let client = await c.getClient();
  if (
    client != undefined &&
    client.fcm_token != undefined &&
    client.fcm_token.length > 0
  ) {
    try {
      await firebaseAdmin.messaging().sendToDevice(client.fcm_token, {
        notification: {
          title: "Corrida cancelada",
          body: "O(a) piloto cancelou a corrida",
          badge: "0",
          sound: "default",
        },
      });
    } catch (_) {}
  }

  // return updated trip-request to partner
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

  // get a reference to the user's trip request and partner_id
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
    tripRequest.trip_status != TripRequest.Status.waitingConfirmation &&
    tripRequest.trip_status != TripRequest.Status.paymentFailed &&
    tripRequest.trip_status != TripRequest.Status.noPartnersAvailable &&
    tripRequest.trip_status != TripRequest.Status.lookingForPartner &&
    tripRequest.trip_status != TripRequest.Status.cancelledByPartner
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

  // see whether user is trying again after not having found a partner
  // so we can properly use findAllAvailable
  let tryingToFindPartnersAgain = false;
  if (tripRequest.trip_status == TripRequest.Status.noPartnersAvailable) {
    tryingToFindPartnersAgain = true;
  }

  // variable that will store promises to await all before returning
  let promises: Promise<any>[] = [];

  // change trip-request status to waiting-payment
  // important: only use set to modify trip request values befores sending
  // requests to partners. Use only transactions after that, because partners
  // use transactions to modify trip request, and us using set would
  // cancel their transactions.
  tripRequest.trip_status = TripRequest.Status.waitingPayment;
  // also, set confirm_time already
  tripRequest.confirm_time = Date.now().toString();
  promises.push(tr.ref.set(tripRequest));

  // make sure client exists
  const c = new Client(context.auth.uid);
  let client = await c.getClient();
  if (client == undefined) {
    tripRequest.trip_status = TripRequest.Status.waitingConfirmation;
    promises.push(tr.ref.set(tripRequest));
    await Promise.all(promises);
    throw new functions.https.HttpsError(
      "failed-precondition",
      "Could not find client with id '" + context.auth.uid + "'"
    );
  }

  // make sure that 'card_id', if specified, corresponds to existing card
  let creditCard = await c.getCardByID(data.card_id);
  if (data.card_id != undefined && creditCard == undefined) {
    tripRequest.trip_status = TripRequest.Status.paymentFailed;
    promises.push(tr.ref.set(tripRequest));
    await Promise.all(promises);
    throw new functions.https.HttpsError(
      "failed-precondition",
      "Could not find card with id '" + data.card_id + "'."
    );
  }

  // define payment method before looking for partners, so we can properly
  // disconsider partners without a pagarme_recipient_id in case client is
  // paying with a 'credit_card'
  if (creditCard == undefined) {
    tripRequest.payment_method = "cash";
  } else {
    tripRequest.payment_method = "credit_card";
  }
  await tr.ref.set(tripRequest);

  // push its confirmation timestamp to the appropriate demand-by-zone/{zoneName} path
  const dbz = new DemandByZone();
  promises.push(
    dbz.pushTripTimestampToZone(Date.now(), tripRequest.origin_zone)
  );
  // change trip-request status to lookingForPartner
  tripRequest.trip_status = TripRequest.Status.lookingForPartner;
  promises.push(tr.ref.set(tripRequest));

  // search available partners nearby client
  let nearbyPartners: Partner.Interface[];
  let ps = new Partners();
  const a = new Amplitude();
  try {
    nearbyPartners = await ps.findAllAvailable(
      tripRequest,
      tryingToFindPartnersAgain
    );
  } catch (e) {
    let error: HttpsError = e as HttpsError;
    // if failed to find partners, update trip-request status to no-partners-available
    tripRequest.trip_status = TripRequest.Status.noPartnersAvailable;
    promises.push(tr.ref.set(tripRequest));

    // log 'Found No Partner' event
    promises.push(a.logFoundNoPartner(tripRequest, "caught_exception"));

    await Promise.all(promises);
    throw new functions.https.HttpsError(error.code, error.message);
  }

  // if didn't find partners, update trip-reqeust status to noPartnersAvailable and throw exception
  if (nearbyPartners.length == 0) {
    // TODO: test this too!
    tripRequest.trip_status = TripRequest.Status.noPartnersAvailable;
    promises.push(tr.ref.set(tripRequest));
    promises.push(a.logFoundNoPartner(tripRequest, "found_zero_partners"));
    await Promise.all(promises);
    throw new functions.https.HttpsError(
      "failed-precondition",
      "There are no available partners. Try again later."
    );
  }

  // create a transaction to be captured later if paying wiht a credit card
  let paymentFailed = false;
  let pagarmeError : any;
  const p = new Pagarme();
  await p.ensureInitialized();
  if (creditCard != undefined && tripRequest.payment_method == "credit_card") {
    try {
      // create a transaction to be captured later. Note that this transaction is cancelled
      // if trip confirmation fails.
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
        tripRequest.credit_card = creditCard;
        tripRequest.transaction_id = transaction.tid.toString();
        await tr.ref.set(tripRequest);
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

  // variable that will hold list of partners who received trip request
  let requestedPartnersUIDs: string[] = [];

  // reference to partners
  const partnersRef = firebaseAdmin.database().ref("partners");

  // requestPartner is the callback used to update partners' statuses to requested.
  // it tires to set availablePartner's status to 'requested' and current_client_id to client's uid
  const requestPartner = (partner: Partner.Interface) => {
    if (partner == null) {
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
      partner.status == Partner.Status.available &&
      (partner.current_client_uid == undefined ||
        partner.current_client_uid == "")
    ) {
      // if partner is still available, change its status to 'requested'
      // and current_client_uid to uid of client making requests.
      // each partner has 10 seconds to reply on their end.
      // they will use the current_client_uid to find the trip-request entry for the
      // client and try updating its partner_id field.
      partner.status = Partner.Status.requested;
      partner.current_client_uid = context.auth?.uid;

      // mark partner as requested.
      requestedPartnersUIDs.push(partner.uid);

      return partner;
    } else {
      // abort transaction if partner is no longer available
      return;
    }
  };

  // unrequestPartner undoes what requestPartner does.
  const unrequestPartner = (partner: Partner.Interface) => {
    if (partner == null) {
      // we always check for null. Read comments above for explanation.
      return {};
    }
    if (
      partner.status == "requested" &&
      partner.current_client_uid == context.auth?.uid
    ) {
      // if partner was requested to this trip, cancel request.
      partner.status = Partner.Status.available;
      partner.current_client_uid = "";
      return partner;
    }
    // abort transaction in other cases
    return;
  };

  // cancelRequest is a callback that is triggered if partners fail
  // to accept a trip in 40 seconds. It stops listening for their responses
  // and unrequests them, setting their statuses back to available.
  const cancelRequest = async () => {
    // when timeout expires, stop listening for changes in partner_id
    tr.ref.off("value");

    const j = requestedPartnersUIDs.length;
    for (var i = 0; i < j; i++) {
      // set status of partners who failed to pick trip back to available
      promises.push(
        partnersRef
          .child(requestedPartnersUIDs[0])
          .transaction(unrequestPartner)
      );

      // remove partner from list of requested partners.
      requestedPartnersUIDs = requestedPartnersUIDs.slice(1);
    }

    if (tripRequest != undefined) {
      // set tripRequest status to noPartnersAvailable
      tripRequest.trip_status = TripRequest.Status.noPartnersAvailable;
      //if payment was through credit card
      if (
        tripRequest.payment_method == "credit_card" &&
        tripRequest.transaction_id != undefined
      ) {
        try {
          // try issuing refund
          await p.refundTransaction(Number(tripRequest.transaction_id));
        } catch (e) {
          // it's ok if refund fails. Transaction will be automatically canceled in 5 days
          console.log(e);
        }
        tripRequest.transaction_id = "";
      }
      promises.push(tr.ref.set(tripRequest));

      // log event
      promises.push(
        a.logFoundNoPartner(
          tripRequest,
          "partners_ignored_request",
          nearbyPartners.length >= 1 ? nearbyPartners[0].uid : "",
          nearbyPartners.length >= 2 ? nearbyPartners[1].uid : "",
          nearbyPartners.length >= 3 ? nearbyPartners[2].uid : ""
        )
      );
    }

    await Promise.all(promises);

    // wait a bit to make sure all states are persisted
    await sleep(300);

    // send failure response back
    throw new functions.https.HttpsError(
      "deadline-exceeded",
      "No partner accepted trip request."
    );
  };

  // start listening for changes in trip request's partner_id before actually
  // sending requests to partners. Have  with 30 seconds timeout to account for
  // time to send all requests and for partners to accept them.
  // partners are listening for changes in their 'status'. When they see its value
  // change to 'requested' they can accept the trip by sending an accept-trip request
  // which will update the trip-request's partner_id field with the uid of the partner.
  // we detect that change to partner_id here. We continue listening until we call
  // tr.ref.off()
  let cancelFurtherPartnerRequests = false;
  let asyncTimeout = new AsyncTimeout();
  let timeoutPromise = asyncTimeout.set(cancelRequest, 40000);
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
    // if one of the partners accepts the trip, they will call accept-trip which
    // will update the trip's partner_id with the id of the accepting partner
    if (trip.partner_id != undefined && trip.partner_id.length > 0) {
      // make sure the partner_id belongs to one for the nearby partners
      let isValidPartnerID = false;
      nearbyPartners.forEach((nearbyPartner) => {
        if (nearbyPartner.uid == trip.partner_id) {
          isValidPartnerID = true;
        }
      });
      if (!isValidPartnerID) {
        // clear partner_id so other partners have the chance of claiming the trip
        promises.push(
          tr.ref.transaction((tripRequest: TripRequest.Interface) => {
            if (tripRequest == null) {
              return {};
            }
            tripRequest.partner_id = "";
            return tripRequest;
          })
        );
        // abort and continue listening for changes
        return;
      }

      // if partner_id does belong to a nearby partner, clear timeout
      // so we no longer execute cancelRequests
      asyncTimeout.clear();

      // stop sending requests to more partners;
      cancelFurtherPartnerRequests = true;

      // stop listening for changes in partner_id
      tr.ref.off("value");

      // set status of partner who successfully picked the ride to busy.
      // and current_client_id to the id of requesting client. Also, set
      // confirmTripResponse, which will be returned to the client later.
      promises.push(
        partnersRef
          .child(trip.partner_id)
          .transaction((partner: Partner.Interface) => {
            if (partner == null) {
              // always check for null on transactoins
              return {};
            }

            partner.status = Partner.Status.busy;
            partner.current_client_uid = context.auth?.uid;

            // populate final confirmTrip response with data from partner
            confirmTripResponse.partner_id = partner.uid;
            confirmTripResponse.partner_name = partner.name;
            confirmTripResponse.partner_last_name = partner.last_name;
            confirmTripResponse.partner_total_trips =
              partner.total_trips == undefined ? "0" : partner.total_trips;
            confirmTripResponse.partner_member_since = partner.member_since;
            confirmTripResponse.partner_phone_number = partner.phone_number;
            confirmTripResponse.current_client_uid = partner.current_client_uid;
            confirmTripResponse.partner_current_latitude =
              partner.current_latitude;
            confirmTripResponse.partner_current_longitude =
              partner.current_longitude;
            confirmTripResponse.partner_current_zone = partner.current_zone;
            confirmTripResponse.partner_status = partner.status;
            confirmTripResponse.partner_vehicle = partner.vehicle;
            confirmTripResponse.partner_idle_since = partner.idle_since;
            confirmTripResponse.partner_rating = partner.rating;
            // update partner in database
            return partner;
          })
      );

      // set trip_status to waiting-partner. this is how the client knows that
      // confirm-trip was successful. Also, set accept_time.
      promises.push(
        tr.ref.transaction((tripRequest: TripRequest.Interface) => {
          if (tripRequest == null) {
            return {};
          }
          tripRequest.trip_status = TripRequest.Status.waitingPartner;
          tripRequest.accept_time = Date.now().toString();
          return tripRequest;
        })
      );
    }
  });

  // send request to each partner after we start listening for partner_id changes
  for (var i = 0; i < nearbyPartners.length; i++) {
    if (cancelFurtherPartnerRequests) {
      // in case we hear a valid partner_id, the listener callback will cancel
      // further requests by setting this variable, so we abort loop.
      break;
    }

    promises.push(
      // request partners and notify them on success
      partnersRef
        .child(nearbyPartners[i].uid)
        .transaction(requestPartner, async (_, completed, snapshot) => {
          if (completed) {
            let partner: Partner.Interface = snapshot?.val();
            if (
              partner != undefined &&
              partner.fcm_token != undefined &&
              partner.fcm_token.length > 0
            ) {
              try {
                await firebaseAdmin
                  .messaging()
                  .sendToDevice(partner?.fcm_token ?? "", {
                    notification: {
                      title: "Novo pedido de corrida",
                      body: "Abra o aplicativo para aceitar",
                      badge: "0",
                      sound: "default",
                    },
                  });
              } catch (e) {}
            }
          }
        })
    );

    // wait 10 seconds before request next partner. This way, each partner has ~10 seconds
    // to accept request, before it is sent to another partner. Don't wait after
    // runnign transactoin for last partner, though. In case cancelFurtherPartnerRequests
    // is set to true, we stop waiting.
    if (i != nearbyPartners.length - 1) {
      let msPassed = 0;
      do {
        await sleep(1);
        if (cancelFurtherPartnerRequests) {
          break;
        }
        msPassed += 1;
      } while (msPassed < 10000);
    }
  }

  // wait for timeout to end or for rider to accept trip, thus clearing timeout
  // and resolving timeoutPromise
  await timeoutPromise;

  // we want to return from confirmTrip only after trip_status has reached its final
  // state. If timeoutPromse was cleared, this may not be the case yet. If clear()
  // is called late enough but before timeout goes off, the code will already be waiting for
  // timeoutPromise. This way, as soon as clear() is called, confirmTrip returns
  // before the listener has time to update status to waitingPartner. That's why we
  // wait here until waitingPartner state is reached.
  if (asyncTimeout.wasCleared) {
    // listen for trip status and only continue when it has waiting-partner status
    // we want to exit confirmTrip if trip having its final status
    do {
      await sleep(1);
      tripRequest = await tr.getTripRequest();
    } while (
      tripRequest == null ||
      tripRequest == undefined ||
      tripRequest.trip_status != "waiting-partner"
    );
    // important: sleep a bit to guarantee that waiting-partner status is persisted
    await sleep(300);

    // for partners who were requested but accepted too late, set status to available
    // and clear current_client_id as long as its status equals requested and current_client_id
    // equals the client's uuid. This means it received our request, didn't respond in time,
    // and didn't reset the partner's status.
    const j = requestedPartnersUIDs.length;
    for (var i = 0; i < j; i++) {
      promises.push(
        partnersRef
          .child(requestedPartnersUIDs[0])
          .transaction(unrequestPartner)
      );

      // remove partner from list of requested partners.
      requestedPartnersUIDs = requestedPartnersUIDs.slice(1);
    }

    // respond with confirmTripResponse, which should be already set by this point, but we await
    // just to be sure.
    do {
      await sleep(1);
    } while (confirmTripResponse == undefined);
    // pupulate response with trip status
    confirmTripResponse.trip_status = tripRequest.trip_status;

    await Promise.all(promises);

    // notify client that partner is on his way
    if (client.fcm_token != undefined && client.fcm_token.length > 0) {
      try {
        await firebaseAdmin.messaging().sendToDevice(client.fcm_token ?? "", {
          notification: {
            title: "Piloto a caminho",
            body: "Dirija-se ao local de encontro",
            badge: "0",
            sound: "default",
            icon: "notification_icon.png",
          },
        });
      } catch (_) {}
    }

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

const acceptTrip = async (_: any, context: functions.https.CallableContext) => {
  // validate authentication
  if (context.auth == null) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "Missing authentication credentials."
    );
  }

  const partnerID = context.auth.uid;

  // get a reference to partner data
  const partnerRef = firebaseAdmin.database().ref("partners").child(partnerID);

  // make sure the partner's status is requested and trip's current_client_id is set
  let partnerSnapshot = await partnerRef.once("value");
  let partner = partnerSnapshot.val() as Partner.Interface;
  if (
    partner == null ||
    partner.status != Partner.Status.requested ||
    partner.current_client_uid == undefined ||
    partner.current_client_uid == ""
  ) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "partner has not been requested for trip or trip has already been picked."
    );
  }

  // get a reference to user's trip request
  const tr = new TripRequest(partner.current_client_uid);

  // set trip's partner_id in a transaction only if it is null or empty. Otherwise,
  // it means another partner already picked the trip ahead of us. Abort transaction in that case.
  await transaction(tr.ref, (tripRequest: TripRequest.Interface) => {
    if (tripRequest == null) {
      // we always check for null in transactions.
      return {};
    }

    // if trip has not been picked up by another partner
    if (tripRequest.partner_id == null || tripRequest.partner_id == "") {
      // set trip's partner_id in a transaction only if it is null or empty.
      tripRequest.partner_id = partnerID;
      return tripRequest;
    }

    // otherwise, abort
    return;
  });

  // at this point, confirmTrip will set partner's status to either busy or available,
  // depending on whether partner was succesfull at accepting the trip or not. It's the
  // client's responsibility to listen for that status change.
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

  const partnerID = context.auth.uid;

  // get a reference to partner data
  const partnerRef = firebaseAdmin.database().ref("partners").child(partnerID);

  // make sure the partner's status is busy and trip's current_client_id is set correctly
  let partnerSnapshot = await partnerRef.once("value");
  let partner = partnerSnapshot.val() as Partner.Interface;
  if (
    partner == null ||
    partner.status != Partner.Status.busy ||
    partner.current_client_uid == undefined ||
    partner.current_client_uid == ""
  ) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "partner has not been requested for the trip."
    );
  }

  // get a reference to user's trip request
  const clientID = partner.current_client_uid;
  const tr = new TripRequest(clientID);

  // set trip's status to in-progress in a transaction only if it is waiting for
  // partner who is trying to start the trip. Also set start_time property
  await transaction(
    tr.ref,
    (tripRequest: TripRequest.Interface) => {
      if (tripRequest == null) {
        // we always check for null in transactions.
        return {};
      }

      // set trip's status only if it is waiting for our partner.
      // also set its start_time property
      if (
        tripRequest.trip_status == "waiting-partner" &&
        tripRequest.partner_id == context.auth?.uid
      ) {
        tripRequest.trip_status = TripRequest.Status.inProgress;
        tripRequest.start_time = Date.now().toString();
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
          "There is no trip request being handled by the partner " +
            context.auth?.uid
        );
      }

      // if transaction was aborted
      if (completed == false) {
        if (snapshot?.val().trip_status != "waiting-partner") {
          // it was aborted because trip is not in valid waiting-partner status
          throw new functions.https.HttpsError(
            "failed-precondition",
            "cannot accept trip in status '" + snapshot?.val().trip_status + "'"
          );
        } else {
          // it was aborted because it is not waiting for our partner_id
          throw new functions.https.HttpsError(
            "failed-precondition",
            "partner has not been designated to this trip"
          );
        }
      }
    }
  );
};

/**
 * TODO: do similar capturing for cancellations that need to be paid.
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

  // save complete time in a variable to be used later
  const completeTime = Date.now().toString();

  // make sure the partner's status is busy and trip's current_client_id is set
  const partnerID = context.auth.uid;
  let p = new Partner(partnerID);
  let partner = await p.getPartner();
  if (
    partner == undefined ||
    partner.status != Partner.Status.busy ||
    partner.current_client_uid == undefined ||
    partner.current_client_uid == ""
  ) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "partner is not handling a trip."
    );
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
  if (
    trip.payment_method == "credit_card" &&
    trip.transaction_id != undefined
  ) {
    // if payment is through credit card, capture payment
    let cpt = await captureTripPayment(trip);
    captureSucceeded = cpt.success;
    // add capture payment information to trip
    trip.payment = cpt;
  } else {
    // if payment is cash, increase amount partner owes venni by 20% of fare price
    await p.increaseAmountOwedBy(Math.ceil(0.15 * trip.fare_price));
  }

  // free the partner to handle other trips
  await p.free();

  // add trip with completed status to partner's list of past trips
  trip.trip_status = TripRequest.Status.completed;
  trip.complete_time = completeTime;
  let partnerPastTripRefKey = await p.pushPastTrip(trip);

  // save past trip's reference key in trip request's partner_past_trip_ref_key
  // this is so the client can retrieve it later when rating the partner. Also,
  // add payment info and complete_time to it
  await transaction(tr.ref, (tripRequest: TripRequest.Interface) => {
    if (tripRequest == null) {
      return {};
    }
    if (partnerPastTripRefKey != null) {
      tripRequest.partner_past_trip_ref_key = partnerPastTripRefKey;
    }
    if (trip?.payment != undefined) {
      // TODO: test
      tripRequest.payment = trip.payment;
    }
    tripRequest.complete_time = completeTime;
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

  // save trip with partner_past_trip_ref_key to client's list of past trips and rate client
  if (partnerPastTripRefKey != null) {
    trip.partner_past_trip_ref_key = partnerPastTripRefKey;
  }
  if (trip != undefined) {
    let clientPastTripRefKey = await c.pushPastTripAndRate(
      trip,
      data.client_rating
    );
    // if credit card payment failed
    if (!captureSucceeded && clientPastTripRefKey != null) {
      // flag customer as owing us money
      await c.setUnpaidTrip(clientPastTripRefKey);
    }
  }

  let promises: Promise<any>[] = [];

  // set trip's status to completed in a transaction. Also set complete_time
  promises.push(
    transaction(tr.ref, (tripRequest: TripRequest.Interface) => {
      if (tripRequest == null) {
        return {};
      }
      tripRequest.trip_status = TripRequest.Status.completed;
      tripRequest.complete_time = completeTime;
      return tripRequest;
    })
  );

  // notify the client to rate trip
  if (client.fcm_token != undefined && client.fcm_token.length > 0) {
    promises.push(
      firebaseAdmin.messaging().sendToDevice(client.fcm_token, {
        notification: {
          title: "Corrida finalizada",
          body: "Avalie a sua experiência",
          badge: "0",
          sound: "default",
        },
      })
    );
  }

  // log event to amplitude
  const a = new Amplitude();
  promises.push(a.logCompleteTrip(trip));

  try {
    await Promise.all(promises);
  } catch (_) {}
};

const ratePartner = async (
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
  validateRatePartnerArguments(data);

  // make sure the trip has already been completed and by partner with id partnerID
  // and has partner_past_trip_ref_key field set
  const clientID: string = context.auth.uid;
  const partnerID: string = data.partner_id;
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
  if (tripRequest.partner_id != partnerID) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "could not find a trip request handled by a partner with id '" +
        partnerID +
        "' for client with id '" +
        clientID +
        "'"
    );
  }
  if (tripRequest.partner_past_trip_ref_key == undefined) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "trip request has undefined field 'partner_past_trip_ref_key'"
    );
  }

  // make sure partner exists
  let p = new Partner(partnerID);
  const partner = await p.getPartner();
  if (partner == undefined) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "could not find a partner wiht id id '" + partnerID + "'"
    );
  }

  // add rating to partner's past-trip's record of the trip
  delete data["partner_id"];
  await p.rate(tripRequest.partner_past_trip_ref_key, { partner_rating: data });

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

// partnerGetPastTrips returns a list of the client's past trips.
const partnerGetPastTrips = async (
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
  validatePartnerGetPastTripsArguments(data);

  const ppt = new PartnerPastTrips(context.auth.uid);
  return await ppt.getPastTrips(
    data?.page_size,
    data?.max_request_time,
    data?.min_request_time
  );
};

// clientGetPastTrips returns the past trip specified by id
const clientGetPastTrip = async (
  data: any,
  context: functions.https.CallableContext
) => {
  // do validations
  if (context.auth == null) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "Missing authentication credentials."
    );
  }
  validateArgument(data, ["past_trip_id"], ["string"], [true]);

  const cpt = new ClientPastTrips(context.auth.uid);
  return await cpt.getPastTrip(data.past_trip_id);
};

const partnerGetTripRating = async (
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
    ["partner_id", "past_trip_ref_key"],
    ["string", "string"],
    [true, true]
  );

  // get partner's trip
  const ppt = new PartnerPastTrips(data.partner_id);
  const trip = await ppt.getPastTrip(data.past_trip_ref_key);

  if (trip != undefined && trip.partner_rating != undefined) {
    return { partner_rating: trip.partner_rating.score };
  }
  return;
};

const partnerGetCurrentTrip = async (
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

  // make sure partner has an active trip request
  const partnerID = context.auth.uid;
  const p = new Partner(partnerID);
  const partner = await p.getPartner();
  if (partner == undefined) {
    throw new functions.https.HttpsError(
      "not-found",
      "Could not find partner with uid " + partnerID
    );
  }
  if (
    (partner.status != Partner.Status.requested &&
      partner.status != Partner.Status.busy) ||
    partner.current_client_uid == undefined ||
    partner.current_client_uid == ""
  ) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "The partner with uid " +
        partnerID +
        " does not have any current trip requests"
    );
  }

  // get partner's current trip
  const clientID = partner.current_client_uid;
  const tr = new TripRequest(clientID);
  const trip = await tr.getTripRequest();
  if (trip == null || trip == undefined) {
    throw new functions.https.HttpsError(
      "not-found",
      "Could not find the current trip of the partner with uid " + partnerID
    );
  }

  // get information about client who requested the trip
  let client;
  try {
    client = await firebaseAdmin.auth().getUser(trip.uid);
  } catch (e) {
    throw new functions.https.HttpsError(
      "not-found",
      "Could not find the client who requested the trip of the partner with uid " +
        partnerID
    );
  }

  let response: LooseObject = trip;
  response["client_name"] = client.displayName;
  response["client_phone"] = client.phoneNumber;

  return response;
};

const clientGetCurrentTrip = async (
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

  // get client's current trip
  const clientID = context.auth.uid;
  const tr = new TripRequest(clientID);
  const trip = await tr.getTripRequest();
  if (trip == null || trip == undefined) {
    throw new functions.https.HttpsError(
      "not-found",
      "the client has no current trip requests"
    );
  }
  return trip;
};

export const request = functions.https.onCall(requestTrip);
export const edit = functions.https.onCall(editTrip);
export const client_cancel = functions.https.onCall(clientCancelTrip);
export const partner_cancel = functions.https.onCall(partnerCancelTrip);
export const confirm = functions.https.onCall(confirmTrip);
export const accept = functions.https.onCall(acceptTrip);
export const start = functions.https.onCall(startTrip);
export const complete = functions.https.onCall(completeTrip);
export const rate_partner = functions.https.onCall(ratePartner);
export const client_get_past_trips = functions.https.onCall(clientGetPastTrips);
export const partner_get_past_trips =
  functions.https.onCall(partnerGetPastTrips);
export const partner_get_trip_rating =
  functions.https.onCall(partnerGetTripRating);
export const client_get_past_trip = functions.https.onCall(clientGetPastTrip);
export const partner_get_current_trip = functions.https.onCall(
  partnerGetCurrentTrip
);
export const client_get_current_trip =
  functions.https.onCall(clientGetCurrentTrip);
