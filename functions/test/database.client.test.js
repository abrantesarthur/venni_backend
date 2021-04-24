const Client = require("../lib/database/client");
const chai = require("chai");
const admin = require("firebase-admin");

const assert = chai.assert;

describe("Client.Interface", () => {
  before(() => {
    if (admin.apps.length == 0) {
      admin.initializeApp();
    }
  });

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

    it("returns Client.Interface if obj is Client.Interface I", () => {
      const obj = {
        uid: "clientUID",
        rating: 5,
      };

      const response = Client.Client.Interface.fromObj(obj);
      assert.isDefined(response);
      assert.equal(response.uid, "clientUID");
      assert.equal(response.rating, 5);
      assert.isUndefined(response.total_rating);
      assert.isUndefined(response.total_rated_trips);
    });

    it("returns Client.Interface if obj is Client.Interface II", () => {
      const obj = {
        uid: "clientUID",
        rating: 5,
        total_rated_trips: 1,
        total_rating: 1,
      };

      const response = Client.Client.Interface.fromObj(obj);
      assert.isDefined(response);
      assert.equal(response.uid, "clientUID");
      assert.equal(response.rating, 5);
      assert.isDefined(response.total_rated_trips);
      assert.isDefined(response.total_rating);
      assert.equal(response.total_rated_trips, 1);
      assert.equal(response.total_rating, 1);
    });
  });
});
