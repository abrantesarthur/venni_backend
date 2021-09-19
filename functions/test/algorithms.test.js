// const chai = require("chai");
// const assert = chai.assert;
// const admin = require("firebase-admin");

// describe("partners", () => {
//   let algorithms;
//   let distanceScore;
//   let ratingScore;
//   let idleTimeScore;
//   let rankPartners;
//   let roundToMultipleOfFifty;

//   before(() => {
//     if (admin.apps.length == 0) {
//       admin.initializeApp();
//     }

//     // set up functions to be tested
//     algorithms = require("../lib/algorithms");
//     distanceScore = algorithms.distanceScore;
//     ratingScore = algorithms.ratingScore;
//     idleTimeScore = algorithms.idleTimeScore;
//     rankPartners = algorithms.rankPartners;
//     roundToMultipleOfFifty = algorithms.roundToMultipleOfFifty;
//   });

//   describe("distanceScore", () => {
//     it("yields 0 points for distances greater than 4999 meters", () => {
//       assert.isBelow(distanceScore(4999), 1);
//       assert.equal(distanceScore(5000), 0);
//       assert.equal(distanceScore(10000), 0);
//     });

//     it("yields 50 points for distances smaller than 100 meters", () => {
//       assert.equal(distanceScore(100), 50);
//       assert.equal(distanceScore(0), 50);
//     });

//     it("yields between 0 and 50 points for distances between 100 and 5000 meters", () => {
//       for (var i = 150; i < 5000; i = i + 50) {
//         assert.isAbove(distanceScore(i), 0);
//         assert.isBelow(distanceScore(i), 50);
//       }
//     });
//   });

//   describe("ratingScore", () => {
//     it("yields 0 points for ratings smaller than 3", () => {
//       assert.equal(ratingScore(3), 0);
//       assert.equal(ratingScore(0), 0);
//     });

//     it("yields 10 points for ratings greater or equal to 5", () => {
//       assert.equal(ratingScore(5), 10);
//       assert.equal(ratingScore(7), 10);
//     });

//     it("yields between 0 and 10 points for ratings between 3 and 5 meters", () => {
//       for (var i = 3.1; i < 5; i = i + 0.1) {
//         assert.isAbove(ratingScore(i), 0);
//         assert.isBelow(ratingScore(i), 10);
//       }
//     });
//   });

//   describe("idleTimeScore", () => {
//     it("yields 0 points for idleness equal to 0 seconds", () => {
//       assert.equal(idleTimeScore(0), 0);
//     });

//     it("yields 40 points for idleness equal to 5 minutes", () => {
//       assert.equal(idleTimeScore(300), 40);
//     });

//     it("yields between 0 and 40 points for idleness between 0 and 5 minutes", () => {
//       for (var i = 10; i < 300; i = i + 10) {
//         assert.isAbove(idleTimeScore(i), 0);
//         assert.isBelow(idleTimeScore(i), 40);
//       }
//     });

//     it("yields more than 40 points for idleness longer than 5 minutes", () => {
//       for (var i = 310; i < 3000; i = i + 10) {
//         assert.isAbove(idleTimeScore(i), 40);
//       }
//     });
//   });

//   describe("roundToMultipleOfFifty", () => {
//     it("rounds a number to multiples of 50", () => {
//       assert.equal(roundToMultipleOfFifty(500), 500);
//       assert.equal(roundToMultipleOfFifty(510), 500);
//       assert.equal(roundToMultipleOfFifty(524), 500);
//       assert.equal(roundToMultipleOfFifty(525), 550);
//       assert.equal(roundToMultipleOfFifty(550), 550);
//       assert.equal(roundToMultipleOfFifty(551), 550);
//       assert.equal(roundToMultipleOfFifty(574), 550);
//       assert.equal(roundToMultipleOfFifty(575), 600);
//       assert.equal(roundToMultipleOfFifty(580), 600);
//       assert.equal(roundToMultipleOfFifty(599), 600);
//       assert.equal(roundToMultipleOfFifty(600), 600);
//       assert.equal(roundToMultipleOfFifty(601), 600);
//     });
//   });

//   describe("rankPartners", () => {
//     let defaultPartner1;
//     let defaultPartner2;
//     let now;
//     before(() => {
//       now = Date.now();
//       // just finished a trip, is right next to client, and has maximum rating
//       defaultPartner1 = {
//         uid: "partner1",
//         name: "Fulano",
//         last_name: "de Tal",
//         total_trips: "123",
//         member_since: Date.now().toString(),
//         phone_number: "(38) 99999-9999",
//         current_latitude: "-17.217587",
//         current_longitude: "-46.881064",
//         current_zone: "AA",
//         status: "status",
//         vehicle: {},
//         idle_since: now.toString(),
//         rating: "5.0",
//         position: {
//           distance_value: 0,
//         },
//       };
//       // just finished a trip, is right next to client, and has maximum rating
//       defaultPartner2 = {
//         uid: "partner2",
//         name: "Beltrano",
//         last_name: "de Tal",
//         total_trips: "123",
//         member_since: Date.now().toString(),
//         phone_number: "(38) 88888-8888",
//         current_latitude: "-17.217587",
//         current_longitude: "-46.881064",
//         current_zone: "AA",
//         status: "status",
//         vehicle: {},
//         idle_since: now.toString(),
//         rating: "5.0",
//         position: {
//           distance_value: 0,
//         },
//       };
//     });

//     it("partner with more idle time is ranked higher", () => {
//       // partner 1 has more idle time
//       defaultPartner1.idle_since = (now - 300).toString();

//       // partner 2 comes first initially
//       let partners = [defaultPartner2, defaultPartner1];

//       const rankedPartners = rankPartners(partners);

//       // now, partner 1 comes first
//       assert.equal(rankedPartners[0].uid, "partner1");
//     });

//     it("partner with more higher rating is ranked higher", () => {
//       // partner 2 has lower rating
//       defaultPartner2.rating = "4";

//       // partner 2 comes first initially
//       let partners = [defaultPartner2, defaultPartner1];

//       const rankedPartners = rankPartners(partners);

//       // now, partner 1 comes first
//       assert.equal(rankedPartners[0].uid, "partner1");
//     });

//     it("partner closer to the client is ranked higher", () => {
//       // partner 2 is farther away from client
//       defaultPartner2.position.distance_value = 1000;

//       // partner 2 comes first initially
//       let partners = [defaultPartner2, defaultPartner1];

//       const rankedPartners = rankPartners(partners);

//       // now, partner 1 comes first
//       assert.equal(rankedPartners[0].uid, "partner1");
//     });
//   });
// });
