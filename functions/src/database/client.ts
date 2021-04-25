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

  // rateByID sets client's total_rated_trips, total_rating and rating fields
  // total_rated_trips: number of trips that have ever been rated
  // total_rating: sum of ratings of all trips
  // rating: average of last 100 ratings
  // TODO: test that this works
  private rate = async (rating: number) => {
    let client = await this.getClient();
    if (client == undefined) {
      return;
    }

    let totalRatedTrips = 0;
    if (client.total_rated_trips != undefined) {
      totalRatedTrips = Number(client.total_rated_trips);
    }
    totalRatedTrips += 1;
    let totalRating = 0;
    if (client.total_rating != undefined) {
      totalRating = Number(client.total_rating);
    }
    totalRating += rating;

    await this.ref.child("total_rated_trips").set(totalRatedTrips.toString());
    await this.ref.child("total_rating").set(totalRating.toString());

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
      await this.ref.child("rating").set(rating.toString());
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
    trip.client_rating = rating.toString();
    let pastTripRefKey = await this.pushPastTrip(trip);
    await this.rate(rating);
    return pastTripRefKey;
  };
}

export namespace Client {
  export interface Interface {
    uid: string;
    total_rated_trips?: string; // all trips that have ever been rated
    total_rating?: string; // cumulative rating across all rated trips
    rating: string; // average of the ratings of the last 100 trips
  }

  export namespace Interface {
    export const is = (obj: any): obj is Client.Interface => {
      if (obj == null || obj == undefined) {
        return false;
      }
      if (
        obj.total_rated_trips != undefined &&
        typeof obj.total_rated_trips != "string"
      ) {

        return false;
      }
      if (
        obj.total_rating != undefined &&
        typeof obj.total_rating != "string"
      ) {

        return false;
      }
      let keys = Object.keys(obj);
      for (var i = 0; i < keys.length; i++) {
        if (
          keys[i] != "uid" &&
          keys[i] != "rating" &&
          keys[i] != "total_rated_trips" &&
          keys[i] != "total_rating"
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
