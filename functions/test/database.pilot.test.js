const tr = require("../lib/database/Pilot");
const chai = require("chai");

const assert = chai.assert;

describe("Pilot.Interface", () => {
  describe("is", () => {
    it("returns false when object is undefined", () => {
      assert.equal(tr.Pilot.Interface.is(undefined), false);
    });
    it("returns false when object is null", () => {
      assert.equal(tr.Pilot.Interface.is(null), false);
    });

    it("returns false if obj contains vehicle that is not a Vehicle.Interface", () => {
      const obj = {
        uid: "uid",
        name: "name",
        last_name: "last_name",
        total_trips: "total_trips",
        member_since: "member_since",
        phone_number: "phone_number",
        current_latitude: "current_latitude",
        current_longitude: "current_longitude",
        current_zone: "current_zone",
        status: "status",
        vehicle: {
          brand: "brand",
        },
        idle_since: "idle_since",
        rating: "rating",
      };

      assert.equal(tr.Pilot.Interface.is(obj), false);
    });

    it("returns true if obj is Pilot.Interface", () => {
      const obj = {
        uid: "uid",
        name: "name",
        last_name: "last_name",
        total_trips: "total_trips",
        member_since: "member_since",
        phone_number: "phone_number",
        current_latitude: "current_latitude",
        current_longitude: "current_longitude",
        current_zone: "current_zone",
        status: "status",
        vehicle: {
          brand: "brand",
          model: "model",
          year: "year",
          plate: "plate",
        },
        idle_since: "idle_since",
        rating: "rating",
      };
      assert.equal(tr.Pilot.Interface.is(obj), true);
    });
  });

  describe("fromObj", () => {
    it("returns empty list if obj is null", () => {
      assert.isEmpty(tr.Pilot.Interface.fromObj(null));
    });
    it("returns empty list if obj is undefined", () => {
      assert.isEmpty(tr.Pilot.Interface.fromObj(undefined));
    });
    it("returns list of Pilot.Interface if obj is Pilot.Interface", () => {
      const obj = {
        first_pilot: {
          uid: "uid",
          name: "name",
          last_name: "last_name",
          total_trips: "total_trips",
          member_since: "member_since",
          phone_number: "phone_number",
          current_latitude: "current_latitude",
          current_longitude: "current_longitude",
          current_zone: "current_zone",
          status: "status",
          vehicle: {
            brand: "brand",
            model: "model",
            year: "year",
            plate: "plate",
          },
          idle_since: "idle_since",
          rating: "rating",
        },
      };

      const response = tr.Pilot.Interface.fromObj(obj);
      assert.isNotEmpty(response);
      assert.equal(response.length, 1);
      assert.equal(response[0].uid, "uid");
    });
  });
});
