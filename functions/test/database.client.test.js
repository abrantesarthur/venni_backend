const Client = require("../lib/database/client");
const chai = require("chai");
const admin = require("firebase-admin");
const { ClientPastTrips } = require("../lib/database/pastTrips");

const assert = chai.assert;

describe("Client", () => {
  before(() => {
    if (admin.apps.length == 0) {
      admin.initializeApp();
    }
  });

  describe("Class", () => {
    let c;
    let clientID;
    let pilotID;
    let defaultClient;
    let defaultTrip;
    before(async () => {
      clientID = "clientID";
      pilotID = "pilotID";
      defaultClient = {
        uid: clientID,
        rating: "5",
      };
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
      c = new Client.Client(clientID);

      // clear database
      await admin.database().ref("clients").remove();
      await admin.database().ref("past-trips").remove();
    });

    after(async () => {
      // clear database
      await admin.database().ref("clients").remove();
      await admin.database().ref("past-trips").remove();
    });

    describe("getClient", () => {
      it("returns undefined if there is no client in database", async () => {
        let result = await c.getClient();
        assert.isUndefined(result);
      });

      it("returns Client.Interface if there is a client in database", async () => {
        // add client to the database
        await admin
          .database()
          .ref("clients")
          .child(clientID)
          .set(defaultClient);
        // assert client was returned
        let result = await c.getClient();
        assert.isDefined(result);
        assert.equal(result.uid, clientID);
        assert.equal(result.rating, "5");
        // clear database
        await admin.database().ref("clients").remove();
      });
    });

    describe("addClient", () => {
      it("returns Client.Interface if there is a client in database", async () => {
        // assert there is no client in database
        let result = await c.getClient();
        assert.isUndefined(result);
        // add client to the database
        await c.addClient(defaultClient);
        // assert a client was added
        result = await c.getClient();
        assert.isDefined(result);
        // clear database
        await admin.database().ref("clients").remove();
      });
    });

    describe("pushPastTripAndRate", () => {
      it("pushes a past trip with client_rating to client's list of past trips", async () => {
        // assert client has no past trips
        let cpt = new ClientPastTrips(clientID);
        let pastTripsCount = await cpt.getPastTripsCount();
        assert.equal(pastTripsCount, 0);

        // call pushPastTripAndRate
        await c.pushPastTripAndRate(defaultTrip, 2);

        // assert client now has a past trip with client_rating
        let pastTrips = await cpt.getPastTrips();
        assert.equal(pastTrips.length, 1);
        assert.equal(pastTrips[0].client_rating, "2.00");

        // clear database
        await admin.database().ref("past-trips").remove();
      });

      it("rates clients with a 5 when they have less than 5 past trips", async () => {
        // add client to database
        await c.addClient(defaultClient);

        let result = await c.getClient();
        assert.isDefined(result);

        // call pushPastTripAndRate
        let rate = 2;
        await c.pushPastTripAndRate(defaultTrip, rate);

        // after rating,because client has less than 5 trips, his rating is 5

        result = await c.getClient();
        assert.isDefined(result);
        assert.equal(result.rating, "5.00");

        // clear database
        await admin.database().ref("clients").remove();
        await admin.database().ref("past-trips").remove();
      });
    });
  });

  describe("Interface", () => {
    describe("is", () => {
      it("returns false when object is undefined", () => {
        assert.equal(Client.Client.Interface.is(undefined), false);
      });
      it("returns false when object is null", () => {
        assert.equal(Client.Client.Interface.is(null), false);
      });

      it("returns false if contains an invalid field", () => {
        const obj = {
          uid: "clientUID",
          rating: "5",
          invalid_field: "invalid_field",
        };
        assert.equal(Client.Client.Interface.is(obj), false);
      });

      it("returns true when all required fields are present", () => {
        const obj = {
          uid: "clientUID",
          rating: "5",
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
          rating: "5",
        };
        assert.equal(Client.Client.Interface.fromObj(obj), undefined);
      });

      it("returns Client.Interface if obj is Client.Interface I", () => {
        const obj = {
          uid: "clientUID",
          rating: "5",
        };

        const response = Client.Client.Interface.fromObj(obj);
        assert.isDefined(response);
        assert.equal(response.uid, "clientUID");
        assert.equal(response.rating, "5");
      });

      it("returns Client.Interface if obj is Client.Interface II", () => {
        const obj = {
          uid: "clientUID",
          rating: "5",
        };

        const response = Client.Client.Interface.fromObj(obj);
        assert.isDefined(response);
        assert.equal(response.uid, "clientUID");
        assert.equal(response.rating, "5");
      });
    });
  });
});
