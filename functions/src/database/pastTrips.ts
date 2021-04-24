import { Database } from ".";
import { TripRequest } from "./tripRequest";

export class PastTrips extends Database {
  readonly ref: Database.Reference;

  constructor(userCategory: string, uid: string) {
    super();
    this.ref = this.DB.ref("past-trips").child(userCategory).child(uid);
  }

  // getPastTripsByID returns the past trips of the client. If 'limit' is defined, it returns
  // at most 'limit' past trips. Otherwise, it returns all past trips.
  getPastTrips = async (limit?: number): Promise<TripRequest.Interface[]> => {
    let snapshot;
    if (limit != undefined && limit > 0) {
      snapshot = await this.ref.limitToFirst(limit).once("value");
    } else {
      snapshot = await this.ref.once("value");
    }
    return PastTrips.fromObjs(snapshot.val());
  };

  getPastTripsCount = async (): Promise<number> => {
    let snapshot = await this.ref.once("value");
    return snapshot.numChildren();
  };

  // pushes a trip to list of past trips, returning the reference key
  pushPastTrip = async (
    trip: TripRequest.Interface
  ): Promise<string | null> => {
    let ref = await this.ref.push(trip);
    return ref.key;
  };
}

export namespace PastTrips {
  export const fromObjs = (obj: any): TripRequest.Interface[] => {
    if (obj == null || obj == undefined) {
      return [];
    }
    let pastTrips: TripRequest.Interface[] = [];

    Object.keys(obj).forEach((key) => {
      if (TripRequest.Interface.is(obj[key])) {
        let pastTrip = TripRequest.Interface.fromObj(obj[key]);
        if (pastTrip != undefined) {
          pastTrips.push(pastTrip);
        }
      }
    });
    return pastTrips;
  };
}

export class ClientPastTrips extends PastTrips {
  constructor(clientID: string) {
    super("clients", clientID);
  }
}

export class PilotPastTrips extends PastTrips {
  constructor(pilotID: string) {
    super("pilots", pilotID);
  }
}
