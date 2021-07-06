import { Database } from ".";
import { TripRequest } from "./tripRequest";

export class PastTrips extends Database {
  readonly ref: Database.Reference;

  constructor(userCategory: string, uid: string) {
    super();
    this.ref = this.DB.ref("past-trips").child(userCategory).child(uid);
  }

  // updatePastTrip updates past trip with values
  updatePastTrip = async (key: string, values: Object) => {
    let snapshot = await this.ref.child(key).once("value");
    // abort if trip does not exist
    if (snapshot.val() == null) {
      return;
    }
    // otherwise, update trip with values
    await this.ref.child(key).update(values);
  };

  // getPastTrips returns the past trips of the user sorted by request time in descending order.
  // That is, most recent trips come first. If 'limit' is defined, it returns at most 'limit' past trips.
  // If 'maxVal' is defined, it returns trips whose request_time is less than 'maxVal'.
  // By default, it returns all past trips.
  getPastTrips = async (
    limit?: number,
    maxVal?: number
  ): Promise<TripRequest.Interface[]> => {
    let query = this.ref.orderByChild("request_time");
    if (maxVal != undefined) {
      query = query.endAt(maxVal.toString());
    }
    if (limit != undefined && limit > 0) {
      query = query.limitToLast(limit);
    }
    let snapshot = await query.once("value");
    let pastTrips = PastTrips.fromObjs(snapshot.val());

    // more recent trips have the greatest request_time values
    return pastTrips.reverse();
  };

  getPastTrip = async (
    ref_key: string
  ): Promise<TripRequest.Interface | undefined> => {
    let snapshot = await this.ref.child(ref_key).once("value");
    return TripRequest.Interface.fromObj(snapshot.val());
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

export class PartnerPastTrips extends PastTrips {
  constructor(partnerID: string) {
    super("partners", partnerID);
  }
}
