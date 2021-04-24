const pt = require("../lib/database/pastTrips");
const chai = require("chai");

const assert = chai.assert;

describe("PastTrips", () => {
  let pastTrips;
  before(() => {
    pastTrips = pt.PastTrips;
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
          driver_rating: "driver_rating",
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
