// const chai = require("chai");
// const assert = chai.assert;
// const expect = chai.expect;
// const admin = require("firebase-admin");

// describe("pilots", () => {
//   let interfaces;
//   let p;
//   before(() => {
//     p = require("../lib/pilots");
//     interfaces = require("../lib/interfaces");
//     if (admin.apps.length == 0) {
//       admin.initializeApp();
//     }
//   });

//   describe("pilosFromObj", () => {
//     it("outputs empty list when obj is empty", () => {
//       const pilots = interfaces.pilotsFromObj({});
//       assert.equal(pilots.length, 0);
//     });

//     it("outputs empty list when obj doesn't conform to PilotInterface", () => {
//       const pilots = interfaces.pilotsFromObj({
//         invalid_pilot: {
//           invalid_uid: "invalid",
//         },
//       });
//       assert.equal(pilots.length, 0);
//     });

//     it("ignores irrelevant fields in obj that don't conform to PilotInterface", () => {
//       const pilots = interfaces.pilotsFromObj({
//         valid_pilot: {
//           irrelevant_field: "irrelevant",
//           uid: "first_pilot_uid",
//           name: "Fulano",
//           last_name: "de Tal",
//           total_trips: 123,
//           member_since: Date.now(),
//           phone_number: "(38) 99999-9999",
//           current_client_uid: "",
//           current_latitude: 10.123456,
//           current_longitude: 11.123456,
//           current_zone: "AA",
//           status: "available",
//           vehicle: {
//             brand: "honda",
//             model: "cg-150",
//             year: 2015,
//             plate: "AAA-0000",
//           },
//           idle_since: Date.now(),
//           rating: 4.79,
//         },
//       });
//       assert.equal(pilots.length, 1);
//       assert.equal(pilots[0].irrelevant_field, undefined);
//       assert.equal(pilots[0].current_client_uid, "");
//     });

//     it("doesn't failt when obj misses optional fields", () => {
//       const pilots = interfaces.pilotsFromObj({
//         valid_pilot: {
//           uid: "first_pilot_uid",
//           name: "Fulano",
//           last_name: "de Tal",
//           total_trips: 123,
//           member_since: Date.now(),
//           phone_number: "(38) 99999-9999",
//           current_latitude: 10.123456,
//           current_longitude: 11.123456,
//           current_zone: "AA",
//           status: "available",
//           vehicle: {
//             brand: "honda",
//             model: "cg-150",
//             year: 2015,
//             plate: "AAA-0000",
//           },
//           idle_since: Date.now(),
//           rating: 4.79,
//         },
//       });
//       assert.equal(pilots.length, 1);
//       assert.equal(pilots[0].current_client_uid, undefined);
//       assert.equal(pilots[0].score, undefined);
//       assert.equal(pilots[0].position, undefined);
//     });

//     it("outputs PilotInterface list when parameters are valid", () => {
//       let idleSince = Date.now();
//       let rating = 4.79;
//       const obj = {
//         first_pilot_uid: {
//           uid: "first_pilot_uid",
//           name: "Fulano",
//           last_name: "de Tal",
//           total_trips: 123,
//           member_since: Date.now(),
//           phone_number: "(38) 99999-9999",
//           current_client_uid: "",
//           current_latitude: 10.123456,
//           current_longitude: 11.123456,
//           current_zone: "AA",
//           status: "available",
//           vehicle: {
//             brand: "honda",
//             model: "cg-150",
//             year: 2015,
//             plate: "AAA-0000",
//           },
//           idle_since: idleSince,
//           rating: rating,
//         },
//       };

//       // convert pilots obj into PilotInterface list
//       const pilots = interfaces.pilotsFromObj(obj);

//       assert.equal(pilots.length, 1);
//       assert.equal(pilots[0].uid, "first_pilot_uid");
//       assert.equal(pilots[0].current_client_uid, "");
//       assert.equal(pilots[0].current_latitude, 10.123456);
//       assert.equal(pilots[0].current_longitude, 11.123456);
//       assert.equal(pilots[0].current_zone, "AA");
//       assert.equal(pilots[0].status, "available");
//       assert.equal(pilots[0].idle_since, idleSince);
//       assert.equal(pilots[0].rating, rating);
//       assert.equal(pilots[0].vehicle.brand, "honda");
//       assert.equal(pilots[0].vehicle.model, "cg-150");
//       assert.equal(pilots[0].vehicle.year, 2015);
//       assert.equal(pilots[0].vehicle.plate, "AAA-0000");
//       assert.equal(pilots[0].score, undefined);
//       assert.equal(pilots[0].position, undefined);
//     });
//   });

