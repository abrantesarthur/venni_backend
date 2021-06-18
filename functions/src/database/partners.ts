import * as functions from "firebase-functions";
import {
  Client,
  Language,
  LatLngLiteral,
  Status,
} from "@googlemaps/google-maps-services-js";
import { createMockPartners } from "../mock";
import { getZonesAdjacentTo, ZoneName } from "../zones";
import { TripRequest } from "./tripRequest";
import { Partner } from "./partner";
import { Database } from ".";

export class Partners extends Database {
  readonly ref: Database.Reference;

  constructor() {
    super();
    this.ref = this.DB.ref("partners");
  }
  // TODO: filter out partners without pagarme_recipient_id.
  findAllAvailable = async (
    tripRequest: TripRequest.Interface
  ): Promise<Partner.Interface[]> => {
    // retrieve all available partners
    const snapshot = await this.ref
      .orderByChild("status")
      .equalTo("available")
      .once("value");

    if (snapshot.val() == null) {
      // if none is available, return empty list
      // TODO: remove before deploying
      createMockPartners(1);
      return [];
    }
    let partners = this.fromObjs(snapshot.val());
    if (partners.length == 0) {
      return [];
    }
    // filter partners nearby the client
    partners = this.filterByZone(tripRequest.origin_zone, partners);

    // assing positions to the partners
    partners = await this.assignDistances(
      tripRequest.origin_place_id,
      partners,
      functions.config().googleapi.key
    );

    // rank partners according to their position and other criteria
    let rankedPartners = this.rank(partners);

    // return three best ranked partners
    return rankedPartners.slice(
      0,
      rankedPartners.length < 3 ? rankedPartners.length : 3
    );
  };

  // filterByZone returns partners who are near the origin of the trip.
  // it first tries to find partners in the very zone where the origin is.
  // If it finds no partners there, it filters partners in adjacent zones.
  // If it still finds no partners there, it returns partners unchanged.
  filterByZone = (
    originZone: ZoneName,
    partners: Partner.Interface[]
  ): Partner.Interface[] => {
    let nearbyPartners: Partner.Interface[] = [];

    // filter partners in the origin zone
    partners.forEach((partner) => {
      if (partner.current_zone === originZone) {
        nearbyPartners.push(partner);
      }
    });

    // if found less than 3 partners in client's zone
    if (nearbyPartners.length < 3) {
      // try to find partners in adjacent zones
      let adjacentZones: ZoneName[] = getZonesAdjacentTo(originZone);
      adjacentZones.forEach((adjacentZone) => {
        partners.forEach((partner) => {
          if (partner.current_zone === adjacentZone) {
            nearbyPartners.push(partner);
          }
        });
      });
    }

    // if found less than three partners in client's zone and adjacent zones
    if (nearbyPartners.length < 3) {
      // return partners unfiltered
      return partners;
    }

    return nearbyPartners;
  };

  // assignPartnersDistanceToClient returns an array of Partner.Interface with position
  // property properly assigned
  assignDistances = async (
    originPlaceID: string,
    partners: Partner.Interface[],
    googleApiKey: string
  ): Promise<Partner.Interface[]> => {
    if (partners.length == 0) {
      return [];
    }

    // limit the number of partners to 25 due to Distance Matrix API's restrictions
    partners = partners.slice(0, partners.length > 25 ? 25 : partners.length);

    // extract list of partners coordinates from partners array
    let partnersCoordinates: Array<LatLngLiteral> = [];
    partners.forEach((partner) => {
      partnersCoordinates.push({
        lat: Number(partner.current_latitude),
        lng: Number(partner.current_longitude),
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
          destinations: partnersCoordinates,
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

    // make sure we received correct number and status of partner distances
    let distanceElements = distanceMatrixResponse.data.rows[0].elements;
    if (distanceElements.length != partners.length) {
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

    // build array of partner distances
    distanceElements.forEach((elt, index) => {
      partners[index].distance_to_client = {
        distance_text: elt.distance.text,
        distance_value: elt.distance.value,
        duration_text: elt.duration.text,
        duration_value: elt.duration.value,
      };
    });

    return partners;
  };

  // rank partners according to distance from client, time spent idle, and rating
  rank = (partners: Partner.Interface[]): Partner.Interface[] => {
    // calculate each partner's score
    const now = Date.now();
    partners.forEach((partner) => {
      let partnerIdleSeconds = (now - Number(partner.idle_since)) / 1000;
      partner.score =
        this.distanceScore(partner.distance_to_client?.distance_value) +
        this.idleTimeScore(partnerIdleSeconds) +
        this.ratingScore(Number(partner.rating));
    });

    // sort partners by score
    let rankedPartners = partners.sort((partnerOne, partnerTwo) => {
      if (partnerOne.score != undefined && partnerTwo.score != undefined) {
        return partnerTwo.score - partnerOne.score;
      }
      return 0;
    });

    return rankedPartners;
  };

  // calculateDistanceScores returns 50 points for partners no farther
  // than 100 meters, 0 points for partners farther than 4999 meters,
  // and lineraly decrements points for partners in between.
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

  // IdleTimeScore linearly and indefinitely increments partner score
  // such that partners idle for 0 seconds receive 0 points and partners idle for
  // 5 minutes receive 40 points. Time idle can potentially give unlimited points.
  // This way, no matter a partner's distance and score, at some point they will receive a ride.
  idleTimeScore = (timeSeconds: number) => {
    return (timeSeconds * 4) / 30;
  };

  // RatingScore such that partners with less than 3 starts receive 0
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

  // transform an object of partners in an array of partners
  fromObjs = (obj: any): Partner.Interface[] => {
    if (obj == null || obj == undefined) {
      return [];
    }
    let partners: Partner.Interface[] = [];
    Object.keys(obj).forEach((partnerUID) => {
      // don't add obj to list if it doesn't conform to PartnerInterface
      let partner = Partner.Interface.fromObj(obj[partnerUID]);
      if (partner != undefined) {
        partners.push(partner);
      }
    });
    return partners;
  };
}
