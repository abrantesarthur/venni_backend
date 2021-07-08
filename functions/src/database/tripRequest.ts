import { LooseObject } from "../utils";
import { ZoneName } from "../zones";
import { Client } from "./client";
import { Database } from "./index";

export class TripRequest extends Database {
  readonly ref: Database.Reference;

  constructor(clientID: string) {
    super();
    this.ref = this.DB.ref("trip-requests").child(clientID);
  }

  getTripRequest = async (): Promise<TripRequest.Interface | undefined> => {
    const snapshot = await this.ref.once("value");
    return TripRequest.Interface.fromObj(snapshot.val());
  };

  remove = async () => {
    await this.ref.remove();
  };
}

// define a namespace to be merged with the TripRequest class
export namespace TripRequest {
  // export Status so it's accessible from merged TripRequest class
  export enum Status {
    waitingConfirmation = "waiting-confirmation",
    waitingPayment = "waiting-payment",
    waitingPartner = "waiting-partner",
    lookingForPartner = "looking-for-partner",
    noPartnersAvailable = "no-partners-available",
    inProgress = "in-progress",
    completed = "completed",
    cancelledByPartner = "cancelled-by-partner",
    cancelledByClient = "cancelled-by-client",
    paymentFailed = "payment-failed",
  }

  export namespace Status {
    export const is = (status: string) => {
      return (
        status == "waiting-confirmation" ||
        status == "waiting-payment" ||
        status == "waiting-partner" ||
        status == "looking-for-partner" ||
        status == "no-partners-available" ||
        status == "in-progress" ||
        status == "completed" ||
        status == "cancelled-by-partner" ||
        status == "cancelled-by-client" ||
        status == "payment-failed"
      );
    };
  }

  // export Interface member so it's accessible from TripRequest class
  export interface Interface {
    uid: string;
    trip_status: Status;
    origin_place_id: string;
    destination_place_id: string;
    origin_lat: string;
    origin_lng: string;
    destination_lat: string;
    destination_lng: string;
    origin_zone: ZoneName;
    fare_price: number; // in cents
    distance_meters: string;
    distance_text: string;
    duration_seconds: string;
    duration_text: string;
    encoded_points: string;
    request_time: string; // number of milliseconds since 01/01/1970
    origin_address: string;
    destination_address: string;
    partner_past_trip_ref_key?: string; // added when partner completes the trip
    partner_id?: string;
    client_rating?: string;
    partner_rating?: PartnerRating; // added to partner's past trips when client rates the partner
    payment_method?: "cash" | "credit_card"; // added when the client confirms the trip
    credit_card?: Client.Interface.Card; // added when the client confirms the trip and if paying with credit card
    transaction_id?: string; // added when the client confirms the trip and if paying with credit card to allow capturing transaction later
    payment?: Payment; // added when the partner completes (and captures) a trip paid with credit card
  }

  export interface Payment {
    success: boolean;
    venni_commission?: number;
    previous_owed_commission?: number;
    paid_owed_commission?: number;
    current_owed_commission?: number;
    partner_amount_received?: number;
  }

  export namespace Payment {
    export const is = (obj: any): obj is Payment => {
      if(obj == null || obj == undefined) {
        return false;
      }
      // type check mandatory field
      if(obj.success == undefined || typeof obj.success != "boolean") {
        return false;
      }

      // type check optional fields
      const typeCheckOptionalField = (field: string, expectedType: string) => {
        if (obj[field] != undefined && typeof obj[field] != expectedType) {
          return false;
        }
        return true;
      };
      if (
        !typeCheckOptionalField("venni_commission", "number") ||
        !typeCheckOptionalField("previous_owed_commission", "number") ||
        !typeCheckOptionalField("paid_owed_commission", "number") ||
        !typeCheckOptionalField("current_owed_commission", "number") ||
        !typeCheckOptionalField("partner_amount_received", "number")
      ) {
        return false;
      }

      return true;
    }

    export const fromObj = (obj: any) => {
      if (is(obj)) {
        return obj as Payment;
      }
      return;
    };
  }

  export interface PartnerRating {
    score: string;
    cleanliness_went_well?: boolean;
    safety_went_well?: boolean;
    waiting_time_went_well?: boolean;
    feedback?: string;
  }

