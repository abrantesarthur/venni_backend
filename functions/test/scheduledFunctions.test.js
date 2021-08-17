const admin = require("firebase-admin");
const chai = require("chai");
const { DemandByZone } = require("../lib/database/demandByZone");
const { ZoneName } = require("../lib/zones");
const assert = chai.assert;

describe("scheduledFunctions", () => {
  let scheduledFunctions;
  let cleanupDemandByZone;

  before(async () => {
    if (admin.apps.length == 0) {
      admin.initializeApp();
    }

    // set up functions to be tested
    scheduledFunctions = require("../lib/scheduledFunctions");
    cleanupDemandByZone = scheduledFunctions.cleanupDemandByZone;

    // clear database
    const dbz = new DemandByZone();
    await dbz.clear();
  });

  describe("cleanupDemandByZone", () => {
    it("deletes only entries whose timestamp is older than 5 minutes", async () => {
      const dbz = new DemandByZone();

      // get timestamp of more than 5 minutes ago
      let now = Date.now();
      let sixMinutesAgo = now - 60 * 6 * 1000;
      let fiveMinutesAgo = now - 60 * 5 * 1000;
      let fiveSecondsLessThanFiveMinutesAgo = now - 60 * 5 * 1000 + 2000;

      // add entries to 'demand-by-zone' for trips that happened 6 minutes ago
      await dbz.pushTripTimestampToZone(sixMinutesAgo, ZoneName.AA);
      // add entries to 'demand-by-zone' for trips that happened 5 minutes ago
      await dbz.pushTripTimestampToZone(fiveMinutesAgo, ZoneName.AA);
      // add entries to 'demand-by-zone' for trips that happened less than 5 minutes ago
      await dbz.pushTripTimestampToZone(
        fiveSecondsLessThanFiveMinutesAgo,
        ZoneName.AA
      );

      // assert these three entry were succesfully added to Zone AA
      let tripRequestsByZone = await dbz.countTripRequestsByZone();
      assert.equal(tripRequestsByZone.get(ZoneName.AA), 3);

      // call cleanupDemandByZone
      await cleanupDemandByZone();

      // expect entries older than 5 minutes ago to have been deleted from Zone AA
      tripRequestsByZone = await dbz.countTripRequestsByZone();
      assert.equal(tripRequestsByZone.get(ZoneName.AA), 1);

      // assert that the one entry left is the one less than 5 minutes ago
      let snapshot = await dbz.getTripTimestampsFromZone(ZoneName.AA);
      const values = Object.values(snapshot.val());
      assert.equal(values.length, 1);
      assert.equal(values[0], fiveSecondsLessThanFiveMinutesAgo);
    });
  });
});
