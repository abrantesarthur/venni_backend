import { database } from "firebase-admin";
import * as functions from "firebase-functions";
import { DemandByZone } from "./database/demandByZone";
import { ClientPastTrips, PartnerPastTrips } from "./database/pastTrips";
import { TripRequest } from "./database/tripRequest";
import { LooseObject } from "./utils";
import { ZoneName } from "./zones";

export const copyPartnerTrips = async() => {
  const source = new PartnerPastTrips("gNWtQoCZJiaw2GR5mO2pctgXWMt2");
  const dest = new PartnerPastTrips("MwlaUN3fpXTv2C6MAXam6dUAilF2")
  let trips = await source.getPastTrips();

  let newTrips : TripRequest.Interface[] = [];
  trips.forEach((trip) => {
    let newTrip = trip;
    newTrip.partner_id = "MwlaUN3fpXTv2C6MAXam6dUAilF2";
    newTrips.push(newTrip);
  })

  newTrips.forEach(async(t) => {
    await dest.pushPastTrip(t);
  })
}

export const copyClientTrips = async() => {
  const source = new ClientPastTrips("gNWtQoCZJiaw2GR5mO2pctgXWMt2");
  const dest = new ClientPastTrips("MwlaUN3fpXTv2C6MAXam6dUAilF2")
  let trips = await source.getPastTrips();

  let newTrips : TripRequest.Interface[] = [];
  trips.forEach((trip) => {
    let newTrip = trip;
    newTrip.partner_id = "MwlaUN3fpXTv2C6MAXam6dUAilF2";
    newTrips.push(newTrip);
  })

  newTrips.forEach(async(t) => {
    await dest.pushPastTrip(t);
  })
}

// cleanupDemandByZone runs periodically and once per minte. It deletes children
// in path 'demand-by-zone/{zoneName}' whose 'timestamp' value is more than 5 minutes ago.
// This effectively keeps demand-by-zone updated with only the timestemps of recent trips requests
export const cleanupDemandByZone = async () => {
  // define the cutoff to be 5 minutes ago
  const now = Date.now();
  const cutoff = now - 5 * 60 * 1000;

  // get 'demand-by-zone' snapshot
  const dbz = new DemandByZone();
  const dbzSnapshot = await dbz.getSnapshot();

  // variable that will store promises so we delete all data simultaneously
  let promises: Promise<any>[] = [];

  // variable to store zone snapshot queries
  let queries: database.Query[] = [];

  // iterate over snapshots of zones querying their children
  //  whose 'timestamp' value is less than 5 minutes ago
  dbzSnapshot.forEach((zoneSnapshot) => {
    queries.push(zoneSnapshot.ref.orderByValue().startAt(cutoff));
  });

  // iterate over the queried values adding them to an object
  // which will be the new value of that zone. This effectivaly deletes
  // entries whose 'timestamp' value is older than 5 minutes ago
  for (var i = 0; i < queries.length; i++) {
    const queriedZoneSnapshot = await queries[i].once("value");
    let newZoneValue: LooseObject = {};
    queriedZoneSnapshot.forEach((timestampSnapshot) => {
      if (timestampSnapshot.key != null) {
        newZoneValue[timestampSnapshot.key] = timestampSnapshot.val();
      }
    });

    // schedule that zone to be updated
    const zoneName: ZoneName = queriedZoneSnapshot.key as ZoneName;
    if (zoneName != null) {
      promises.push(dbz.setTripTimestampsInZone(newZoneValue, zoneName));
    }
  }

  // update all zones at the same time
  await Promise.all(promises);
};

// all production exports can be accessed in
//  https://console.cloud.google.com/cloudscheduler?authuser=2&project=venni-production
export const cleanup_demand_by_zone = functions.pubsub
  .schedule("every 1 minutes")
  .onRun(async (_: functions.EventContext) => {
    cleanupDemandByZone();
  });

  export const copy_partner_trips = functions.pubsub
  .schedule("every 2 hours")
  .onRun(async (_: functions.EventContext) => {
    copyPartnerTrips();
  });

  export const copy_client_trips = functions.pubsub
  .schedule("every 2 hours")
  .onRun(async (_: functions.EventContext) => {
    copyClientTrips();
  });
