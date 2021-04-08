import * as functions from "firebase-functions";
import * as firebaseAdmin from "firebase-admin";
import { LatLngLiteral, Status } from "@googlemaps/google-maps-services-js";
import { PilotInterface } from "./trip";
import { Client, Language } from "@googlemaps/google-maps-services-js";

// initialize google maps API client
const googleMaps = new Client({});

// transform an object of pilots in an array of pilots
const pilotsFromObj = (obj: any): Array<PilotInterface> => {
  let pilots: Array<PilotInterface> = [];
  Object.keys(obj).forEach((pilotUID) => {
    let pilot = obj[pilotUID] as PilotInterface;
    pilot.uid = pilotUID;
    pilots.push(pilot);
  });
  return pilots;
};

// assignPilotPositions returns an array of PilotInterface with position
// property properly assigned
const assignPilotPositions = async (
  clientUID: string,
  clientPlaceID: string,
  pilots: Array<PilotInterface>
): Promise<PilotInterface[]> => {
  if (pilots.length == 0) {
    return [];
  }

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
    distanceMatrixResponse = await googleMaps.distancematrix({
      params: {
        key: functions.config().googleapi.key,
        origins: ["place_id:" + clientPlaceID],
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
    pilots[index].position = {
      client_uid: clientUID,
      distance_text: elt.distance.text,
      distance_value: elt.distance.value,
      duration_text: elt.duration.text,
      duration_value: elt.duration.value,
    };
  });

  return pilots;
};

// calculateDistanceScores returns 50 points for pilots no farther
// than 100 meters, 0 points for pilots farther than 4999 meters,
// and lineraly decrements points for pilots in between.
const distanceScore = (distanceMeters: number) => {
  if (distanceMeters < 100) {
    return 50;
  }
  if (distanceMeters > 4999) {
    return 0;
  }
  return (5000 - distanceMeters) / 98;
};

// IdleTimeScore linearly and indefinitely increments pilot score
// such that pilots idle for 0 seconds receive 0 points and pilots idle for
// 5 minutes receive 40 points
const idleTimeScore = (timeSeconds: number) => {
  return (timeSeconds * 4) / 30;
};

// RatingScore such that pilots with less than 3 starts receive 0
// points and those with 5 starts receive 10 points, and those in between
// receive incrementally more points the higher their ratings.
const ratingScore = (rating: number) => {
  if (rating < 3) {
    return 0;
  }
  if (rating > 5) {
    return 10;
  }
  return 5 * rating - 15;
};

// rank pilots according to distance from client, time spent idle, and rating
const rankPilots = (pilots: PilotInterface[]): PilotInterface[] => {
  // calculate each pilot's score
  const now = Date.now();
  pilots.forEach((p, index) => {
    let pilotIdleSeconds = (now - p.idle_since) / 1000;
    p.score =
      distanceScore(p.position.distance_value) +
      idleTimeScore(pilotIdleSeconds) +
      ratingScore(p.rating);
  });

  // sort pilots by score
  let rankedPilots = pilots.sort(
    (pilotOne, pilotTwo) => pilotTwo.score - pilotOne.score
  );

  return rankedPilots;
};

export const findPilots = async (
  clientUID: string,
  clientPlaceID: string
): Promise<Array<PilotInterface>> => {
  // TODO: Perhaps separate pilots by zones in database and retrieve only nearby pilots here
  // retrieve all available pilots
  const snapshot = await firebaseAdmin
    .database()
    .ref("pilots")
    .orderByChild("status")
    .equalTo("available")
    .once("value");
  if (snapshot.val() == null) {
    // if none is available, return empty list
    return [];
  }
  let pilots = pilotsFromObj(snapshot.val());
  if (pilots.length == 0) {
    return [];
  }

  // assing positions to the pilots
  pilots = await assignPilotPositions(clientUID, clientPlaceID, pilots);

  // rank pilots according to their position and other criteria
  let rankedPilots: PilotInterface[] = rankPilots(pilots);

  return rankedPilots;
};

/**
3) S - Pilot score (10%)
less than 3 gives 0 points
from 3 to 5 it varies according to to 5S - 15
Distance gives at most 50 points, score at most 10points, and time idle is unlimited. This way, no matter a pilot's distance and score, at some point they will receive a ride.
The city is divided into squares that are stored in the database. As pilots drive around, they send their new latitude and longitude to the system every time they move 100 meters. The system places them in the square to which they belong.
The matching algorithm receives the client position as an argument and uses it to determine the client's square.
Select all available pilots in the client's square and squares adjacent to the pilot's square.
If there is no pilot, it picks pilots in squares adjacent to the adjacent squares, and so on until it finds up to 3 riders.
If it doesn't find any pilots, throw failure and notify the client.
If it finds pilots, rank them according to the above criteria and return the top three pilots.
*/
