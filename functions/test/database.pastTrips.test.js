const pt = require("../lib/database/pastTrips");
const chai = require("chai");
const admin = require("firebase-admin");

const assert = chai.assert;

describe("PastTrips", () => {
  let clientID;
  let partnerID;
  let pastTrips;
  let p;
  before(async () => {
    if (admin.apps.length == 0) {
      admin.initializeApp();
    }
    clientID = "clientID";
    partnerID = "partnerID";
    pastTrips = pt.PastTrips;
    p = new pt.PastTrips("clients", clientID);
    defaultTrip = {
      uid: clientID,
      trip_status: "waiting-confirmation",
      origin_place_id: "origin_place_id",
      destination_place_id: "destination_place_id",
      origin_zone: "AA",
      fare_price: 500,
      distance_meters: "123",
      distance_text: "123 meters",
      duration_seconds: "300",
      duration_text: "5 minutes",
      encoded_points: "encoded_points",
      request_time: "124759",
      origin_address: "origin_address",
      destination_address: "destination_address",
    };
    // clear database
    await admin.database().ref("past-trips").remove();
  });

  afterEach(async () => {
    // clear database
    await admin.database().ref("past-trips").remove();
  });

  describe("getPastTrips", () => {
    it("returns empty list if user has no past trips", async () => {
      let result = await p.getPastTrips();
      assert.isEmpty(result);
    });

    it("returns list of user's past trips if user has past trips", async () => {
      // assert that user has not past trips
      let result = await p.getPastTrips();
      assert.isEmpty(result);

      // add past trips to the client
      await p.pushPastTrip(defaultTrip);

      // assert that user has past trips
      result = await p.getPastTrips();
      assert.isNotEmpty(result);
    });

    it("returns at most 'limit' past trips if 'limit' is defined", async () => {
      // assert that user has not past trips
      let result = await p.getPastTrips();
      assert.isEmpty(result);

      // add three past trips to the client, with most recent added last
      defaultTrip.request_time = Date.now().toString();
      await p.pushPastTrip(defaultTrip);
      defaultTrip.request_time = (Date.now() + 10000).toString();
      await p.pushPastTrip(defaultTrip);
      defaultTrip.request_time = (Date.now() + 20000).toString();
      await p.pushPastTrip(defaultTrip);

      // get past trips with limit equal to 2
      result = await p.getPastTrips(2);
      assert.isNotEmpty(result);

      // assert we get only 2 past trips
      assert.equal(result.length, 2);

      // assert trips are sorted by request_time, with most recent coming first
      assert.isAbove(
        Number.parseInt(result[0].request_time),
        Number.parseInt(result[1].request_time)
      );

      // get past trips with limit equal to 4
      result = await p.getPastTrips(4);

      // assert we get 3 trips
      assert.isNotEmpty(result);
      assert.equal(result.length, 3);
    });

    it("returns trips with 'request_time' at most 'maxVal' if 'maxVal' is defined", async () => {
      // assert that user has not past trips
      let result = await p.getPastTrips();
      assert.isEmpty(result);

      let now = Date.now();

      // add three past trips to the client, with most recent added last
      defaultTrip.request_time = now.toString();
      await p.pushPastTrip(defaultTrip);
      defaultTrip.request_time = (now + 10000).toString();
      await p.pushPastTrip(defaultTrip);
      defaultTrip.request_time = (now + 20000).toString();
      await p.pushPastTrip(defaultTrip);

      // get trips with 'request_time' below now + 100001
      result = await p.getPastTrips(3, (now + 10001).toString());
      assert.isNotEmpty(result);

      // assert we get only 2 results
      assert.equal(result.length, 2);

      // assert trips are sorted by request_time, with most recent coming first
      assert.isAbove(
        Number.parseInt(result[0].request_time),
        Number.parseInt(result[1].request_time)
      );

      // assert all trips have request_time wiht value at most maxVal
      assert.isBelow(Number(result[0].request_time), now + 10001);
      assert.isBelow(Number(result[1].request_time), now + 10001);

      // get trips with 'request_time' below 'now'
      result = await p.getPastTrips(3, (now - 100).toString());
      assert.isEmpty(result);

      // get trips with 'request_time' at most 'now'
      result = await p.getPastTrips(3, now.toString());
      assert.isNotEmpty(result);

      // assert we get only one result
      assert.equal(result.length, 1);

      // get trips with 'request_time' at most 'now + 20000'
      result = await p.getPastTrips(3, (now + 20000).toString());
      assert.isNotEmpty(result);

      // assert we get only three result
      assert.equal(result.length, 3);
    });

    it("works when both 'limit' and 'maxVal' are defined", async () => {
      // assert that user has not past trips
      let result = await p.getPastTrips();
      assert.isEmpty(result);

      let now = Date.now();

      // add four past trips to the client, with most recent added last
      defaultTrip.request_time = now.toString();
      await p.pushPastTrip(defaultTrip);
      defaultTrip.request_time = (now + 10000).toString();
      await p.pushPastTrip(defaultTrip);
      defaultTrip.request_time = (now + 20000).toString();
      await p.pushPastTrip(defaultTrip);
      defaultTrip.request_time = (now + 30000).toString();
      await p.pushPastTrip(defaultTrip);

      // get at most 2 trips with 'request_time' below now + 200000
      result = await p.getPastTrips(2, (now + 20000).toString());
      assert.isNotEmpty(result);

      // assert we get only 2 results
      assert.equal(result.length, 2);

      // assert trips are sorted by request_time, with most recent coming first
      assert.equal(result[0].request_time, (now + 20000).toString());
      assert.equal(result[1].request_time, (now + 10000).toString());
    });
  });

  describe("getPastTrip", () => {
    afterEach(async () => {
      // clear database
      await admin.database().ref("past-trips").remove();
    });

    it("returns empty list if user has no past trips", async () => {
      let result = await p.getPastTrip("anything");
      assert.isUndefined(result);
    });

    it("returns correct past trip if user has past trip", async () => {
      // add past trips to the client
      const refKey = await p.pushPastTrip(defaultTrip);

      // assert that user has past trip
      result = await p.getPastTrip(refKey);
      assert.isDefined(result);
      assert.equal(result.uid, clientID);
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
          partner_id: "partner_id",
          trip_status: "waiting-confirmation",
          origin_place_id: "origin_place_id",
          destination_place_id: "destination_place_id",
          origin_zone: "AA",
          fare_price: 500,
          distance_meters: "123",
          distance_text: "123 meters",
          duration_seconds: "300",
          duration_text: "5 minutes",
          encoded_points: "encoded_points",
          request_time: "124759",
          origin_address: "origin_address",
          destination_address: "destination_address",
          partner_rating: {
            score: "4",
          },
        },
      };

      const response = pastTrips.fromObjs(obj);
      assert.isNotEmpty(response);
      assert.equal(response.length, 1);
      assert.equal(response[0].uid, "uid");
    });
  });
});
