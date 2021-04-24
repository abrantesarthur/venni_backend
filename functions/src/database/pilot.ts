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
      pilot.idle_since = Date.now();
      return pilot;
    });
  };

  private incrementTotalTrips = async () => {
    await transaction(this.ref, (pilot: Pilot.Interface) => {
      if (pilot == null) {
        return {};
      }
      let totalTrips;
      if (pilot.total_trips == undefined) {
        totalTrips = 1;
      } else {
        totalTrips = pilot.total_trips + 1;
      }
      pilot.total_trips = totalTrips;
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
    member_since: number;
    phone_number: string;
    current_client_uid?: string;
    current_latitude: number;
    current_longitude: number;
    current_zone: ZoneName;
    status: Status;
    vehicle: VehicleInterface;
    idle_since: number;
    rating: number; // based on last 500 trips
    total_trips?: number; // incremented when driver completes a trip
    score?: number; // not stored in database
    // TODO: change name to route or somethign
    distance_to_client?: DistanceToClient; // not stored in database
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
