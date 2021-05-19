import { Database, transaction } from ".";
import { ZoneName } from "../zones";
import { PilotPastTrips } from "./pastTrips";
import { TripRequest } from "./tripRequest";

export class Pilot extends Database {
  readonly ref: Database.Reference;
  readonly id: string;

  constructor(pilotID: string) {
    super();
    this.id = pilotID;
    this.ref = this.DB.ref("pilots").child(pilotID);
  }

  getPilot = async (): Promise<Pilot.Interface | undefined> => {
    const snapshot = await this.ref.once("value");
    return Pilot.Interface.fromObj(snapshot.val());
  };

  // freePilot sets the pilot's status to available, empties its current_client_uid,
  // and resets its idle_time to now.
  free = async () => {
    await transaction(this.ref, (pilot: Pilot.Interface) => {
      if (pilot == null) {
        return {};
      }
      pilot.status = Pilot.Status.available;
      pilot.current_client_uid = "";
      pilot.idle_since = Date.now().toString();
      return pilot;
    });
  };

  private incrementTotalTrips = async () => {
    await transaction(this.ref, (pilot: Pilot.Interface) => {
      if (pilot == null) {
        return {};
      }
      let totalTrips = 1;
      if (pilot.total_trips != undefined) {
        totalTrips += Number(pilot.total_trips);
      }
      pilot.total_trips = totalTrips.toString();
      return pilot;
    });
  };

  pushPastTrip = async (
    trip: TripRequest.Interface
  ): Promise<string | null> => {
    if (trip == undefined) {
      return null;
    }
    // push trip to past_trips
    let ppt = new PilotPastTrips(this.id);
    let refKey = await ppt.pushPastTrip(trip);

    // increase pilot's total_trips count
    await this.incrementTotalTrips();

    return refKey;
  };

  // rateObj has the following interface:
  // pilot_rating: {
  //   score: number;
  //   cleanliness_went_well?: bool;
  //   safety_went_well?: bool;
  //   waiting_time_went_well?: bool;
  //   feedback: string;
  // }
  rate = async (pastTripRefKey: string, rateObj: any) => {
    // update pilot's past trip
    const ppt = new PilotPastTrips(this.id);
    await ppt.updatePastTrip(pastTripRefKey, rateObj);

    // get pilot
    let pilot = await this.getPilot();
    if (pilot == undefined) {
      return;
    }

    // get pilot's past 200 trips
    let last200Trips = await ppt.getPastTrips(200);

    // calculate rating
    if (last200Trips != undefined) {
      let last200TotalRating = 0;
      let last200NumberOfRatings = 0;
      last200Trips.forEach((trip) => {
        if (
          trip.pilot_rating != undefined &&
          trip.pilot_rating.score != undefined
        ) {
          last200TotalRating += Number(trip.pilot_rating.score);
          last200NumberOfRatings += 1;
        }
      });

      // rating is 5 until pilot has done at least 5 trips. Then it's an average of
      // the ratings of the last 200 trips.
      let rating =
        last200Trips.length < 5
          ? 5
          : last200TotalRating / last200NumberOfRatings;
      await this.ref
        .child("rating")
        .set(((rating * 100) / 100).toFixed(2).toString());
    }
  };

  getAmountOwed = async (): Promise<number | null> => {
    return (await this.ref.child("amount_owed").once("value")).val();
  };

  // increaseAmountOwedBy uses transaction to increase amount owed by pilot by 'amount'
  increaseAmountOwedBy = async (amount: number) => {
    await transaction(this.ref, (pilot: Pilot.Interface) => {
      if (pilot == null) {
        return {};
      }
      let amountOwed = amount;
      if (pilot.amount_owed != undefined) {
        amountOwed += pilot.amount_owed;
      }
      pilot.amount_owed = amountOwed;
      return pilot;
    });
  };

  // decreaseAmountOwedBy uses transaction to decrease amount owed by pilot by 'amount'
  decreaseAmountOwedBy = async (amount: number) => {
    await this.increaseAmountOwedBy(-amount);
  };
}

export namespace Pilot {
  export enum Status {
    available = "available",
    offline = "offline", // logged out or without internet
    unavailable = "unavailable",
    busy = "busy",
    requested = "requested",
  }

  export interface DistanceToClient {
    distance_text: string;
    distance_value: number;
    duration_text: string;
    duration_value: number;
  }

  export interface Interface {
    uid: string;
    name: string;
    last_name: string;
    member_since: string;
    phone_number: string;
    current_client_uid?: string;
    current_latitude: string;
    current_longitude: string;
    current_zone: ZoneName;
    status: Status;
    vehicle: VehicleInterface;
    idle_since: string;
    rating: string; // based on last 200 trips
    total_trips?: string; // incremented when pilot completes a trip
    score?: number; // not stored in database
    // TODO: change name to route or somethign
    distance_to_client?: DistanceToClient; // not stored in database
    pagarme_receiver_id?: string; // used to identify pilot in pagarme API
    amount_owed?: number; // increased when pilot handles trip paid in cash and decreased when paid in credit_card.
  }

  export namespace Interface {
    export const fromObj = (obj: any): Pilot.Interface | undefined => {
      if (is(obj)) {
        // create pilot obj, ignoring eventual extra irrelevant fields
        return {
          uid: obj.uid,
          name: obj.name,
          last_name: obj.last_name,
          member_since: obj.member_since,
          phone_number: obj.phone_number,
          current_client_uid: obj.current_client_uid,
          current_latitude: obj.current_latitude,
          current_longitude: obj.current_longitude,
          current_zone: obj.current_zone,
          status: obj.status,
          vehicle: obj.vehicle,
          idle_since: obj.idle_since,
          rating: obj.rating,
          score: obj.score,
          total_trips: obj.total_trips,
          pagarme_receiver_id: obj.pagarme_receiver_id,
          amount_owed: obj.amount_owed,
        };
      }
      return;
    };

    export const is = (obj: any): obj is Pilot.Interface => {
      if (obj == null || obj == undefined) {
        return false;
      }
      if ("vehicle" in obj) {
        if (!VehicleInterface.is(obj.vehicle)) {
          return false;
        }
      } else {
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
        !typeCheckOptionalField("total_trips", "string") ||
        !typeCheckOptionalField("score", "number") ||
        !typeCheckOptionalField("pagarme_receiver_id", "string") ||
        !typeCheckOptionalField("amount_owed", "number")
      ) {
        return false;
      }

      return (
        "uid" in obj &&
        "name" in obj &&
        "last_name" in obj &&
        "member_since" in obj &&
        "phone_number" in obj &&
        "current_latitude" in obj &&
        "current_longitude" in obj &&
        "current_zone" in obj &&
        "status" in obj &&
        "vehicle" in obj &&
        "idle_since" in obj &&
        "rating" in obj
      );
    };
  }

  export interface VehicleInterface {
    brand: string;
    model: string;
    year: number;
    plate: string;
  }

  export namespace VehicleInterface {
    export const is = (obj: any): obj is VehicleInterface => {
      if (obj == null || obj == undefined) {
        return false;
      }
      return (
        "brand" in obj && "model" in obj && "year" in obj && "plate" in obj
      );
    };
  }
}
