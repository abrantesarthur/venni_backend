import * as functions from "firebase-functions";
import {
  Client,
  Language,
  LatLngLiteral,
  Status,
} from "@googlemaps/google-maps-services-js";
import { createMockPilots } from "../mock";
import { getZonesAdjacentTo, ZoneName } from "../zones";
import { TripRequest } from "./tripRequest";
import { Pilot } from "./pilot";
import { Database } from ".";

export class Pilots extends Database {
  readonly ref: Database.Reference;

  constructor() {
    super();
    this.ref = this.DB.ref("pilots");
  }
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
    let pilots = this.fromObjs(snapshot.val());
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
  filterByZone = (
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
  assignDistances = async (
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
  rank = (pilots: Pilot.Interface[]): Pilot.Interface[] => {
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
  distanceScore = (distanceMeters?: number) => {
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
  idleTimeScore = (timeSeconds: number) => {
    return (timeSeconds * 4) / 30;
  };

  // RatingScore such that pilots with less than 3 starts receive 0
  // points and those with 5 starts receive 10 points, and those in between
  // receive incrementally more points the higher their ratings.
  ratingScore = (rating: number) => {
    if (rating < 3) {
      return 0;
    }
    if (rating > 5) {
      return 10;
    }
    return 5 * rating - 15;
  };

  // transform an object of pilots in an array of pilots
  fromObjs = (obj: any): Pilot.Interface[] => {
    if (obj == null || obj == undefined) {
      return [];
    }
    let pilots: Pilot.Interface[] = [];
    Object.keys(obj).forEach((pilotUID) => {
      // don't add obj to list if it doesn't conform to PilotInterface
      let pilot = Pilot.Interface.fromObj(obj[pilotUID]);
      if (pilot != undefined) {
        pilots.push(pilot);
      }
    });
    return pilots;
  };
}
