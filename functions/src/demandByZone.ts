import * as functions from "firebase-functions";
import { DemandByZone } from "./database/demandByZone";
import { Partners } from "./database/partners";
import { getZoneBounds, ZoneName } from "./zones";
import { Demand, calculateDemand } from "./algorithms";

export interface ZoneDemand {
  zone_name: ZoneName;
  demand: Demand;
  max_lat: number;
  max_lng: number;
  min_lat: number;
  min_lng: number;
}

type GetZoneDemand = {
  [key: string]: ZoneDemand;
};

// _get returns a list of ZoneDemand, whose 'demandScore' is a number between
// 0 and 1 calculated by considering the amount of trips requested from the
// corresponding zone versus how many partners are available there. That is,
// the more trips requested, the higher the demandScore, but the more partners
// available in that area, the smaller the score.
const _get = async (_: any, context: functions.https.CallableContext) => {
  // validate authentication
  if (context.auth == null) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "Missing authentication credentials."
    );
  }

  // response object
  let response: GetZoneDemand = {};

  // initialize relevant classes
  const dbz = new DemandByZone();
  const p = new Partners();

  // get number of trip requests by zone in the last 5 minutes
  let tripRequestCountMap = await dbz.countTripRequestsByZone();

  // get current number of available partners by zone
  let availablePartnersMap = await p.countAvailablePartnersByZone();

  // iterate over all zones building response object
  for (var str in ZoneName) {
    let zoneName = ZoneName.fromString(str);

    // get trip request count and available partners count in zoneName
    let zoneTripRequestCount = tripRequestCountMap.get(zoneName);
    let zoneAvailablePartnersCount = availablePartnersMap.get(zoneName);
    if (zoneTripRequestCount == undefined) {
      zoneTripRequestCount = 0;
    }
    if (zoneAvailablePartnersCount == undefined) {
      zoneAvailablePartnersCount = 0;
    }

    // get zone bounds
    let zoneBounds = getZoneBounds(zoneName);

    // use these values to calculate that zone's demand score
    let demand = calculateDemand(
      zoneTripRequestCount,
      zoneAvailablePartnersCount
    );

    // add zone's demand to response
    response[zoneName] = {
      zone_name: zoneName,
      demand: demand,
      max_lat: zoneBounds.max_lat,
      min_lat: zoneBounds.min_lat,
      max_lng: zoneBounds.max_lng,
      min_lng: zoneBounds.min_lng,
    };
  }

  return response;
};

export const get = functions.https.onCall(_get);
