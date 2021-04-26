import { Database } from "./index";
import { ClientPastTrips } from "./pastTrips";
import { TripRequest } from "./tripRequest";

export class Client extends Database {
  readonly ref: Database.Reference;
  readonly id: string;

  constructor(clientID: string) {
    super();
    this.id = clientID;
    this.ref = this.DB.ref("clients").child(clientID);
  }

  getClient = async (): Promise<Client.Interface | undefined> => {
    const snapshot = await this.ref.once("value");
    return Client.Interface.fromObj(snapshot.val());
  };

  addClient = async (client: Client.Interface) => {
    await this.ref.set(client);
  };

  // rateByID sets client's as average of last 100 ratings
  private rate = async () => {
    let client = await this.getClient();
    if (client == undefined) {
      return;
    }

    // get client past 100 trips
    let cpt = new ClientPastTrips(this.id);
    let last100Trips = await cpt.getPastTrips(100);

    // calculate rating
    if (last100Trips != undefined) {
      let last100TotalRating = 0;
      let last100NumberOfRatings = 0;
      last100Trips.forEach((trip) => {
        if (trip.client_rating != undefined) {
          last100TotalRating += Number(trip.client_rating);
          last100NumberOfRatings += 1;
        }
      });

      // rating is 5 until client has done at least 5 trips. Then it's an average of
      // the ratings of the last 100 trips.
      let rating =
        last100Trips.length < 5
          ? 5
          : last100TotalRating / last100NumberOfRatings;
      await this.ref.child("rating").set(((rating * 100) / 100).toFixed(2).toString());
    }
  };

  private pushPastTrip = async (
    trip: TripRequest.Interface
  ): Promise<string | null> => {
    let cpt = new ClientPastTrips(this.id);
    return await cpt.pushPastTrip(trip);
  };

  // pushPastTripAndRate saves the trip to the client's list of past_trips with
  // client_rating field set to rating. Then, it rates the client. As a consequence of
  // pushing and then rating, rate will take into accoutn the just-pushed trip.
  // it returns the reference key to the past-trip entry.
  pushPastTripAndRate = async (
    trip: TripRequest.Interface,
    rating: number
  ): Promise<string | null> => {
    trip.client_rating = ((rating * 100)/100).toFixed(2).toString();
    let pastTripRefKey = await this.pushPastTrip(trip);
    await this.rate();
    return pastTripRefKey;
  };
}

export namespace Client {
  export interface Interface {
    uid: string;
    rating: string; // average of the ratings of the last 100 trips
  }

  export namespace Interface {
    export const is = (obj: any): obj is Client.Interface => {
      if (obj == null || obj == undefined) {
        return false;
      }
      
      let keys = Object.keys(obj);
      for (var i = 0; i < keys.length; i++) {
        if (
          keys[i] != "uid" &&
          keys[i] != "rating"
        ) {
          return false;
        }
      }

      return (
        "uid" in obj &&
        "rating" in obj &&
        typeof obj.uid == "string" &&
        typeof obj.rating == "string"
      );
    };

    export const fromObj = (obj: any): Client.Interface | undefined => {
      if (is(obj)) {
        return obj as Client.Interface;
      }
      return;
    };
  }
}
