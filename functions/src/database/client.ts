import { Database } from "./index";
import { TripRequest } from "./tripRequest";

export class Client extends Database {
  readonly ref: Database.Reference;

  constructor() {
    super();
    this.ref = this.DB.ref("clients");
  }

  getReferenceByID = (id: string): Database.Reference => {
    return this.ref.child(id);
  };

  getClientByID = async (id: string): Promise<Client.Interface | undefined> => {
    const snapshot = await this.getReferenceByID(id).once("value");
    return Client.Interface.fromObj(snapshot.val());
  };

  getClientByReference = async (
    ref: Database.Reference
  ): Promise<Client.Interface | undefined> => {
    const snapshot = await ref.once("value");
    return Client.Interface.fromObj(snapshot.val());
  };

  private rateByID = async (clientID: string, rating: number) => {
    let clientRef = this.getReferenceByID(clientID);
    let client = await this.getClientByReference(clientRef);
    let totalRatedTrips = 0;
    let totalRating = 0;
    client?.past_trips?.forEach((pastTrip) => {
      totalRatedTrips =
        pastTrip.rating == undefined ? totalRatedTrips : totalRatedTrips + 1;
      totalRating =
        pastTrip.rating == undefined
          ? totalRating
          : totalRating + pastTrip.rating;
    });
    // rating is 5 until client has done at least 5 trips. Then it's an average of
    // the ratings of the last 100 trips.
    let clientRating = totalRatedTrips < 5 ? 5 : totalRating / totalRatedTrips;
    await clientRef.child("rating").set(clientRating);
  };

  saveTripAndRateByID = async (
    clientID: string,
    trip: TripRequest.Interface,
    rating: number
  ) => {
    let clientRef = this.getReferenceByID(clientID);
    trip.rating = rating;
    await clientRef.child("past_trips").push(trip);
    await this.rateByID(clientID, rating);
  };
}

export namespace Client {
  export interface Interface {
    uid: string;
    past_trips?: TripRequest.Interface[] | undefined;
    rating: number;
  }

  export namespace Interface {
    export const is = (obj: any): obj is Client.Interface => {
      if (obj == null || obj == undefined) {
        return false;
      }
      if (obj.past_trips != undefined) {
        let tripIDS = Object.keys(obj.past_trips);

        for (var i = 0; i < tripIDS.length; i++) {
          let tripID = tripIDS[i];
          if (!TripRequest.Interface.is(obj.past_trips[tripID])) {
            return false;
          }
        }
      }
      return "uid" in obj && "rating" in obj;
    };

    export const fromObj = (obj: any): Client.Interface | undefined => {
      if (is(obj)) {
        let pastTrips: TripRequest.Interface[] = [];
        if (obj.past_trips != undefined) {
          Object.keys(obj.past_trips).forEach((tripID: any) => {
            if (obj.past_trips == undefined) {
              return;
            }
            let pastTrip = TripRequest.Interface.fromObj(
              obj.past_trips[tripID]
            );
            if (pastTrip != undefined) {
              pastTrips.push(pastTrip);
            }
          });
        }
        return {
          uid: obj.uid,
          past_trips: pastTrips,
          rating: obj.rating,
        };
      }
      return;
    };
  }
}
