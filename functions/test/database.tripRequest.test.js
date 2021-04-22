const tr = require("../lib/database/tripRequest");
const chai = require("chai");

const assert = chai.assert;

describe("TripRequest.Interface", () => {
  describe("is", () => {
    it("returns false when object is undefined", () => {
      assert.equal(tr.TripRequest.Interface.is(undefined), false);
    });
    it("returns false when object is null", () => {
      assert.equal(tr.TripRequest.Interface.is(null), false);
    });
    it("returns true when object is TripRequest.Interface", () => {
      const obj = {
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
      };
      assert.equal(tr.TripRequest.Interface.is(obj), true);
    });
  });

  describe("fromObj", () => {
    it("returns undefined if obj is null", () => {
      assert.isUndefined(tr.TripRequest.Interface.fromObj(null));
    });
    it("returns undefined if obj is undefined", () => {
      assert.isUndefined(tr.TripRequest.Interface.fromObj(undefined));
    });

    it("returns TripRequest.Interface if obj is TripRequest.Interface", () => {
      const obj = {
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
      };
      const response = tr.TripRequest.Interface.fromObj(obj);
      assert.isDefined(response);
      assert.equal(response.uid, "uid");
      assert.equal(response.trip_status, "trip_status");
      assert.equal(response.origin_place_id, "origin_place_id");
      assert.equal(response.destination_place_id, "destination_place_id");
      assert.equal(response.origin_zone, "origin_zone");
      assert.equal(response.fare_price, "fare_price");
      assert.equal(response.distance_meters, "distance_meters");
      assert.equal(response.distance_text, "distance_text");
      assert.equal(response.duration_seconds, "duration_seconds");
      assert.equal(response.duration_text, "duration_text");
      assert.equal(response.encoded_points, "encoded_points");
      assert.equal(response.request_time, "request_time");
      assert.equal(response.origin_address, "origin_address");
      assert.equal(response.destination_address, "destination_address");
    });
  });
});