//   const expectThrowsAsync = async (method, errorCode, errorMessage) => {
//     let error = null;
//     try {
//       await method();
//     } catch (err) {
//       error = err;
//     }
//     expect(error).to.be.an("Error");
//     expect(error.message).to.equal(errorMessage);
//     expect(error.code).to.equal(errorCode);
//   };

//   describe("assignPilotsDistanceToClient", () => {
//     let defaultOriginPlaceID;
//     let defaultPilots;

//     before(() => {
//       defaultOriginPlaceID = "ChIJzY-urWVKqJQRGA8-aIMZJ4I";
//       defaultPilots = [
//         {
//           uid: "uid",
//           name: "Fulano",
//           last_name: "de Tal",
//           phone_number: "(38) 99999-9999",
//           current_latitude: -17.217587,
//           current_longitude: -46.881064,
//           current_zone: "AA",
//           status: "available",
//           vehicle: {},
//           idle_since: Date.now(),
//           rating: 5.0,
//         },
//       ];
//     });

//     it("works", async () => {
//       assert.isTrue(defaultPilots[0].distance_to_client == undefined);

//       const pilotsWithDistances = await p.assignPilotsDistanceToClient(
//         defaultOriginPlaceID,
//         defaultPilots,
//         process.env.GOOGLE_MAPS_API_KEY
//       );

//       assert.isTrue(pilotsWithDistances[0].distance_to_client != undefined);
//       assert.equal(
//         pilotsWithDistances[0].distance_to_client.distance_text,
//         "0,9 km"
//       );
//       assert.equal(
//         pilotsWithDistances[0].distance_to_client.distance_value,
//         "927"
//       );
//     });

//     it("throws error on wrong api key", async () => {
//       await expectThrowsAsync(
//         () =>
//           p.assignPilotsDistanceToClient(
//             defaultOriginPlaceID,
//             defaultPilots,
//             "WRONGAPIKEY"
//           ),
//         "internal",
//         "failed to communicate with Google Distance Matrix API."
//       );
//     });
//   });

//   describe("distanceScore", () => {
//     it("yields 0 points for distances greater than 4999 meters", () => {
//       assert.isBelow(p.distanceScore(4999), 1);
//       assert.equal(p.distanceScore(5000), 0);
//       assert.equal(p.distanceScore(10000), 0);
//     });

//     it("yields 50 points for distances smaller than 100 meters", () => {
//       assert.equal(p.distanceScore(100), 50);
//       assert.equal(p.distanceScore(0), 50);
//     });

//     it("yields between 0 and 50 points for distances between 100 and 5000 meters", () => {
//       for (var i = 150; i < 5000; i = i + 50) {
//         assert.isAbove(p.distanceScore(i), 0);
//         assert.isBelow(p.distanceScore(i), 50);
//       }
//     });
//   });

//   describe("distanceScore", () => {
//     it("yields 0 points for ratings smaller than 3", () => {
//       assert.equal(p.ratingScore(3), 0);
//       assert.equal(p.ratingScore(0), 0);
//     });

//     it("yields 10 points for ratings greater or equal to 5", () => {
//       assert.equal(p.ratingScore(5), 10);
//       assert.equal(p.ratingScore(7), 10);
//     });

//     it("yields between 0 and 10 points for ratings between 3 and 5 meters", () => {
//       for (var i = 3.1; i < 5; i = i + 0.1) {
//         assert.isAbove(p.ratingScore(i), 0);
//         assert.isBelow(p.ratingScore(i), 10);
//       }
//     });
//   });

//   describe("idleScore", () => {
//     it("yields 0 points for idleness equal to 0 seconds", () => {
//       assert.equal(p.idleTimeScore(0), 0);
//     });

//     it("yields 40 points for idleness equal to 5 minutes", () => {
//       assert.equal(p.idleTimeScore(300), 40);
//     });

//     it("yields between 0 and 40 points for idleness between 0 and 5 minutes", () => {
//       for (var i = 10; i < 300; i = i + 10) {
//         assert.isAbove(p.idleTimeScore(i), 0);
//         assert.isBelow(p.idleTimeScore(i), 40);
//       }
//     });

//     it("yields more than 40 points for idleness longer than 5 minutes", () => {
//       for (var i = 310; i < 3000; i = i + 10) {
//         assert.isAbove(p.idleTimeScore(i), 40);
//       }
//     });
//   });

