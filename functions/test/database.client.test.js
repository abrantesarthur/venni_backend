const Client = require("../lib/database/client");
const chai = require("chai");

const assert = chai.assert;

describe("Client.Interface", () => {
  describe("is", () => {
    it("returns false when object is undefined", () => {
      assert.equal(Client.Client.Interface.is(undefined), false);
    });
    it("returns false when object is null", () => {
      assert.equal(Client.Client.Interface.is(null), false);
    });

    it("returns true when all required fields are present", () => {
      const obj = {
        uid: "clientUID",
        rating: 5,
      };
      assert.equal(Client.Client.Interface.is(obj), true);
    });

    it("returns false when past_trips is not TripRequest.Interface", () => {
      const obj = {
        uid: "clientUID",
        rating: 5,
        past_trips: {
          first_past_trip: {
            uid: "invalid_trip",
          },
        },
      };
      assert.equal(Client.Client.Interface.is(obj), false);
    });

    it("returns true when past_trips is TripRequest.Interface", () => {
      const obj = {
        uid: "clientUID",
        rating: 5,
        past_trips: {
          first_past_trip: {
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
          },
        },
      };
      assert.equal(Client.Client.Interface.is(obj), true);
    });
  });

  describe("fromObj", () => {
    it("returns undefined if obj is null", () => {
      assert.equal(Client.Client.Interface.fromObj(null), undefined);
    });
    it("returns undefined if obj is undefined", () => {
      assert.equal(Client.Client.Interface.fromObj(undefined), undefined);
    });

    it("returns undefined if obj is not Client.Interface I", () => {
      const obj = {
        uid: "clientUID",
      };
      assert.equal(Client.Client.Interface.fromObj(obj), undefined);
    });

    it("returns undefined if obj is not Client.Interface II", () => {
      const obj = {
        rating: 5,
      };
      assert.equal(Client.Client.Interface.fromObj(obj), undefined);
    });

    it("returns Client.Interface if obj is Client.Interface without past_trips", () => {
      const obj = {
        uid: "clientUID",
        rating: 5,
      };

      const response = Client.Client.Interface.fromObj(obj);
      assert.isDefined(response);
      assert.equal(response.uid, "clientUID");
      assert.equal(response.rating, 5);
      assert.isDefined(response.past_trips);
      assert.equal(response.past_trips.length, 0);
    });

    it("returns Client.Interface if obj is Client.Interface with past_trips", () => {
      const obj = {
        uid: "clientUID",
        rating: 5,
        past_trips: {
          first_past_trip: {
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
            rating: 4,
          },
        },
      };

      const response = Client.Client.Interface.fromObj(obj);
      assert.isDefined(response);
      assert.equal(response.uid, "clientUID");
      assert.equal(response.rating, 5);
      assert.isDefined(response.past_trips);
      assert.equal(response.past_trips.length, 1);
      assert.equal(response.past_trips[0].uid, "uid");
      assert.isUndefined(response.past_trips[0].driver_id);
      assert.isDefined(response.past_trips[0].rating);
      assert.equal(response.past_trips[0].rating, 4);
    });
  });
});
