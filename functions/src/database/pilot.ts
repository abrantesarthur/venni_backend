import * as functions from "firebase-functions";
import {
  Client,
  Language,
  LatLngLiteral,
  Status,
} from "@googlemaps/google-maps-services-js";
import { Database } from ".";
import { createMockPilots } from "../mock";
import { getZonesAdjacentTo, ZoneName } from "../zones";
import { TripRequest } from "./tripRequest";

export class Pilot extends Database {
  readonly ref: Database.Reference;

  constructor() {
    super();
    this.ref = this.DB.ref("pilots");
  }

  getReferenceByID = (id: string): Database.Reference => {
    return this.ref.child(id);
  };

  getPilotByID = async (id: string): Promise<Pilot.Interface> => {
    const snapshot = await this.getReferenceByID(id).once("value");
    return snapshot.val() as Pilot.Interface;
  };

  getPilotByReference = async (
    ref: Database.Reference
  ): Promise<Pilot.Interface> => {
    const snapshot = await ref.once("value");
    return snapshot.val() as Pilot.Interface;
  };

  // freePilot sets the pilot's status to available, empties its current_client_uid,
  // and resets its idle_time to now.
  freeByID = async (pilotID: string, incrementTotalTrips = false) => {
    if (pilotID == undefined || pilotID.length == 0) {
      return;
    }
    const pilotRef = this.getReferenceByID(pilotID);
    await pilotRef.transaction((pilot: Pilot.Interface) => {
      if (pilot == null) {
        return {};
      }
      pilot.status = Pilot.Status.available;
      pilot.current_client_uid = "";
      pilot.idle_since = Date.now();
      if (incrementTotalTrips) {
        pilot.total_trips =
          pilot.total_trips == undefined ? 1 : pilot.total_trips + 1;
      }
      return pilot;
    });
  };

  findAllAvailable = async (
    tripRequest: TripRequest.Interface
  ): Promise<Pilot.Interface[]> => {
    // retrieve all available pilots
    const snapshot = await this.ref
      .orderByChild("status")
      .equalTo("available")
      .once("value");

    if (snapshot.val() == null) {
      // if none is available, return empty list
      // TODO: remove before deploying
      createMockPilots(100);
      return [];
    }
    let pilots = Pilot.Interface.fromObj(snapshot.val());
    if (pilots.length == 0) {
      return [];
    }
    // filter pilots nearby the client
    pilots = this.filterByZone(tripRequest.origin_zone, pilots);

    // assing positions to the pilots
    pilots = await this.assignDistances(
      tripRequest.origin_place_id,
      pilots,
      functions.config().googleapi.key
    );

    // rank pilots according to their position and other criteria
    let rankedPilots = this.rank(pilots);

    // return three best ranked pilots
    return rankedPilots.slice(
      0,
      rankedPilots.length < 3 ? rankedPilots.length : 3
    );
  };

  // filterByZone returns pilots who are near the origin of the trip.
  // it first tries to find pilots in the very zone where the origin is.
  // If it finds no pilots there, it filters pilots in adjacent zones.
  // If it still finds no pilots there, it returns pilots unchanged.
  private filterByZone = (
    originZone: ZoneName,
    pilots: Pilot.Interface[]
  ): Pilot.Interface[] => {
    let nearbyPilots: Pilot.Interface[] = [];

    // filter pilots in the origin zone
    pilots.forEach((pilot) => {
      if (pilot.current_zone === originZone) {
        nearbyPilots.push(pilot);
      }
    });

    // if found less than 3 pilots in client's zone
    if (nearbyPilots.length < 3) {
      // try to find pilots in adjacent zones
      let adjacentZones: ZoneName[] = getZonesAdjacentTo(originZone);
      adjacentZones.forEach((adjacentZone) => {
        pilots.forEach((pilot) => {
          if (pilot.current_zone === adjacentZone) {
            nearbyPilots.push(pilot);
          }
        });
      });
    }

    // if found less than three pilots in client's zone and adjacent zones
    if (nearbyPilots.length < 3) {
      // return pilots unfiltered
      return pilots;
    }

    return nearbyPilots;
  };

