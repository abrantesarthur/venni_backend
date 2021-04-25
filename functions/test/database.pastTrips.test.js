const pt = require("../lib/database/pastTrips");
const chai = require("chai");
const admin = require("firebase-admin");

const assert = chai.assert;

describe("PastTrips", () => {
  let clientID;
  let pilotID;
  let pastTrips;
  let p;
  before(() => {
    if (admin.apps.length == 0) {
      admin.initializeApp();
    }
    clientID = "clientID";
    pilotID = "pilotID";
    pastTrips = pt.PastTrips;
    p = new pt.PastTrips("clients", clientID);
    defaultTrip = {
      uid: clientID,
      trip_status: "completed",
      origin_place_id: "origin_place_id",
      destination_place_id: "destination_place_id",
      origin_zone: "AA",
      fare_price: 5,
      distance_meters: 100,
      distance_text: "100 metes",
      duration_seconds: 300,
      duration_text: "5 minutes",
      encoded_points: "encoded_points",
      request_time: Date.now().toString(),
      origin_address: "origin_address",
      destination_address: "destination_address",
      driver_id: pilotID,
    };
  });

  describe("getPastTrips", () => {
    it("returns empty list if user has no past trips", async () => {
      let result = await p.getPastTrips();
      assert.isEmpty(result);
    });

    it("returns list of user's past trips if user has past trips", async () => {
      // add past trips to the user
      await p.pushPastTrip(defaultTrip);

      // assert that user has past trips
      let result = await p.getPastTrips();
      assert.isNotEmpty(result);

      // clear database
      await admin.database().ref("past-trips").remove();
    });
  });

  describe("getPastTripsCount", () => {
    it("returns zero user has no past trips", async () => {
      let result = await p.getPastTripsCount();
      assert.equal(result, 0);
    });

    it("returns number of user's past trips if user has past trips", async () => {
      // add past trips to the user
      await p.pushPastTrip(defaultTrip);

      // assert that user has past trips
      let result = await p.getPastTripsCount();
      assert.equal(result, 1);

      // clear database
      await admin.database().ref("past-trips").remove();
    });
  });

  describe("pushPastTrip", () => {
    it("adds past trip to user's list of past trips", async () => {
      // assert user has no past trips
      let result = await p.getPastTripsCount();
      assert.equal(result, 0);

      // add past trips to the user
      await p.pushPastTrip(defaultTrip);

      // assert that user has past trips
      result = await p.getPastTripsCount();
      assert.equal(result, 1);

      // clear database
      await admin.database().ref("past-trips").remove();
    });
  });

  describe("fromObjs", () => {
    it("returns empty list if obj is null", () => {
      assert.isEmpty(pastTrips.fromObjs(null));
    });
    it("returns empty list if obj is undefined", () => {
      assert.isEmpty(pastTrips.fromObjs(undefined));
    });

    it("returns list of TripRequest.Interface if obj is list of TripRequest.Interface", () => {
      const obj = {
        first_trip: {
          uid: "uid",
          trip_status: "trip_status",
          origin_place_id: "origin_place_id",
          destination_place_id: "destination_place_id",
          origin_zone: "origin_zone",
          fare_price: "fare_price",
          distance_meters: "distance_meters",
          distance_text: "distance_text",
          duration_seconds: "duration_seconds",
          duration_text: "duration_text",
          encoded_points: "encoded_points",
          request_time: "request_time",
          origin_address: "origin_address",
          destination_address: "destination_address",
          driver_id: "driver_id",
          client_rating: "client_rating",
          driver_rating: {
            score: "4",
          },
          pilot_past_trip_ref_key: "pilot_past_trip_ref_key",
        },
      };

      const response = pastTrips.fromObjs(obj);
      assert.isNotEmpty(response);
      assert.equal(response.length, 1);
      assert.equal(response[0].uid, "uid");
    });
  });
});
