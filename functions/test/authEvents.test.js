const firebaseFunctionsTest = require("firebase-functions-test");
const admin = require("firebase-admin");
const chai = require("chai");

const assert = chai.assert;

const test = firebaseFunctionsTest(
  {
    databaseURL:
      "https://venni-rider-development-8a3f8-default-rtdb.firebaseio.com/",
    storageBucket: "venni-rider-development-8a3f8.appspot.com",
    projectId: "venni-rider-development-8a3f8",
    databaseURL:
      "https://venni-rider-development-8a3f8-default-rtdb.firebaseio.com/",
  },
  "./devAdminCredentials.json"
);

describe("authEvents", () => {
  let authEvents;

  before(() => {
    if (admin.apps.length == 0) {
      admin.initializeApp();
    }
    authEvents = require("../lib/authEvents");
  });

  after(() => {
    test.cleanup();
  });

  describe("clean_user_data", () => {
    let clean_user_data;
    let defaultUID;
    let defaultTripRequest;
    let defaultClient;
    let defaultPastTrip;

    before(() => {
      clean_user_data = test.wrap(authEvents.clean_user_data);
      defaultUID = "defaultUID";
      defaultTripRequest = {
        uid: defaultUID,
      };
      defaultClient = {
        uid: defaultUID,
        rating: "5",
      };
      defaultPastTrip = {
        uid: defaultUID,
        origin_place_id: "valid_origin_place_id",
        destination_place_id: "valid_destination_place_id",
        trip_status: "in-progress",
        origin_zone: "AA",
        fare_price: 5,
        distance_meters: 1000,
        distance_text: "1000",
        duration_seconds: 300,
        duration_text: "5 minutes",
        encoded_points: "encoded_points",
        request_time: Date.now().toString(),
        origin_address: "origin_address",
        destination_address: "destination_address",
        driver_id: "pilotID",
      };
    });

    beforeEach(async () => {
      // set entry in trip-requests
      await admin
        .database()
        .ref("trip-requests")
        .child(defaultUID)
        .set(defaultTripRequest);
      // set entry in clients
      await admin
        .database()
        .ref("clients")
        .child(defaultUID)
        .set(defaultClient);
      // set entry in past-trips
      await admin
        .database()
        .ref("past-trips")
        .child("clients")
        .child(defaultUID)
        .set(defaultClient);
    });

    it("deletes user's data when invoked", async () => {
      // verify that user has data on realtime database
      let tripRequestSnapsthot = await admin
        .database()
        .ref("trip-requests")
        .child(defaultUID)
        .once("value");
      assert.strictEqual(tripRequestSnapsthot.val().uid, defaultUID);
      let clientSnapshot = await admin
        .database()
        .ref("clients")
        .child(defaultUID)
        .once("value");
      assert.strictEqual(clientSnapshot.val().uid, defaultUID);
      let pastTripSnapshot = await admin
        .database()
        .ref("past-trips")
        .child("clients")
        .child(defaultUID)
        .once("value");
      assert.isDefined(pastTripSnapshot.val());

      // trigger clean_user_data
      clean_user_data({ uid: defaultUID }, {});

      // verify that user has no data on realtime database
      tripRequestSnapshot = await admin
        .database()
        .ref("trip-requests")
        .child(defaultUID)
        .once("value");
      assert(tripRequestSnapshot.val() == null);
      clientSnapshot = await admin
        .database()
        .ref("clients")
        .child(defaultUID)
        .once("value");
      assert(clientSnapshot.val() == null);
      pastTripSnapshot = await admin
        .database()
        .ref("past-trips")
        .child("clients")
        .child(defaultUID)
        .once("value");
      assert(pastTripSnapshot.val() == null);
    });
  });

  describe("create_client", () => {
    let create_client;
    let defaultUID;

    before(async () => {
      create_client = test.wrap(authEvents.create_client);
      defaultUID = "defaultUID";

      // clear database
      await admin.database().ref("clients").remove();
    });

    after(async () => {
      await admin.database().ref("clients").remove();
    });

    it("creates user entry when invoked", async () => {
      // verify that there is no client on realtime database
      let snapshot = await admin.database().ref("clients").once("value");
      assert(snapshot.val() == null);

      // trigger create_client
      create_client({ uid: defaultUID }, {});

      // verify that a client has been created on database
      snapshot = await admin
        .database()
        .ref("clients")
        .child(defaultUID)
        .once("value");
      assert.isNotNull(snapshot.val());
      assert.equal(snapshot.val().uid, defaultUID);
      assert.equal(snapshot.val().rating, "5");
      assert.isUndefined(snapshot.val().total_rated_trips);
      assert.isUndefined(snapshot.val().total_rating);
    });
  });
});
