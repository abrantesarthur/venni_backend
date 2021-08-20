import * as functions from "firebase-functions";
import * as amplitude from "@amplitude/node";
import { TripRequest } from "../database/tripRequest";

export class Amplitude {
  protected _client;
  constructor() {
    this._client = amplitude.init(functions.config().amplitudeapi.key);
  }

  // 1) log where requested partners were, so we can know how far it is sending requests
  // 2) log other partner info
  logFoundNoPartner = async (
    trip: TripRequest.Interface,
    reason:
      | "partners_ignored_request"
      | "found_zero_partners"
      | "caught_exception",
    firstRequestedPartnerUID = "",
    secondRequestedPartnerUID = "",
    thirdRequestedPartnerUID = ""
  ) => {
    this._client.logEvent({
      event_type: "Found No Partner",
      user_id: "client " + trip.uid,
      event_properties: {
        clientID: "client " + trip.uid,
        originZone: "paracatu" + trip.origin_zone,
        destinationZone: "paracatu" + trip.destination_zone,
        originLatitude: Number(trip.origin_lat),
        originLongitude: Number(trip.origin_lng),
        destinationLatitude: Number(trip.destination_lat),
        destinationLongitude: Number(trip.destination_lng),
        requestTime: trip.request_time,
        confirmTime: trip.confirm_time,
        reason: reason,
        firstRequestedPartner: "partner " + firstRequestedPartnerUID,
        secondRequestedPartner: "partner " + secondRequestedPartnerUID,
        thirdRequestedPartner: "partner " + thirdRequestedPartnerUID,
      },
    });
  };

  logCompleteTrip = async (trip: TripRequest.Interface) => {
    this._client.logEvent({
      event_type: "Partner Complete Trip",
      user_id: "partner " + trip.partner_id,
      event_properties: {
        farePrice: trip.fare_price,
        paymentMethod: trip.payment_method,
        partnerRevenue:
          trip.payment_method == "cash"
            ? trip.fare_price
            : trip.payment?.partner_amount_received ??
              Math.round(0.8 * trip.fare_price),
        partnerDebtToVenni:
          trip.payment_method == "cash" ? Math.round(trip.fare_price * 0.2) : 0,
        venniRevenue:
          trip.payment_method == "credit_card"
            ? trip.fare_price -
              (trip.payment?.partner_amount_received ??
                Math.round(0.8 * trip.fare_price))
            : 0,
        venniDebtToPagarme:
          trip.payment_method == "credit_card"
            ? Math.round(0.0318 * trip.fare_price) + 44 + 13
            : 0,
        distance: Number(trip.distance_meters),
        requestTime: Number(trip.request_time),
        confirmTime: Number(trip.confirm_time),
        acceptTime: Number(trip.accept_time),
        startTime: Number(trip.start_time),
        completeTime: Number(trip.complete_time),
        expectedDuration: trip.duration_seconds,
        clientID: "client" + trip.uid,
        partnerID: "partner" + trip.partner_id,
        originZone: "paracatu" + trip.origin_zone,
        destinationZone: "paracatu" + trip.destination_zone,
        originLatitude: Number(trip.origin_lat),
        originLongitude: Number(trip.origin_lng),
        destinationLatitude: Number(trip.destination_lat),
        destinationLongitude: Number(trip.destination_lng),
      },
    });
  };
}
