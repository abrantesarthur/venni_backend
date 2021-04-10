const chai = require("chai");
const assert = chai.assert;
const expect = chai.expect;

describe("pilots", () => {
  let p;
  before(() => {
    p = require("../lib/pilots");
  });

  describe("pilosFromObj", () => {
    it("outputs empty list when obj is empty", () => {
      const pilots = p.pilotsFromObj({});
      assert.equal(pilots.length, 0);
    });

    it("outputs empty list when obj doesn't conform to PilotInterface", () => {
      const pilots = p.pilotsFromObj({
        invalid_pilot: {
          invalid_uid: "invalid",
        },
      });
      assert.equal(pilots.length, 0);
    });

    it("ignores irrelevant fields in obj that don't conform to PilotInterface", () => {
      const pilots = p.pilotsFromObj({
        valid_pilot: {
          irrelevant_field: "irrelevant",
          uid: "first_pilot_uid",
          current_client_uid: "",
          current_latitude: 10.123456,
          current_longitude: 11.123456,
          current_zone: "AA",
          status: "available",
          vehicles: [
            {
              brand: "honda",
              model: "cg-150",
              year: 2015,
              plate: "AAA-0000",
            },
          ],
          idle_since: Date.now(),
          rating: 4.79,
        },
      });
      assert.equal(pilots.length, 1);
      assert.equal(pilots[0].irrelevant_field, undefined);
      assert.equal(pilots[0].current_client_uid, "");
    });

    it("doesn't failt when obj misses optional fields", () => {
      const pilots = p.pilotsFromObj({
        valid_pilot: {
          uid: "first_pilot_uid",
          current_latitude: 10.123456,
          current_longitude: 11.123456,
          current_zone: "AA",
          status: "available",
          vehicles: [
            {
              brand: "honda",
              model: "cg-150",
              year: 2015,
              plate: "AAA-0000",
            },
          ],
          idle_since: Date.now(),
          rating: 4.79,
        },
      });
      assert.equal(pilots.length, 1);
      assert.equal(pilots[0].current_client_uid, undefined);
      assert.equal(pilots[0].score, undefined);
      assert.equal(pilots[0].position, undefined);
    });

    it("outputs PilotInterface list when parameters are valid", () => {
      let idleSince = Date.now();
      let rating = 4.79;
      const obj = {
        first_pilot_uid: {
          uid: "first_pilot_uid",
          current_client_uid: "",
          current_latitude: 10.123456,
          current_longitude: 11.123456,
          current_zone: "AA",
          status: "available",
          vehicles: [
            {
              brand: "honda",
              model: "cg-150",
              year: 2015,
              plate: "AAA-0000",
            },
          ],
          idle_since: idleSince,
          rating: rating,
        },
      };

      // convert pilots obj into PilotInterface list
      const pilots = p.pilotsFromObj(obj);

      assert.equal(pilots.length, 1);
      assert.equal(pilots[0].uid, "first_pilot_uid");
      assert.equal(pilots[0].current_client_uid, "");
      assert.equal(pilots[0].current_latitude, 10.123456);
      assert.equal(pilots[0].current_longitude, 11.123456);
      assert.equal(pilots[0].current_zone, "AA");
      assert.equal(pilots[0].status, "available");
      assert.equal(pilots[0].idle_since, idleSince);
      assert.equal(pilots[0].rating, rating);
      assert.equal(pilots[0].vehicles.length, 1);
      assert.equal(pilots[0].vehicles[0].brand, "honda");
      assert.equal(pilots[0].vehicles[0].model, "cg-150");
      assert.equal(pilots[0].vehicles[0].year, 2015);
      assert.equal(pilots[0].vehicles[0].plate, "AAA-0000");
      assert.equal(pilots[0].score, undefined);
      assert.equal(pilots[0].position, undefined);
    });
  });

  const expectThrowsAsync = async (method, errorCode, errorMessage) => {
    let error = null;
    try {
      await method();
    } catch (err) {
      error = err;
    }
    expect(error).to.be.an("Error");
    expect(error.message).to.equal(errorMessage);
    expect(error.code).to.equal(errorCode);
  };

  describe("assignPilotDistances", () => {
    let defaultOriginPlaceID;
    let defaultPilots;

    before(() => {
      defaultOriginPlaceID = "ChIJzY-urWVKqJQRGA8-aIMZJ4I";
      defaultPilots = [
        {
          uid: "uid",
          current_latitude: -17.217587,
          current_longitude: -46.881064,
          current_zone: "AA",
          status: "available",
          vehicles: [],
          idle_since: Date.now(),
          rating: 5.0,
        },
      ];
    });

    it("works", async () => {
      assert.isTrue(defaultPilots[0].position == undefined);

      const pilotsWithDistances = await p.assignPilotDistances(
        defaultOriginPlaceID,
        defaultPilots,
        process.env.GOOGLE_MAPS_API_KEY
      );

      assert.isTrue(pilotsWithDistances[0].position != undefined);
      assert.equal(pilotsWithDistances[0].position.distance_text, "0,9 km");
      assert.equal(pilotsWithDistances[0].position.distance_value, "927");
    });

    it("throws error on wrong api key", async () => {
      await expectThrowsAsync(
        () =>
          p.assignPilotDistances(
            defaultOriginPlaceID,
            defaultPilots,
            "WRONGAPIKEY"
          ),
        "internal",
        "failed to communicate with Google Distance Matrix API."
      );
    });
  });

  describe("distanceScore", () => {
    it("yields 0 points for distances greater than 4999 meters", () => {
      assert.isBelow(p.distanceScore(4999), 1);
      assert.equal(p.distanceScore(5000), 0);
      assert.equal(p.distanceScore(10000), 0);
    });

    it("yields 50 points for distances smaller than 100 meters", () => {
      assert.equal(p.distanceScore(100), 50);
      assert.equal(p.distanceScore(0), 50);
    });

    it("yields between 0 and 50 points for distances between 100 and 5000 meters", () => {
      for (var i = 150; i < 5000; i = i + 50) {
        assert.isAbove(p.distanceScore(i), 0);
        assert.isBelow(p.distanceScore(i), 50);
      }
    });
  });

  describe("distanceScore", () => {
    it("yields 0 points for ratings smaller than 3", () => {
      assert.equal(p.ratingScore(3), 0);
      assert.equal(p.ratingScore(0), 0);
    });

    it("yields 10 points for ratings greater or equal to 5", () => {
      assert.equal(p.ratingScore(5), 10);
      assert.equal(p.ratingScore(7), 10);
    });

    it("yields between 0 and 10 points for ratings between 3 and 5 meters", () => {
      for (var i = 3.1; i < 5; i = i + 0.1) {
        assert.isAbove(p.ratingScore(i), 0);
        assert.isBelow(p.ratingScore(i), 10);
      }
    });
  });

  describe("idleScore", () => {
    it("yields 0 points for idleness equal to 0 seconds", () => {
      assert.equal(p.idleTimeScore(0), 0);
    });

    it("yields 40 points for idleness equal to 5 minutes", () => {
      assert.equal(p.idleTimeScore(300), 40);
    });

    it("yields between 0 and 40 points for idleness between 0 and 5 minutes", () => {
      for (var i = 10; i < 300; i = i + 10) {
        assert.isAbove(p.idleTimeScore(i), 0);
        assert.isBelow(p.idleTimeScore(i), 40);
      }
    });

    it("yields more than 40 points for idleness longer than 5 minutes", () => {
      for (var i = 310; i < 3000; i = i + 10) {
        assert.isAbove(p.idleTimeScore(i), 40);
      }
    });
  });

  describe("rankPilots", () => {
    let defaultPilot1;
    let defaultPilot2;
    let now;
    before(() => {
      now = Date.now();
      // just finished a trip, is right next to client, and has maximum rating
      defaultPilot1 = {
        uid: "pilot1",
        current_latitude: -17.217587,
        current_longitude: -46.881064,
        current_zone: "AA",
        status: "status",
        vehicles: [],
        idle_since: now,
        rating: 5.0,
        position: {
          distance_value: 0,
        },
      };
      // just finished a trip, is right next to client, and has maximum rating
      defaultPilot2 = {
        uid: "pilot2",
        current_latitude: -17.217587,
        current_longitude: -46.881064,
        current_zone: "AA",
        status: "status",
        vehicles: [],
        idle_since: now,
        rating: 5.0,
        position: {
          distance_value: 0,
        },
      };
    });

    it("pilot with more idle time is ranked higher", () => {
      // pilot 1 has more idle time
      defaultPilot1.idle_since = now - 300;

      // pilot 2 comes first initially
      let pilots = [defaultPilot2, defaultPilot1];

      const rankedPilots = p.rankPilots(pilots);

      // now, pilot 1 comes first
      assert.equal(rankedPilots[0].uid, "pilot1");
    });

    it("pilot with more higher rating is ranked higher", () => {
      // pilot 2 has lower rating
      defaultPilot2.rating = 4;

      // pilot 2 comes first initially
      let pilots = [defaultPilot2, defaultPilot1];

      const rankedPilots = p.rankPilots(pilots);

      // now, pilot 1 comes first
      assert.equal(rankedPilots[0].uid, "pilot1");
    });

    it("pilot closer to the client is ranked higher", () => {
      // pilot 2 is farther away from client
      defaultPilot2.position.distance_value = 1000;

      // pilot 2 comes first initially
      let pilots = [defaultPilot2, defaultPilot1];

      const rankedPilots = p.rankPilots(pilots);

      // now, pilot 1 comes first
      assert.equal(rankedPilots[0].uid, "pilot1");
    });
  });

  describe("filterPilotsByZone", () => {
    let pilotBB;
    let pilotCC;
    let pilotHD;
    before(() => {
      pilotBB = {
        uid: "pilotBB",
        current_zone: "BB",
      };
      pilotCC = {
        uid: "pilotCC",
        current_zone: "CC",
      };
      pilotHD = {
        uid: "pilotHD",
        current_zone: "HD",
      };
    });

    it("returns only pilots in current zone if found at least three pilots in zone", () => {
      let twoPilotsInBB = [pilotBB, pilotBB, pilotCC];
      let filteredPilots = p.filterPilotsByZone("BB", twoPilotsInBB);
      console.log(twoPilotsInBB);
      console.log(filteredPilots);

      // function returns pilot in zone CC since zone BB has only two pilots
      assert.equal(filteredPilots.length, 3);
      assert.equal(filteredPilots[0].uid, "pilotBB");
      assert.equal(filteredPilots[1].uid, "pilotBB");
      assert.equal(filteredPilots[2].uid, "pilotCC");
    });
  });
});
