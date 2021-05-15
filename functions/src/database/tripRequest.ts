import { LooseObject } from "../utils";
import { ZoneName } from "../zones";
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
    waitingPilot = "waiting-pilot",
    lookingForPilot = "looking-for-pilot",
    noPilotsAvailable = "no-pilots-available",
    inProgress = "in-progress",
    completed = "completed",
    cancelledByPilot = "cancelled-by-pilot",
    cancelledByClient = "cancelled-by-client",
    paymentFailed = "payment-failed",
  }

  export namespace Status {
    export const is = (status: string) => {
      return (
        status == "waiting-confirmation" ||
        status == "waiting-payment" ||
        status == "waiting-pilot" ||
        status == "looking-for-pilot" ||
        status == "no-pilots-available" ||
        status == "in-progress" ||
        status == "completed" ||
        status == "cancelled-by-pilot" ||
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
    pilot_past_trip_ref_key?: string; // added when pilot completes the trip
    pilot_id?: string;
    client_rating?: string;
    pilot_rating?: PilotRating; // added to pilot's past trips when client rates the pilot
    payment_method?: "cash" | "credit_card"; // added when the client confirms the trip
    card_id?: string; // added when the client confirms the trip and if paying with credit card
    transaction_id?: string; // added when the client confirms the trip and if paying with credit card to allow capturing transaction later
  }

  export interface PilotRating {
    score: string;
    cleanliness_went_well?: boolean;
    safety_went_well?: boolean;
    waiting_time_went_well?: boolean;
    feedback?: string;
  }

  export namespace PilotRating {
    export const is = (obj: any): obj is PilotRating => {
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
        return obj as PilotRating;
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
          isNaN(parseInt(obj[field], 10))
        ) {
          return false;
        }
        return true;
      };
      if (
        !typeCheckNumericStringField("distance_meters") ||
        !typeCheckNumericStringField("duration_seconds") ||
        !typeCheckNumericStringField("request_time")
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

      // type check optional pilot_rating
      if (obj.pilot_rating != undefined && !PilotRating.is(obj.pilot_rating)) {
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

      // type check remaining optional fields
      const typeCheckOptionalField = (field: string, expectedType: string) => {
        if (obj[field] != undefined && typeof obj[field] != expectedType) {
          return false;
        }
        return true;
      };
      if (
        !typeCheckOptionalField("pilot_past_trip_ref_key", "string") ||
        !typeCheckOptionalField("pilot_id", "string") ||
        !typeCheckOptionalField("client_rating", "string") ||
        !typeCheckOptionalField("card_id", "string") ||
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
        typeof obj.uid == "string" &&
        typeof obj.distance_text == "string" &&
        typeof obj.duration_text == "string" &&
        typeof obj.origin_place_id == "string" &&
        typeof obj.fare_price == "number" &&
        typeof obj.destination_place_id == "string" &&
        typeof obj.encoded_points == "string" &&
        typeof obj.origin_address == "string" &&
        typeof obj.destination_address == "string"
      );
    };

    export const fromObj = (obj: any): TripRequest.Interface | undefined => {
      if (is(obj)) {
        let result: LooseObject = {};
        result = obj;
        if (obj.pilot_rating != undefined) {
          result.pilot_rating = PilotRating.fromObj(obj.pilot_rating);
        }
        return result as TripRequest.Interface;
      }
      return;
    };
  }
}
