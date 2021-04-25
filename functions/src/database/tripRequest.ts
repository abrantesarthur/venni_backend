import { LooseObject } from "../utils";
import { ZoneName } from "../zones";
import { Database } from "./index";

/**
 * TODO: add payment_method
 * TODO: add card_id
 *  * TODO: update its use to have these fields as well
 */

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
    waitingDriver = "waiting-driver",
    lookingForDriver = "looking-for-driver",
    noDriversAvailable = "no-drivers-available",
    inProgress = "in-progress",
    completed = "completed",
    cancelledByDriver = "cancelled-by-driver",
    cancelledByClient = "cancelled-by-client",
    paymentFailed = "payment-failed",
  }

  // export Interface member so it's accessible from TripRequest clas
  export interface Interface {
    uid: string;
    trip_status: Status;
    origin_place_id: string;
    destination_place_id: string;
    origin_zone: ZoneName;
    fare_price: string;
    distance_meters: string;
    distance_text: string;
    duration_seconds: string;
    duration_text: string;
    encoded_points: string;
    request_time: string; // number of milliseconds since 01/01/1970
    origin_address: string;
    destination_address: string;
    pilot_past_trip_ref_key?: string; // added when pilot completes the trip
    driver_id?: string;
    client_rating?: string;
    driver_rating?: DriverRating; // added to pilot's past trips when client rates the pilot
  }

  export interface DriverRating {
    score: string;
    cleanliness_went_well?: boolean;
    safety_went_well?: boolean;
    waiting_time_went_well?: boolean;
    feedback?: string;
  }

  export namespace DriverRating {
    export const is = (obj: any): obj is DriverRating => {
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
        return obj as DriverRating;
      }
      return;
    };
  }

  export namespace Interface {
    export const is = (obj: any): obj is TripRequest.Interface => {
      if (obj == null || obj == undefined) {
        return false;
      }

      if (
        obj.driver_rating != undefined &&
        !DriverRating.is(obj.driver_rating)
      ) {
        return false;
      }

      return (
        "uid" in obj &&
        "trip_status" in obj &&
        "origin_place_id" in obj &&
        "destination_place_id" in obj &&
        "origin_zone" in obj &&
        "fare_price" in obj &&
        "distance_meters" in obj &&
        "distance_text" in obj &&
        "duration_seconds" in obj &&
        "duration_text" in obj &&
        "encoded_points" in obj &&
        "request_time" in obj &&
        "origin_address" in obj &&
        "destination_address" in obj
      );
    };

    export const fromObj = (obj: any): TripRequest.Interface | undefined => {
      if (is(obj)) {
        let result: LooseObject = {};
        result = obj;
        if (obj.driver_rating != undefined) {
          result.driver_rating = DriverRating.fromObj(obj.driver_rating);
        }
        return result as TripRequest.Interface;
      }
      return;
    };
  }

  // // export UserPaymentMethod so it's accessbile from merged TripRequest class
  // enum UserPaymentMethod {
  //   cash = "cash",
  //   card = "card",
  // }
}