//   describe("rankPilots", () => {
//     let defaultPilot1;
//     let defaultPilot2;
//     let now;
//     before(() => {
//       now = Date.now();
//       // just finished a trip, is right next to client, and has maximum rating
//       defaultPilot1 = {
//         uid: "pilot1",
//         name: "Fulano",
//         last_name: "de Tal",
//         total_trips: 123,
//         member_since: Date.now(),
//         phone_number: "(38) 99999-9999",
//         current_latitude: -17.217587,
//         current_longitude: -46.881064,
//         current_zone: "AA",
//         status: "status",
//         vehicle: {},
//         idle_since: now,
//         rating: 5.0,
//         position: {
//           distance_value: 0,
//         },
//       };
//       // just finished a trip, is right next to client, and has maximum rating
//       defaultPilot2 = {
//         uid: "pilot2",
//         name: "Beltrano",
//         last_name: "de Tal",
//         total_trips: 123,
//         member_since: Date.now(),
//         phone_number: "(38) 88888-8888",
//         current_latitude: -17.217587,
//         current_longitude: -46.881064,
//         current_zone: "AA",
//         status: "status",
//         vehicle: {},
//         idle_since: now,
//         rating: 5.0,
//         position: {
//           distance_value: 0,
//         },
//       };
//     });

//     it("pilot with more idle time is ranked higher", () => {
//       // pilot 1 has more idle time
//       defaultPilot1.idle_since = now - 300;

//       // pilot 2 comes first initially
//       let pilots = [defaultPilot2, defaultPilot1];

//       const rankedPilots = p.rankPilots(pilots);

//       // now, pilot 1 comes first
//       assert.equal(rankedPilots[0].uid, "pilot1");
//     });

//     it("pilot with more higher rating is ranked higher", () => {
//       // pilot 2 has lower rating
//       defaultPilot2.rating = 4;

//       // pilot 2 comes first initially
//       let pilots = [defaultPilot2, defaultPilot1];

//       const rankedPilots = p.rankPilots(pilots);

//       // now, pilot 1 comes first
//       assert.equal(rankedPilots[0].uid, "pilot1");
//     });

//     it("pilot closer to the client is ranked higher", () => {
//       // pilot 2 is farther away from client
//       defaultPilot2.position.distance_value = 1000;

//       // pilot 2 comes first initially
//       let pilots = [defaultPilot2, defaultPilot1];

//       const rankedPilots = p.rankPilots(pilots);

//       // now, pilot 1 comes first
//       assert.equal(rankedPilots[0].uid, "pilot1");
//     });
//   });

//   describe("filterPilotsByZone", () => {
//     let pilotBB;
//     let pilotCC;
//     let pilotHD;
//     before(() => {
//       pilotBB = {
//         uid: "pilotBB",
//         current_zone: "BB",
//       };
//       pilotCC = {
//         uid: "pilotCC",
//         current_zone: "CC",
//       };
//       pilotHD = {
//         uid: "pilotHD",
//         current_zone: "HD",
//       };
//     });

//     it("returns only pilots in current zone if found at least three pilots in zone", () => {
//       let twoPilotsInBB = [pilotBB, pilotBB, pilotCC];
//       let filteredPilots = p.filterPilotsByZone("BB", twoPilotsInBB);

//       // function returns pilot in zone CC since zone BB has only two pilots
//       assert.equal(filteredPilots.length, 3);
//       assert.equal(filteredPilots[0].uid, "pilotBB");
//       assert.equal(filteredPilots[1].uid, "pilotBB");
//       assert.equal(filteredPilots[2].uid, "pilotCC");

//       let threePilotsInBB = [pilotBB, pilotBB, pilotBB, pilotCC];
//       filteredPilots = p.filterPilotsByZone("BB", threePilotsInBB);

//       // function doesn't return pilot in zone CC since zone BB three pilots
//       assert.equal(filteredPilots.length, 3);
//       assert.equal(filteredPilots[0].uid, "pilotBB");
//       assert.equal(filteredPilots[1].uid, "pilotBB");
//       assert.equal(filteredPilots[2].uid, "pilotBB");

//       let fourPilotsInBB = [pilotBB, pilotBB, pilotBB, pilotBB];
//       filteredPilots = p.filterPilotsByZone("BB", fourPilotsInBB);

//       // function returns all pilots in zone BB
//       assert.equal(filteredPilots.length, 4);
//       assert.equal(filteredPilots[0].uid, "pilotBB");
//       assert.equal(filteredPilots[1].uid, "pilotBB");
//       assert.equal(filteredPilots[2].uid, "pilotBB");
//       assert.equal(filteredPilots[3].uid, "pilotBB");
//     });

//     it("returns only pilots in current + adjacent zones if found at least three pilots there", () => {
//       let onePilotInBBOneInCC = [pilotBB, pilotCC, pilotHD];
//       let filteredPilots = p.filterPilotsByZone("BB", onePilotInBBOneInCC);