  export namespace PartnerRating {
    export const is = (obj: any): obj is PartnerRating => {
      if (obj == null || obj == undefined) {
        return false;
      }
      if (obj.score == undefined) {
        return false;
      }
      let keys = Object.keys(obj);
      for (var i = 0; i < keys.length; i++) {
        if (
          keys[i] != "cleanliness_went_well" &&
          keys[i] != "safety_went_well" &&
          keys[i] != "waiting_time_went_well" &&
          keys[i] != "feedback" &&
          keys[i] != "score"
        ) {
          return false;
        }
      }
      return true;
    };

    export const fromObj = (obj: any) => {
      if (is(obj)) {
        return obj as PartnerRating;
      }
      return;
    };
  }

  export namespace Interface {
    export const is = (obj: any): obj is TripRequest.Interface => {
      if (obj == null || obj == undefined) {
        return false;
      }

      // type check required trip_status
      if (
        obj.trip_status == undefined ||
        !TripRequest.Status.is(obj.trip_status)
      ) {
        return false;
      }

      // type check required origin_zone
      if (obj.origin_zone == undefined || !ZoneName.is(obj.origin_zone)) {
        return false;
      }

      // type check required numeric fields
      const typeCheckNumericStringField = (field: string) => {
        if (
          obj[field] == undefined ||
          typeof obj[field] != "string" ||
          isNaN(parseInt(obj[field], 10)) || 
          isNaN(parseFloat(obj[field])) 
        ) {
          return false;
        }
        return true;
      };
      if (
        !typeCheckNumericStringField("distance_meters") ||
        !typeCheckNumericStringField("duration_seconds") ||
        !typeCheckNumericStringField("request_time") ||
        !typeCheckNumericStringField("origin_lat") ||
        !typeCheckNumericStringField("origin_lng") ||
        !typeCheckNumericStringField("destination_lat") ||
        !typeCheckNumericStringField("destination_lng")
      ) {
        return false;
      }

      // type check optional client_rating
      if (
        obj.client_rating != undefined &&
        (typeof obj.client_rating != "string" ||
          isNaN(parseInt(obj.client_rating, 10)))
      ) {
        return false;
      }

      // type check optional partner_rating
      if (
        obj.partner_rating != undefined &&
        !PartnerRating.is(obj.partner_rating)
      ) {
        return false;
      }

      // type check optional payment_method
      if (
        obj["payment_method"] != undefined &&
        obj["payment_method"] != "cash" &&
        obj["payment_method"] != "credit_card"
      ) {
        return false;
      }

      // type check optional credit_card
      if (
        obj.credit_card != undefined &&
        !Client.Interface.Card.is(obj.credit_card)
      ) {
        return false;
      }

      // type check optional payment
      if(obj.payment != undefined && !Payment.is(obj.payment)) {
        return false;
      }

      // type check remaining optional fields
      const typeCheckOptionalField = (field: string, expectedType: string) => {
        if (obj[field] != undefined && typeof obj[field] != expectedType) {
          return false;
        }
        return true;
      };
      if (
        !typeCheckOptionalField("partner_past_trip_ref_key", "string") ||
        !typeCheckOptionalField("partner_id", "string") ||
        !typeCheckOptionalField("client_rating", "string") ||
        !typeCheckOptionalField("transaction_id", "string")
      ) {
        return false;
      }

      // type check remaining required fields
      return (
        "uid" in obj &&
        "origin_place_id" in obj &&
        "fare_price" in obj &&
        "distance_text" in obj &&
        "duration_text" in obj &&
        "destination_place_id" in obj &&
        "origin_zone" in obj &&
        "encoded_points" in obj &&
        "origin_address" in obj &&
        "destination_address" in obj &&
        "origin_lat" in obj &&
        "origin_lng" in obj && 
        "destination_lat" in obj &&
        "destination_lng" in obj &&
        typeof obj.uid == "string" &&
        typeof obj.distance_text == "string" &&
        typeof obj.duration_text == "string" &&
        typeof obj.origin_place_id == "string" &&
        typeof obj.fare_price == "number" &&
        typeof obj.destination_place_id == "string" &&
        typeof obj.encoded_points == "string" &&
        typeof obj.origin_address == "string" &&
        typeof obj.destination_address == "string" &&
        typeof obj.origin_lat == "string" &&
        typeof obj.origin_lng == "string" &&
        typeof obj.destination_lat == "string" &&
        typeof obj.destination_lng == "string"
      );
    };

    export const fromObj = (obj: any): TripRequest.Interface | undefined => {
      if (is(obj)) {
        return obj as TripRequest.Interface;
      }
      return;
    };
  }
}
