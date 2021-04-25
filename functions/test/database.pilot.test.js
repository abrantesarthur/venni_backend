const p = require("../lib/database/Pilot");
const chai = require("chai");
const admin = require("firebase-admin");
const { PilotPastTrips } = require("../lib/database/pastTrips");

const assert = chai.assert;

describe("Pilot", () => {
  let Pilot;
  before(() => {
    if (admin.apps.length == 0) {
      admin.initializeApp();
    }
  });

  describe("Class", () => {
    let clientID;
    let pilotID;
    let defaultPilot;
    let defaultClient;
    let defaultTrip;
    before(async () => {
      clientID = "clientID";
      pilotID = "pilotID";
      defaultPilot = {
        uid: pilotID,
        name: "name",
        last_name: "last_name",
        member_since: (Date.now() - 100000000).toString(),
        phone_number: "phone_number",
        current_latitude: "-16",
        current_longitude: "42",
        current_zone: "AA",
        status: "busy",
        current_client_uid: clientID,
        vehicle: {
          brand: "brand",
          model: "model",
          year: 1999,
          plate: "plate",
        },
        idle_since: (Date.now() - 100000).toString(),
        rating: "rating",
      };
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
      Pilot = new p.Pilot(pilotID);

      // clear database
      await admin.database().ref("clients").remove();
      await admin.database().ref("pilots").remove();
      await admin.database().ref("past-trips").remove();
    });

    after(async () => {
      // clear database
      await admin.database().ref("clients").remove();
      await admin.database().ref("pilots").remove();
      await admin.database().ref("past-trips").remove();
    });

    describe("getPilot", () => {
      it("returns undefined if pilot does not exist", async () => {
        let result = await Pilot.getPilot();
        assert.isUndefined(result);
      });

      it("returns Pilot.Interface if pilot exists", async () => {
        // add pilot to database
        await admin.database().ref("pilots").child(pilotID).set(defaultPilot);

        let result = await Pilot.getPilot();
        assert.isDefined(result);

        // clear database
        await admin.database().ref("pilots").remove();
      });
    });

    describe("free", () => {
      it("sets the pilot's status to available, empties its current_client_uid, and resets its idle_time to now", async () => {
        // add pilot to the database
        await admin.database().ref("pilots").child(pilotID).set(defaultPilot);

        // assert pilot hasn't been freed
        let result = await Pilot.getPilot();
        assert.equal(result.uid, pilotID);
        assert.equal(result.status, "busy");
        assert.equal(result.current_client_uid, clientID);
        assert.isBelow(Number(result.idle_since), Date.now() - 1000);

        // call free
        await Pilot.free();

        // assert pilot has been freed
        result = await Pilot.getPilot();
        assert.equal(result.uid, pilotID);
        assert.equal(result.status, "available");
        assert.equal(result.current_client_uid, "");
        assert.isAbove(Number(result.idle_since), Date.now() - 1000);

        // clear database
        await admin.database().ref("pilots").remove();
      });
    });

    describe("pushPastTrip", () => {
      it("pushes trip to pilot's list of past trips", async () => {
        // assert pilot has no past trips
        let ppt = new PilotPastTrips(pilotID);
        let pastTripsCount = await ppt.getPastTripsCount();
        assert.equal(pastTripsCount, 0);

        // call pushPastTrip
        await Pilot.pushPastTrip(defaultTrip);

        // assert pilot has past trips
        pastTripsCount = await ppt.getPastTripsCount();
        assert.equal(pastTripsCount, 1);

        // clear database
        await admin.database().ref("past-trips").remove();
      });

      it("increments pilot's total_trips", async () => {
        // add pilot to database
        await admin.database().ref("pilots").child(pilotID).set(defaultPilot);

        // assert pilot has no total_trips
        let result = await Pilot.getPilot();
        assert.isUndefined(result.total_trips);

        // call pushPastTrip
        await Pilot.pushPastTrip(defaultTrip);

        // assert pilot has total_trips
        result = await Pilot.getPilot();
        assert.equal(result.total_trips, "1");

        // clear database
        await admin.database().ref("pilots").remove();
        await admin.database().ref("past-trips").remove();
      });
    });
  });

  describe("Interface", () => {
    before(() => {
      Pilot = p.Pilot;
    });
    describe("is", () => {
      it("returns false when object is undefined", () => {
        assert.equal(Pilot.Interface.is(undefined), false);
      });
      it("returns false when object is null", () => {
        assert.equal(Pilot.Interface.is(null), false);
      });

      it("returns false if obj contains vehicle that is not a Vehicle.Interface", () => {
        const obj = {
          uid: "uid",
          name: "name",
          last_name: "last_name",
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

        assert.equal(Pilot.Interface.is(obj), false);
      });

      it("returns true if obj is Pilot.Interface", () => {
        const obj = {
          uid: "uid",
          name: "name",
          last_name: "last_name",
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
        assert.equal(Pilot.Interface.is(obj), true);
      });
    });

    describe("fromObj", () => {
      it("returns empty list if obj is null", () => {
        assert.isUndefined(Pilot.Interface.fromObj(null));
      });
      it("returns empty list if obj is undefined", () => {
        assert.isUndefined(Pilot.Interface.fromObj(undefined));
      });
      it("returns Pilot.Interface if obj is Pilot.Interface", () => {
        const obj = {
          uid: "uid",
          name: "name",
          last_name: "last_name",
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

        const response = Pilot.Interface.fromObj(obj);
        assert.isDefined(response);
        assert.equal(response.uid, "uid");
      });
    });
  });
});
