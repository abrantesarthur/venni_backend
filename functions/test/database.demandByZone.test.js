// const admin = require("firebase-admin");
// const { DemandByZone } = require("../lib/database/demandByZone");
// const chai = require("chai");
// const { ZoneName } = require("../lib/zones");

// const assert = chai.assert;

// describe("DemandByZone", () => {
//   before(async () => {
//     if (admin.apps.length == 0) {
//       admin.initializeApp();
//     }
//     // clear database
//     const dbz = new DemandByZone();
//     await dbz.clear();
//   });

//   before(async () => {
//     // clear database
//     const dbz = new DemandByZone();
//     await dbz.clear();
//   });

//   describe("pushTripTimestampToZone", () => {
//     it("pushes entry to ZoneName", async () => {
//       // assert there are no entries in a given zone
//       const dbz = new DemandByZone();
//       let snapshot = await dbz.getTripTimestampsFromZone(ZoneName.BB);
//       assert.isNull(snapshot.val());

//       // call pushTripTimestampToZone on that zone
//       const now = Date.now();
//       await dbz.pushTripTimestampToZone(now, ZoneName.BB);

//       // assert entry was pushed
//       snapshot = await dbz.getTripTimestampsFromZone(ZoneName.BB);
//       const values = Object.values(snapshot.val());
//       assert.equal(values.length, 1);
//       assert.equal(values[0], now);
//     });
//   });

//   describe("setTripTimestampsInZone", () => {
//     it("pushes entries to ZoneName", async () => {
//       // assert there are no entries in a given zone
//       const dbz = new DemandByZone();
//       let snapshot = await dbz.getTripTimestampsFromZone(ZoneName.CC);
//       assert.isNull(snapshot.val());

//       // call setTripTimestampsInZone on that zone
//       await dbz.setTripTimestampsInZone({ t1: 123, t2: 456 }, ZoneName.CC);

//       // assert entries were pushed
//       snapshot = await dbz.getTripTimestampsFromZone(ZoneName.CC);
//       const values = Object.values(snapshot.val());
//       assert.equal(values.length, 2);
//       assert.equal(values[0], 123);
//       assert.equal(values[1], 456);
//     });
//   });

//   describe("countTripRequestsByZone", () => {
//     it("returns number of entries in ZoneName", async () => {
//       // assert there are no entries in two given zones
//       const dbz = new DemandByZone();
//       let snapshot = await dbz.getTripTimestampsFromZone(ZoneName.DD);
//       assert.isNull(snapshot.val());
//       snapshot = await dbz.getTripTimestampsFromZone(ZoneName.EE);
//       assert.isNull(snapshot.val());

//       // call setTripTimestampsInZone to first zone only
//       await dbz.setTripTimestampsInZone({ t1: 123, t2: 456 }, ZoneName.DD);

//       // assert countTripRequestsByZone returns a nubmer only to first zone
//       let tripRequestsByZone = await dbz.countTripRequestsByZone();
//       assert.equal(tripRequestsByZone.get(ZoneName.DD), 2);
//       assert.equal(tripRequestsByZone.get(ZoneName.EE), 0);
//     });
//   });
// });