  // assignPilotsDistanceToClient returns an array of Pilot.Interface with position
  // property properly assigned
  private assignDistances = async (
    originPlaceID: string,
    pilots: Pilot.Interface[],
    googleApiKey: string
  ): Promise<Pilot.Interface[]> => {
    if (pilots.length == 0) {
      return [];
    }

    // limit the number of pilots to 25 due to Distance Matrix API's restrictions
    pilots = pilots.slice(0, pilots.length > 25 ? 25 : pilots.length);

    // extract list of pilots coordinates from pilots array
    let pilotsCoordinates: Array<LatLngLiteral> = [];
    pilots.forEach((pilot) => {
      pilotsCoordinates.push({
        lat: pilot.current_latitude,
        lng: pilot.current_longitude,
      });
    });

    let distanceMatrixResponse;
    try {
      // request distances from google distance matrix API
      // initialize google maps API client
      const googleMaps = new Client({});
      distanceMatrixResponse = await googleMaps.distancematrix({
        params: {
          key: googleApiKey,
          origins: ["place_id:" + originPlaceID],
          destinations: pilotsCoordinates,
          language: Language.pt_BR,
        },
      });
    } catch (e) {
      throw new functions.https.HttpsError(
        "internal",
        "failed to communicate with Google Distance Matrix API."
      );
    }

    // make sure request was successfull
    if (distanceMatrixResponse.status != 200) {
      throw new functions.https.HttpsError(
        "internal",
        "failed to communicate with Google Distance Matrix API."
      );
    }

    // make sure we received correct number and status of pilot distances
    let distanceElements = distanceMatrixResponse.data.rows[0].elements;
    if (distanceElements.length != pilots.length) {
      throw new functions.https.HttpsError(
        "internal",
        "failed to receive correct response from Google Distance Matrix API."
      );
    } else {
      distanceElements.forEach((de) => {
        if (de.status != Status.OK) {
          throw new functions.https.HttpsError(
            "internal",
            "failed to receive correct response from Google Distance Matrix API."
          );
        }
      });
    }

    // build array of pilot distances
    distanceElements.forEach((elt, index) => {
      pilots[index].distance_to_client = {
        distance_text: elt.distance.text,
        distance_value: elt.distance.value,
        duration_text: elt.duration.text,
        duration_value: elt.duration.value,
      };
    });

    return pilots;
  };

  // rank pilots according to distance from client, time spent idle, and rating
  private rank = (pilots: Pilot.Interface[]): Pilot.Interface[] => {
    // calculate each pilot's score
    const now = Date.now();
    pilots.forEach((pilot) => {
      let pilotIdleSeconds = (now - pilot.idle_since) / 1000;
      pilot.score =
        this.distanceScore(pilot.distance_to_client?.distance_value) +
        this.idleTimeScore(pilotIdleSeconds) +
        this.ratingScore(pilot.rating);
    });

    // sort pilots by score
    let rankedPilots = pilots.sort((pilotOne, pilotTwo) => {
      if (pilotOne.score != undefined && pilotTwo.score != undefined) {
        return pilotTwo.score - pilotOne.score;
      }
      return 0;
    });

    return rankedPilots;
  };

  // calculateDistanceScores returns 50 points for pilots no farther
  // than 100 meters, 0 points for pilots farther than 4999 meters,
  // and lineraly decrements points for pilots in between.
  private distanceScore = (distanceMeters?: number) => {
    if (distanceMeters == undefined) {
      return 0;
    }
    if (distanceMeters <= 100) {
      return 50;
    }
    if (distanceMeters > 4999) {
      return 0;
    }
    return (5000 - distanceMeters) / 98;
  };

  // IdleTimeScore linearly and indefinitely increments pilot score
  // such that pilots idle for 0 seconds receive 0 points and pilots idle for
  // 5 minutes receive 40 points. Time idle can potentially give unlimited points.
  // This way, no matter a pilot's distance and score, at some point they will receive a ride.
  private idleTimeScore = (timeSeconds: number) => {
    return (timeSeconds * 4) / 30;
  };

  // RatingScore such that pilots with less than 3 starts receive 0
  // points and those with 5 starts receive 10 points, and those in between
  // receive incrementally more points the higher their ratings.
  private ratingScore = (rating: number) => {
    if (rating < 3) {
      return 0;
    }
    if (rating > 5) {
      return 10;
    }
    return 5 * rating - 15;
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
    total_trips: number;
    member_since: number;
    phone_number: string;
    current_client_uid?: string;
    current_latitude: number;
    current_longitude: number;
    current_zone: ZoneName;
    status: Status;
    vehicle: VehicleInterface;
    idle_since: number;
    rating: number;
    score?: number; // not stored in database
    // TODO: change name to route or somethign
    distance_to_client?: DistanceToClient; // not stored in database
  }

  export namespace Interface {
    // transform an object of pilots in an array of pilots
    export const fromObj = (obj: any): Pilot.Interface[] => {
      let pilots: Pilot.Interface[] = [];
      Object.keys(obj).forEach((pilotUID) => {
        // don't add obj to list if it doesn't conform to PilotInterface
        if (is(obj[pilotUID])) {
          // create pilot obj, ignoring eventual extra irrelevant fields
          const pilot = {
            uid: obj[pilotUID].uid,
            name: obj[pilotUID].name,
            last_name: obj[pilotUID].last_name,
            total_trips: obj[pilotUID].total_trips,
            member_since: obj[pilotUID].member_since,
            phone_number: obj[pilotUID].phone_number,
            current_client_uid: obj[pilotUID].current_client_uid,
            current_latitude: obj[pilotUID].current_latitude,
            current_longitude: obj[pilotUID].current_longitude,
            current_zone: obj[pilotUID].current_zone,
            status: obj[pilotUID].status,
            vehicle: obj[pilotUID].vehicle,
            idle_since: obj[pilotUID].idle_since,
            rating: obj[pilotUID].rating,
            score: obj[pilotUID].score,
          };
          pilots.push(pilot);
        }
      });
      return pilots;
    };

    export const is = (obj: any): obj is Pilot.Interface => {
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
        "total_trips" in obj &&
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
      return (
        "brand" in obj && "model" in obj && "year" in obj && "plate" in obj
      );
    };
  }
}