//       // function returns pilot in zone HD since zone + adjacent have only two pilots
//       assert.equal(filteredPilots.length, 3);
//       assert.equal(filteredPilots[0].uid, "pilotBB");
//       assert.equal(filteredPilots[1].uid, "pilotCC");
//       assert.equal(filteredPilots[2].uid, "pilotHD");

//       let threePilotsInBBAndCC = [pilotBB, pilotBB, pilotCC, pilotHD];
//       filteredPilots = p.filterPilotsByZone("BB", threePilotsInBBAndCC);

//       // function doesn't return pilot in zone HD since zone + adjacent have three pilots
//       assert.equal(filteredPilots.length, 3);
//       assert.equal(filteredPilots[0].uid, "pilotBB");
//       assert.equal(filteredPilots[1].uid, "pilotBB");
//       assert.equal(filteredPilots[2].uid, "pilotCC");

//       let fourPilotsInBBAndCC = [pilotBB, pilotBB, pilotCC, pilotCC];
//       filteredPilots = p.filterPilotsByZone("BB", fourPilotsInBBAndCC);

//       // function returns all pilots in zone + adjacent
//       assert.equal(filteredPilots.length, 4);
//       assert.equal(filteredPilots[0].uid, "pilotBB");
//       assert.equal(filteredPilots[1].uid, "pilotBB");
//       assert.equal(filteredPilots[2].uid, "pilotCC");
//       assert.equal(filteredPilots[3].uid, "pilotCC");
//     });
//   });

//   describe("findPilots", () => {
//     beforeEach(async () => {
//       // clear pilots from database
//       admin.database().ref("pilots").remove();
//     });

//     it("works", async () => {
//       let availableOneInDB = {
//         uid: "availableOneInDB",
//         name: "Fulano",
//         last_name: "de Tal",
//         total_trips: 123,
//         member_since: Date.now(),
//         phone_number: "(38) 99999-9999",
//         current_latitude: -17.221879,
//         current_longitude: -46.875143,
//         current_zone: "DB",
//         status: "available",
//         vehicle: {
//           brand: "honda",
//           year: 2015,
//           model: "cg-150",
//           plate: "aaa-0000",
//         },
//         idle_since: Date.now(),
//         rating: 5.0,
//       };
//       let availableTwoInDC = {
//         uid: "availableTwoInDC",
//         name: "Ciclano",
//         last_name: "de Tal",
//         total_trips: 123,
//         member_since: Date.now(),
//         phone_number: "(38) 77777-8888",
//         current_latitude: -17.221035,
//         current_longitude: -46.863207,
//         current_zone: "DC",
//         status: "available",
//         vehicle: {
//           brand: "honda",
//           year: 2015,
//           model: "cg-150",
//           plate: "aaa-0000",
//         },
//         idle_since: Date.now(),
//         rating: 5.0,
//       };
//       let availableThreeInDC = {
//         uid: "availableThreeInDC",
//         name: "Ciclano",
//         last_name: "de Fulano",
//         total_trips: 123,
//         member_since: Date.now(),
//         phone_number: "(38) 77777-8888",
//         current_latitude: -17.221471,
//         current_longitude: -46.86266,
//         current_zone: "DC",
//         status: "available",
//         vehicle: {
//           brand: "honda",
//           year: 2015,
//           model: "cg-150",
//           plate: "aaa-0000",
//         },
//         idle_since: Date.now(),
//         rating: 5.0,
//       };
//       let busyInDC = {
//         uid: "busyInDC",
//         name: "Betrano",
//         last_name: "de Ciclano",
//         total_trips: 123,
//         member_since: Date.now(),
//         phone_number: "(38) 77777-8888",
//         current_latitude: -17.222722,
//         current_longitude: -46.861959,
//         current_zone: "DC",
//         status: "busy",
//         vehicle: {
//           brand: "honda",
//           year: 2015,
//           model: "cg-150",
//           plate: "aaa-0000",
//         },
//         idle_since: Date.now(),
//         rating: 5.0,
//       };

//       // add pilots to database
//       await admin.database().ref("pilots").set({
//         availableOneInDB: availableOneInDB,
//         availableTwoInDC: availableTwoInDC,
//         availableThreeInDC: availableThreeInDC,
//         busyInDC: busyInDC,
//       });

//       // find available pilots near zone DC
//       const pilots = await p.findPilots({
//         origin_zone: "DC",
//         origin_place_id: "ChIJGwWotolKqJQREFaef54gf3k",
//       });

//       assert.equal(pilots.length, 3);
//       assert.equal(pilots[0].uid, "availableThreeInDC");
//       assert.equal(pilots[1].uid, "availableTwoInDC");
//       assert.equal(pilots[2].uid, "availableOneInDB");
//     });
//   });
// });
