import * as functions from "firebase-functions";
import {
  Client,
  Language,
  LatLngLiteral,
  Status,
} from "@googlemaps/google-maps-services-js";
import { getZonesAdjacentTo, ZoneName } from "../zones";
import { TripRequest } from "./tripRequest";
import { Partner } from "./partner";
import { Database } from ".";
import { calculatePartnerScore, rankPartners } from "../algorithms";

export class Partners extends Database {
  readonly ref: Database.Reference;

  constructor() {
    super();
    this.ref = this.DB.ref("partners");
  }

  // countAvailablePartnersByZone finds the number of available partners by zone
  countAvailablePartnersByZone = async (): Promise<Map<ZoneName, number>> => {
    // retrieve all available partners
    const snapshot = await this.ref
      .orderByChild("status")
      .equalTo("available")
      .once("value");

    // initialize response
    let response = new Map<ZoneName, number>();
    for (var str in ZoneName) {
      response.set(ZoneName.fromString(str), 0);
    }

    // return response if there are no available partners
    if (snapshot.val() == null) {
      return response;
    }
    let partners = this.fromObjs(snapshot.val());
    if (partners.length == 0) {
      return response;
    }

    // filter out partners with 'account_status' different from 'approved'
    partners = this.filterByAccountStatus(
      partners,
      Partner.AccountStatus.approved
    );

    // filter out eventual partners without set coordinates
    partners = this.filterByPosition(partners);

    // iterate over partners building response
    partners.forEach((partner) => {
      if (partner.current_zone != undefined) {
        // get current amount of partners in partner.current_zone
        let currentAmount = response.get(partner.current_zone);
        if (currentAmount != undefined) {
          response.set(partner.current_zone, currentAmount + 1);
        } else {
          response.set(partner.current_zone, 0);
        }
      }
    });
    return response;
  };

  // TODO: filter out partners without pagarme_recipient_id.
  findAllAvailable = async (
    tripRequest: TripRequest.Interface,
    tryingAgain: boolean
  ): Promise<Partner.Interface[]> => {
    // retrieve all available partners
    const snapshot = await this.ref
      .orderByChild("status")
      .equalTo("available")
      .once("value");

    if (snapshot.val() == null) {
      // if none is available, return empty list
      return [];
    }
    let partners = this.fromObjs(snapshot.val());
    if (partners.length == 0) {
      return [];
    }

    /// filter out partners with 'account_status' different from 'approved'
    partners = this.filterByAccountStatus(
      partners,
      Partner.AccountStatus.approved
    );

    // filter out eventual partners without set coordinates
    partners = this.filterByPosition(partners);

    // filter out partners without pagarme_recipient_id if payment is 'credit_card'
    partners = this.filterByRecipientID(partners, tripRequest);

    // filter partners nearby the client
    // partners = this.filterByZone(
    //   tripRequest.origin_zone,
    //   partners,
    //   tryingAgain
    // );

    // assing positions to the partners
    partners = await this.assignDistances(
      tripRequest.origin_place_id,
      partners,
      functions.config().googleapi.key
    );

    // rank partners according to their position and other criteria
    let rankedPartners = rankPartners(partners);

    // return three best ranked partners
    return rankedPartners.slice(
      0,
      rankedPartners.length < 4 ? rankedPartners.length : 4
    );
  };

  // filterByPartnerStatus filters out partners without the given status
  filterByPartnerStatus = (
    partners: Partner.Interface[],
    status: Partner.Status
  ) => {
    let filteredPartners: Partner.Interface[] = [];
    partners.forEach((partner) => {
      if (partner.status == status) {
        filteredPartners.push(partner);
      }
    });
    return filteredPartners;
  };

  // filterByAccountStatus filters out partners without the specified 'account_status'
  filterByAccountStatus = (
    partners: Partner.Interface[],
    accountStatus: Partner.AccountStatus
  ): Partner.Interface[] => {
    let approvedPartners: Partner.Interface[] = [];
    partners.forEach((partner) => {
      if (partner.account_status === accountStatus) {
        approvedPartners.push(partner);
      }
    });
    return approvedPartners;
  };

  // filterByPosition filters out partners without position
  filterByPosition = (partners: Partner.Interface[]): Partner.Interface[] => {
    let approvedPartners: Partner.Interface[] = [];
    partners.forEach((partner) => {
      if (
        partner.current_latitude != undefined &&
        partner.current_latitude.length > 0 &&
        partner.current_longitude != undefined &&
        partner.current_longitude.length > 0
      ) {
        approvedPartners.push(partner);
      }
    });
    return approvedPartners;
  };

  // filterByRecipientID filters out partners without pagarme_recipient_id if payment is 'credit_card'
  filterByRecipientID = (
    partners: Partner.Interface[],
    tripRequest: TripRequest.Interface
  ): Partner.Interface[] => {
    if (
      tripRequest.payment_method == "cash" ||
      tripRequest.payment_method == undefined
    ) {
      return partners;
    } else {
      let approvedPartners: Partner.Interface[] = [];
      partners.forEach((partner) => {
        if (
          partner.pagarme_recipient_id != undefined &&
          partner.pagarme_recipient_id.length > 0
        ) {
          approvedPartners.push(partner);
        }
      });
      return approvedPartners;
    }
  };

  // filterByZone returns partners who are near the origin of the trip.
  // it first tries to find partners in the very zone where the origin is.
  // If it finds no partners there, it filters partners in adjacent zones.
  // If it still finds no partners there, it returns partners unchanged.
  filterByZone = (
    originZone: ZoneName,
    partners: Partner.Interface[],
    tryingAgain: boolean
  ): Partner.Interface[] => {
    if (partners.length == 0) {
      return [];
    }

    let nearbyPartners: Partner.Interface[] = [];

    // filter partners in the origin zone
    partners.forEach((partner) => {
      if (partner.current_zone === originZone) {
        nearbyPartners.push(partner);
      }
    });

    // if found no partners in client's zone or the client is trying again after
    // finding no partners
    if (nearbyPartners.length == 0 || tryingAgain) {
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

    // if found no partners in client's zone and adjacent zones
    if (nearbyPartners.length == 0) {
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
