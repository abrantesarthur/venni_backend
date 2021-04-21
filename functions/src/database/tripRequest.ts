import { ZoneName } from "../zones";
import { Database } from "./index";

/**
 * TODO: add payment_method
 * TODO: add card_id
 *  * TODO: update its use to have these fields as well
 */

export class TripRequest extends Database {
  readonly ref: Database.Reference;

  constructor() {
    super();
    this.ref = this.DB.ref("trip-requests");
  }

  getReferenceByID = (id: string): Database.Reference => {
    return this.ref.child(id);
  };

  getTripRequestByID = async (id: string): Promise<TripRequest.Interface> => {
    const snapshot = await this.getReferenceByID(id).once("value");
    return snapshot.val() as TripRequest.Interface;
  };

  getTripRequestByReference = async (
    ref: Database.Reference
  ): Promise<TripRequest.Interface> => {
    const snapshot = await ref.once("value");
    return snapshot.val() as TripRequest.Interface;
  };
}

// define a namespace to be merged with the TripRequest class
export namespace TripRequest {
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
    request_time: number; // number of milliseconds since 01/01/1970
    driver_id?: string;
    origin_address: string;
    destination_address: string;
  }

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

  // // export UserPaymentMethod so it's accessbile from merged TripRequest class
  // enum UserPaymentMethod {
  //   cash = "cash",
  //   card = "card",
  // }
}
