// reference: https://firebase.google.com/docs/functions/unit-testing?authuser=1
// initialize firebase-functions-test
const firebaseFunctionsTest = require("firebase-functions-test");
const admin = require("firebase-admin");
const chai = require("chai");
const mocks = require("../lib/mock");
const zones = require("../lib/zones");
const { sleep } = require("../lib/utils");
const { wrap } = require("firebase-functions-test/lib/main");
const { TripRequest } = require("../lib/database/tripRequest");
const { Database } = require("../lib/database");
const {
  PilotPastTrips,
  ClientPastTrips,
} = require("../lib/database/pastTrips");
const assert = chai.assert;

// the tests actually hit venni-rider-development project in firebase
const test = firebaseFunctionsTest(
  {
    databaseURL:
      "https://venni-rider-development-8a3f8-default-rtdb.firebaseio.com/",
    projectId: "venni-rider-development-8a3f8",
    storageBucket: "venni-rider-development-8a3f8.appspot.com",
    storageBucket: "venni-rider-development-8a3f8.appspot.com",
  },
  "./devAdminCredentials.json"
);

describe("trip", () => {
  let trip;
  let defaultCtx;
  let valid_origin_place_id;
  let valid_destination_place_id;
  let defaultUID;
  let createTripRequest;

  before(() => {
    if (admin.apps.length == 0) {
      admin.initializeApp();
    }
    trip = require("../lib/trip");
    defaultUID = "defaultUID";
    defaultCtx = {
      auth: {
        uid: defaultUID,
      },
    };
    valid_origin_place_id = "ChIJzY-urWVKqJQRGA8-aIMZJ4I";
    valid_destination_place_id = "ChIJ31rnOmVKqJQR8FM30Au7boM";
    // createTripRequest populates the database with request
    createTripRequest = async (status = "waiting-confirmation") => {
      let defaultTripRequest = {
        uid: defaultUID,
        origin_place_id: valid_origin_place_id,
        destination_place_id: valid_destination_place_id,
        trip_status: status,
        origin_zone: "AA",
        fare_price: 5,
        distance_meters: 1000,
        distance_text: "1000",
        duration_seconds: 300,
        duration_text: "5 minutes",
        encoded_points: "encoded_points",
        request_time: Date.now(),
        origin_address: "origin_address",
        destination_address: "destination_address",
      };

      let tripRequestRef = admin
        .database()
        .ref("trip-requests")
        .child(defaultUID);

      await tripRequestRef.set(defaultTripRequest);
      return tripRequestRef;
    };
  });

  after(async () => {
    // clean database
    await admin.database().ref("trip-requests").remove();
    await admin.database().ref("pilots").remove();
    // do cleanup tasks
    test.cleanup();
  });

  describe("request", () => {
    afterEach(() => {
      // reset the database
      admin.database().ref("trip-requests").remove();
    });

    after(async () => {
      // clean database
      await admin.database().ref("pilots").remove();
    });

    const genericTest = async (
      data,
      expectedCode,
      expectedMessage,
      ctx = defaultCtx,
      succeeed = false
    ) => {
      const wrapped = test.wrap(trip.request);
      try {
        await wrapped(data, ctx);
        if (succeeed) {
          assert(true, "method finished successfully");
        } else {
          assert(false, "method didn't throw expected error");
        }
      } catch (e) {
        assert.strictEqual(e.code, expectedCode, "receive correct error code");
        assert.strictEqual(
          e.message,
          expectedMessage,
          "receive correct error message"
        );
      }
    };

    const ivalidPlaceIDTest = async (data, errorDescription) => {
      await genericTest(data, "invalid-argument", errorDescription);
    };

    const invalidTripStatusTest = async (status) => {
      // expect database not to be populated
      let tripRequestRef = admin
        .database()
        .ref("trip-requests")
        .child(defaultUID);
      let snapshot = await tripRequestRef.once("value");
      assert.isTrue(
        snapshot.val() == null,
        "trip reqeust has not been created on database"
      );

      // add trip request with status to the database
      await createTripRequest(status);

      // expect database to be populated
      snapshot = await tripRequestRef.once("value");
      assert.isFalse(
        snapshot.val() == null,
        "trip reqeust has been created on database"
      );

      // run test with valid origin and destinations and expect it to fail
      await genericTest(
        {
          origin_place_id: valid_origin_place_id,
          destination_place_id: valid_destination_place_id,
        },
        "failed-precondition",
        "Can't request a trip if client has an ongoing trip in status '" +
          status +
          "'",
        {
          auth: {
            uid: defaultUID,
          },
        },
        false
      );

      // reset the database
      admin.database().ref("trip-requests").remove();
    };

    it("destination_place_id argument must be present", async () => {
      await ivalidPlaceIDTest(
        {
          origin_place_id: "origin_place_id",
        },
        "missing expected argument 'destination_place_id'."
      );
    });

    it("destination_place_id must have correct type", async () => {
      await ivalidPlaceIDTest(
        {
          destination_place_id: 1,
          origin_place_id: "origin_place_id",
        },
        "argument 'destination_place_id' has invalid type. Expected 'string'. Received 'number'."
      );
    });

    it("origin_place_id argument must be present", async () => {
      await ivalidPlaceIDTest(
        {
          destination_place_id: "destination_place_id",
        },
        "missing expected argument 'origin_place_id'."
      );
    });

    it("origin_place_id must have correct type", async () => {
      await ivalidPlaceIDTest(
        {
          destination_place_id: "destination_place_id",
          origin_place_id: 1,
        },
        "argument 'origin_place_id' has invalid type. Expected 'string'. Received 'number'."
      );
    });

    it("origin_place_id and destination_place_id must be different", async () => {
      genericTest(
        {
          origin_place_id: "same_id",
          destination_place_id: "same_id",
        },
        "invalid-argument",
        "destination_place_id and origin_place_id are the same."
      );
    });

    it("user must be authenticated", async () => {
      // pass empty context as a parameter
      genericTest(
        {
          origin_place_id: "valid_origin_place_id",
          destination_place_id: "valid_destination_place_id",
        },
        "failed-precondition",
        "Missing authentication credentials.",
        {}
      );
    });

    it("throws 'invalid-argument' if user provides invalid destination_place_id", async () => {
      const uid = "some_uid";
      const invalid_destination = "invalid_destination_place_id";

      // run test with specified uid and destinatino and expect 'invalid-argument' error
      await genericTest(
        {
          origin_place_id: valid_origin_place_id,
          destination_place_id: invalid_destination,
        },
        "invalid-argument",
        "Invalid request. Invalid 'destination' parameter. '" +
          invalid_destination +
          "' is not a valid Place ID.",
        {
          auth: {
            uid: uid,
          },
        }
      );
    });

    it("throws 'invalid-argument' if user provides invalid origin_place_id", async () => {
      const uid = "some_uid";
      const invalid_origin = "invalid_origin_place_id";

      // run test with specified uid and destinatino and expect 'invalid-argument' error
      await genericTest(
        {
          origin_place_id: invalid_origin,
          destination_place_id: valid_destination_place_id,
        },
        "invalid-argument",
        "Invalid request. Invalid 'origin' parameter. '" +
          invalid_origin +
          "' is not a valid Place ID.",
        {
          auth: {
            uid: uid,
          },
        }
      );
    });

    it("fails when the user already has a trip request with inProgress status", async () => {
      await invalidTripStatusTest("in-progress");
    });
    it("fails when the user already has a trip request with lookingForDriver status", async () => {
      await invalidTripStatusTest("looking-for-driver");
    });
    it("fails when the user already has a trip request with waitingDriver status", async () => {
      await invalidTripStatusTest("waiting-driver");
    });
    it("fails when the user already has a trip request with waitingPayment status", async () => {
      await invalidTripStatusTest("waiting-payment");
    });

    it("succeed when all parameters are valid", async () => {
      const uid = "some_uid";

      // expect database not to be populated
      let db = admin.database().ref("trip-requests").child(uid);
      let snapshot = await db.once("value");
      assert.isTrue(
        snapshot.val() == null,
        "trip reqeust has not been created on database"
      );

      // run test with valid origin and destinations and expect it to succeed
      await genericTest(
        {
          origin_place_id: valid_origin_place_id,
          destination_place_id: valid_destination_place_id,
        },
        "",
        "",
        {
          auth: {
            uid: uid,
          },
        },
        true
      );

      // expect database to be populated
      snapshot = await db.once("value");
      assert.isTrue(
        snapshot.val() != null,
        "trip reqeust was successfully created on database"
      );

      // reset the database
      admin.database().ref("trip-requests").remove();
    });
  });

  describe("clientCancel", () => {
    const genericTest = async (
      expectedCode,
      expectedMessage,
      ctx,
      succeeed = false
    ) => {
      const wrapped = test.wrap(trip.client_cancel);
      try {
        await wrapped({}, ctx);
        if (succeeed) {
          assert(true, "method finished successfully");
        } else {
          assert(false, "method didn't throw expected error");
        }
      } catch (e) {
        assert.strictEqual(e.code, expectedCode, "receive correct error code");
        assert.strictEqual(
          e.message,
          expectedMessage,
          "receive correct error message"
        );
      }
    };

    after(async () => {
      await admin.database().ref("trip-requests").remove();
      await admin.database().ref("pilots").remove();
    });

    const failsWithStatus = async (status) => {
      // populate database with trip request for defaultUID user
      await createTripRequest(status);

      // delete trip-request fails
      await genericTest(
        "failed-precondition",
        "Trip request can't be cancelled when in status '" + status + "'",
        defaultCtx,
        false
      );

      // expect trip-request to still have same status
      let db = admin.database().ref("trip-requests").child(defaultUID);
      snapshot = await db.once("value");
      assert.isTrue(snapshot.val() != null);
      assert.equal(snapshot.val().trip_status, status);
    };

    const succeedsWithStatus = async (status) => {
      // populate database with trip request for defaultUID user
      await createTripRequest(status);

      const tripRequestRef = admin
        .database()
        .ref("trip-requests")
        .child(defaultUID);
      let snapshot = await tripRequestRef.once("value");
      assert.isTrue(snapshot.val() != null);
      assert.equal(snapshot.val().trip_status, status);

      // delete trip-request
      await genericTest("", "", defaultCtx, true);
      await sleep(200);

      // expect trip-request to have cancelled-by-client state
      snapshot = await tripRequestRef.once("value");
      assert.isNotNull(snapshot.val());
      assert.equal(snapshot.val().trip_status, "cancelled-by-client");
    };

    it("user must be authenticated", async () => {
      // run generic test without context with client id
      genericTest(
        "failed-precondition",
        "Missing authentication credentials.",
        {}
      );
    });

    it("fails if trip has cancelled-by-client status", async () => {
      await failsWithStatus("cancelled-by-client");
    });

    it("fails if trip has cancelled-by-driver status", async () => {
      await failsWithStatus("cancelled-by-driver");
    });

    it("fails if trip has completed status", async () => {
      await failsWithStatus("completed");
    });

    it("fails if trip has waiting-payment status", async () => {
      await failsWithStatus("waiting-payment");
    });

    it("succeeds when trip has waiting-confirmation status", async () => {
      await succeedsWithStatus("waiting-confirmation");
    });

    it("succeeds when trip has payment-failed status", async () => {
      await succeedsWithStatus("payment-failed");
    });

    it("succeeds when trip has no-drivers-available status", async () => {
      await succeedsWithStatus("no-drivers-available");
    });

    it("succeeds when trip has looking-for-driver status", async () => {
      await succeedsWithStatus("looking-for-driver");
    });

    it("succeeds when trip has waiting-driver status", async () => {
      await succeedsWithStatus("waiting-driver");
    });

    it("succeeds when trip has in-progress status", async () => {
      await succeedsWithStatus("in-progress");
    });

    it("succeeds when integrated with confirmTrip and acceptTrip", async () => {
      // add an available pilots to the database
      const pilotID = "pilotID";
      const clientID = "clientID";
      await admin.database().ref("pilots").remove();
      let defaultPilot = {
        uid: pilotID,
        name: "Fulano",
        last_name: "de Tal",
        phone_number: "(38) 99999-9999",
        member_since: Date.now(),
        current_latitude: -17.217587,
        current_longitude: -46.881064,
        current_zone: "AA",
        status: "available",
        vehicle: {
          brand: "honda",
          model: "CG 150",
          year: 2020,
          plate: "HMR 1092",
        },
        idle_since: Date.now(),
        rating: 5.0,
      };
      const pilotRef = admin.database().ref("pilots").child(pilotID);
      await pilotRef.set(defaultPilot);

      // add trip request to database with status waiting-confirmation
      let tripRequest = {
        uid: clientID,
        origin_place_id: valid_origin_place_id,
        destination_place_id: valid_destination_place_id,
        trip_status: "waiting-confirmation",
        origin_zone: "AA",
        fare_price: 5,
        distance_meters: 1000,
        distance_text: "1000",
        duration_seconds: 300,
        duration_text: "5 minutes",
        encoded_points: "encoded_points",
        request_time: Date.now(),
        origin_address: "origin_address",
        destination_address: "destination_address",
      };
      await admin
        .database()
        .ref("trip-requests")
        .child(clientID)
        .set(tripRequest);

      // assert trip has been added
      const tripRequestRef = admin
        .database()
        .ref("trip-requests")
        .child(clientID);
      let snapshot = await tripRequestRef.once("value");
      assert.isTrue(snapshot.val() != null);
      assert.equal(snapshot.val().trip_status, "waiting-confirmation");

      // confirm trip
      const wrappedConfirm = test.wrap(trip.confirm);
      wrappedConfirm({}, { auth: { uid: clientID } });

      // wait enough for confirm to send out request to pilot
      await sleep(1500);

      // assert trip request has looking-for-driver status
      snapshot = await tripRequestRef.once("value");
      assert.notEqual(snapshot.val(), null);
      assert.equal(snapshot.val().trip_status, "looking-for-driver");

      // assert pilot has been requested
      let pilotSnapshot = await pilotRef.once("value");
      assert.isNotNull(pilotSnapshot.val());
      // this fails if there is a mockPilotBehavior listener that automatically accepts the trip
      assert.equal(pilotSnapshot.val().status, "requested");

      // pilot accepts trip
      const wrappedAccept = test.wrap(trip.accept);
      await wrappedAccept({ client_id: clientID }, { auth: { uid: pilotID } });

      // wait enough time for confirmTrip to grant trip to the pilot
      await sleep(100);

      // assert pilot was granted the trip
      pilotSnapshot = await pilotRef.once("value");
      assert.equal(pilotSnapshot.val().status, "busy");
      assert.equal(pilotSnapshot.val().current_client_uid, clientID);

      // assert trip request has waiting-driver status
      snapshot = await tripRequestRef.once("value");
      assert.notEqual(snapshot.val(), null);
      assert.equal(snapshot.val().trip_status, "waiting-driver");

      // assert trying to delete trip-request succeeds
      const wrapped = test.wrap(trip.client_cancel);
      const response = await wrapped({}, { auth: { uid: clientID } });
      assert.isNotNull(response);
      assert.equal(response.trip_status, "cancelled-by-client");

      // assert trip-request has cancelled-by-client state
      snapshot = await tripRequestRef.once("value");
      assert.isTrue(snapshot.val() != null);
      assert.equal(snapshot.val().trip_status, "cancelled-by-client");

      // assert pilot has 'available' status and undefined 'current_client_uid'
      pilotSnapshot = await pilotRef.once("value");
      assert.equal(pilotSnapshot.val().status, "available");
      assert.equal(pilotSnapshot.val().current_client_uid, "");

      // delete resources
      await admin.database().ref("trip-requests").child(clientID).remove();
      await admin.database().ref("pilots").child(pilotID).remove();
    });
  });

  describe("confirm", () => {
    const genericTest = async (
      expectedCode,
      expectedMessage,
      ctx = defaultCtx,
      succeeed = false
    ) => {
      const wrapped = test.wrap(trip.confirm);
      try {
        await wrapped({}, ctx);
        if (succeeed) {
          assert(true, "method finished successfully");
        } else {
          assert(false, "method didn't throw expected error");
        }
      } catch (e) {
        assert.strictEqual(e.code, expectedCode, "receive correct error code");
        assert.strictEqual(
          e.message,
          expectedMessage,
          "receive correct error message"
        );
      }
    };
    after(async () => {
      // clean database
      await admin.database().ref("trip-requests").remove();
      await admin.database().ref("pilots").remove();
    });

    const removeTripRequests = async () => {
      await admin.database().ref("trip-requests").remove();
    };

    it("user must be authenticated", async () => {
      // run generic test without context with client id
      await genericTest(
        "failed-precondition",
        "Missing authentication credentials.",
        {}
      );
    });

    it("user must have active trip request", async () => {
      // run generic test without context with client id
      await genericTest(
        "not-found",
        "User with uid " + defaultUID + " has no active trip request.",
        defaultCtx
      );
    });

    it("trip request can't have invalid status", async () => {
      // populate database with trip request with invalid waiting-payment status
      await createTripRequest("waiting-payment");

      // expect confirmTrip to fail
      await genericTest(
        "failed-precondition",
        "Trip request of user with uid " +
          defaultUID +
          " has invalid status 'waiting-payment'",
        defaultCtx
      );

      // populate database with trip request with invalid waiting-driver status

      await createTripRequest("waiting-driver");

      // expect confirmTrip to fail
      await genericTest(
        "failed-precondition",
        "Trip request of user with uid " +
          defaultUID +
          " has invalid status 'waiting-driver'",
        defaultCtx
      );

      // populate database with trip request with invalid completed status
      await createTripRequest("completed");

      // expect confirmTrip to fail
      await genericTest(
        "failed-precondition",
        "Trip request of user with uid " +
          defaultUID +
          " has invalid status 'completed'",
        defaultCtx
      );

      // populate database with trip request with invalid cancelled-by-client status
      await createTripRequest("cancelled-by-client");

      // expect confirmTrip to fail
      await genericTest(
        "failed-precondition",
        "Trip request of user with uid " +
          defaultUID +
          " has invalid status 'cancelled-by-client'",
        defaultCtx
      );

      // populate database with trip request with invalid in-progress status
      await createTripRequest("in-progress");

      // expect confirmTrip to fail
      await genericTest(
        "failed-precondition",
        "Trip request of user with uid " +
          defaultUID +
          " has invalid status 'in-progress'",
        defaultCtx
      );

      // clear database
      await removeTripRequests();
    });

    it("fails if there are no pilots nearby", async () => {
      // delete all pilots from database
      await admin.database().ref("pilots").remove();

      // populate database with trip request with valid status
      await createTripRequest("waiting-confirmation");

      // expect confirmTrip to fail
      await genericTest(
        "failed-precondition",
        "There are no available pilots. Try again later."
      );

      // clear database
      await removeTripRequests();
    });

    it("works when integrated with accept trip", async () => {
      // delete all pilots from the database
      const pilotsRef = admin.database().ref("pilots");
      await pilotsRef.remove();

      // add three available pilots to the database
      const pilotID1 = "pilotID1";
      const pilotID2 = "pilotID2";
      const pilotID3 = "pilotID3";
      let pilot = {
        uid: "",
        name: "Fulano",
        last_name: "de Tal",
        member_since: Date.now(),
        phone_number: "(38) 99999-9999",
        current_latitude: -17.217587,
        current_longitude: -46.881064,
        current_zone: "AA",
        status: "available",
        vehicle: {
          brand: "honda",
          model: "CG 150",
          year: 2020,
          plate: "HMR 1092",
        },
        idle_since: Date.now(),
        rating: 5.0,
      };
      pilot.uid = pilotID1;
      await pilotsRef.child(pilotID1).set(pilot);
      pilot.uid = pilotID2;
      await pilotsRef.child(pilotID2).set(pilot);
      pilot.uid = pilotID3;
      await pilotsRef.child(pilotID3).set(pilot);

      // add trip request to database
      const tripRequestRef = await createTripRequest();

      // confirm trip
      const wrappedConfirm = test.wrap(trip.confirm);
      const confirmPromise = wrappedConfirm({}, { auth: { uid: defaultUID } });

      // wait enough time for confirm to send request to pilot1 and pilot 2
      await sleep(8000);

      // assert trip has looking-for-driver status
      let tripRequestSnapshot = await tripRequestRef.once("value");
      assert.isNotNull(tripRequestSnapshot.val());
      assert.equal(tripRequestSnapshot.val().trip_status, "looking-for-driver");

      // assert pilot 1 has been requested
      let pilot1Snapshot = await pilotsRef.child(pilotID1).once("value");
      assert.isNotNull(pilot1Snapshot.val());
      assert.equal(pilot1Snapshot.val().status, "requested");
      assert.isUndefined(pilot1Snapshot.val().total_trips);
      // assert pilot 2 has been requested
      let pilot2Snapshot = await pilotsRef.child(pilotID2).once("value");
      assert.isNotNull(pilot2Snapshot.val());
      assert.equal(pilot2Snapshot.val().status, "requested");
      // assert pilot 3 has not been requested
      let pilot3Snapshot = await pilotsRef.child(pilotID3).once("value");
      assert.isNotNull(pilot3Snapshot.val());
      assert.equal(pilot3Snapshot.val().status, "available");

      // pilot one accepts the trip
      const wrappedAccept = test.wrap(trip.accept);
      await wrappedAccept(
        { client_id: defaultUID },
        { auth: { uid: pilotID1 } }
      );
      await sleep(200);

      // assert confirm trip returned information about pilot 1
      const confirmResult = await confirmPromise;
      assert.equal(confirmResult.uid, pilotID1);
      assert.equal(confirmResult.status, "busy");
      assert.equal(confirmResult.current_client_uid, defaultUID);
      assert.equal(confirmResult.trip_status, "waiting-driver");
      // pilot's total_trips is zero
      assert.equal(confirmResult.total_trips, 0);

      // assert trip has waiting-driver status
      tripRequestSnapshot = await tripRequestRef.once("value");
      assert.isNotNull(tripRequestSnapshot.val());
      assert.equal(tripRequestSnapshot.val().trip_status, "waiting-driver");

      // assert pilot 1 status is busy
      pilot1Snapshot = await pilotsRef.child(pilotID1).once("value");
      assert.isNotNull(pilot1Snapshot.val());
      assert.equal(pilot1Snapshot.val().status, "busy");
      assert.equal(pilot1Snapshot.val().current_client_uid, defaultUID);
      // assert pilot 2 status once again available
      pilot2Snapshot = await pilotsRef.child(pilotID2).once("value");
      assert.isNotNull(pilot2Snapshot.val());
      assert.equal(pilot2Snapshot.val().status, "available");
      // assert pilot 3 is still available
      pilot3Snapshot = await pilotsRef.child(pilotID3).once("value");
      assert.isNotNull(pilot3Snapshot.val());
      assert.equal(pilot3Snapshot.val().status, "available");

      // clean database
      await pilotsRef.remove();
      await tripRequestRef.remove();
    });

    it("doesn't accept pilots who were not picked by the algorithm", async () => {
      // delete all pilots from the database
      const pilotsRef = admin.database().ref("pilots");
      await pilotsRef.remove();

      // add one available and one busy pilots to the database
      const pilotID1 = "pilotID1";
      const pilotID2 = "pilotID2";
      let pilot = {
        uid: "",
        name: "Fulano",
        last_name: "de Tal",
        member_since: Date.now(),
        phone_number: "(38) 99999-9999",
        current_latitude: -17.217587,
        current_longitude: -46.881064,
        current_zone: "AA",
        status: "",
        vehicle: {
          brand: "honda",
          model: "CG 150",
          year: 2020,
          plate: "HMR 1092",
        },
        idle_since: Date.now(),
        rating: 5.0,
      };
      pilot.uid = pilotID1;
      pilot.status = "available";
      await pilotsRef.child(pilotID1).set(pilot);
      pilot.uid = pilotID2;
      pilot.status = "busy";
      await pilotsRef.child(pilotID2).set(pilot);

      // add trip request to database
      const tripRequestRef = await createTripRequest();

      // confirm trip
      const wrappedConfirm = test.wrap(trip.confirm);
      const confirmPromise = wrappedConfirm({}, { auth: { uid: defaultUID } });

      // wait enough time for confirm to send request to pilot1
      await sleep(1500);

      // assert trip has looking-for-driver status
      let tripRequestSnapshot = await tripRequestRef.once("value");
      assert.isNotNull(tripRequestSnapshot.val());
      assert.equal(tripRequestSnapshot.val().trip_status, "looking-for-driver");

      // assert pilot 1 has been requested
      let pilot1Snapshot = await pilotsRef.child(pilotID1).once("value");
      assert.isNotNull(pilot1Snapshot.val());
      assert.equal(pilot1Snapshot.val().status, "requested");
      // assert pilot 2 has not been requested
      let pilot2Snapshot = await pilotsRef.child(pilotID2).once("value");
      assert.isNotNull(pilot2Snapshot.val());
      assert.equal(pilot2Snapshot.val().status, "busy");

      // pilot 2 accepts the trip (bypass accepTrip, which would fail)
      await tripRequestRef.child("driver_id").set(pilotID2);

      // assert confirm trip didn't accept pilot 2
      tripRequestSnapshot = await tripRequestRef.once("value");
      assert.isNotNull(tripRequestSnapshot.val());
      assert.equal(tripRequestSnapshot.val().driver_id, "");

      // pilot 1 accepts the trip
      await tripRequestRef.child("driver_id").set(pilotID1);

      // assert confirm trip accepted pilot 1
      tripRequestSnapshot = await tripRequestRef.once("value");
      assert.isNotNull(tripRequestSnapshot.val());
      assert.equal(tripRequestSnapshot.val().driver_id, pilotID1);

      // clean database
      await pilotsRef.remove();
      await tripRequestRef.remove();
    });
  });

  describe("accept", () => {
    const genericTest = async (
      data,
      expectedCode,
      expectedMessage,
      ctx = defaultCtx,
      succeeed = false
    ) => {
      const wrapped = test.wrap(trip.accept);
      try {
        await wrapped(data, ctx);
        if (succeeed) {
          assert(true, "method finished successfully");
        } else {
          assert(false, "method didn't throw expected error");
        }
      } catch (e) {
        assert.strictEqual(e.code, expectedCode, "receive correct error code");
        assert.strictEqual(
          e.message,
          expectedMessage,
          "receive correct error message"
        );
      }
    };

    after(async () => {
      // clean database
      await admin.database().ref("trip-requests").remove();
      await admin.database().ref("pilots").remove();
    });

    it("user must be authenticated", async () => {
      // run generic test without context
      await genericTest(
        { client_id: "client_id" },
        "failed-precondition",
        "Missing authentication credentials.",
        {}
      );
    });

    it("argument must contain client_id", async () => {
      await genericTest(
        {},
        "invalid-argument",
        "missing expected argument 'client_id'.",
        defaultCtx
      );
    });

    it("argument must contain client_id as a string", async () => {
      await genericTest(
        { client_id: 1 },
        "invalid-argument",
        "argument 'client_id' has invalid type. Expected 'string'. Received 'number'.",
        defaultCtx
      );
    });

    it("argument must contain client_id with length greater than 0", async () => {
      await genericTest(
        { client_id: "" },
        "invalid-argument",
        "argument client_id must have length greater than 0.",
        defaultCtx
      );
    });

    it("fails if another pilot has already picked up the trip", async () => {
      const pilotID1 = "pilotID1";
      const clientID = "clientID";

      // add a pilot to the database supposedly handling trip request
      await admin.database().ref("pilots").remove();
      let defaultPilot = {
        uid: pilotID1,
        name: "Fulano",
        last_name: "de Tal",
        member_since: Date.now(),
        phone_number: "(38) 99999-9999",
        current_latitude: -17.217587,
        current_longitude: -46.881064,
        current_zone: "AA",
        status: "requested",
        current_client_uid: clientID,
        vehicle: {
          brand: "honda",
          model: "CG 150",
          year: 2020,
          plate: "HMR 1092",
        },
        idle_since: Date.now(),
        rating: 5.0,
      };
      await admin.database().ref("pilots").child(pilotID1).set(defaultPilot);

      // add trip request to database being handled by another pilot
      let tripRequest = {
        uid: clientID,
        origin_place_id: valid_origin_place_id,
        destination_place_id: valid_destination_place_id,
        trip_status: "waiting-confirmation",
        origin_zone: "AA",
        driver_id: "anotherPilot",
      };
      await admin
        .database()
        .ref("trip-requests")
        .child(clientID)
        .set(tripRequest);

      // pilot accepts trip, thus failing
      const wrappedAccept = test.wrap(trip.accept);
      try {
        await wrappedAccept(
          { client_id: clientID },
          { auth: { uid: pilotID1 } }
        );
        assert(false, "should have failed");
      } catch (e) {
        assert.strictEqual(e.code, "failed-precondition");
        assert.strictEqual(
          e.message,
          "another pilot has already picked up the trip"
        );
      }
    });

    it("pilot must have been requested", async () => {
      const pilotID1 = "pilotID1";
      const pilotID2 = "pilotID2";
      const clientID = "clientID";

      // add two available pilots to the database
      await admin.database().ref("pilots").remove();
      let defaultPilot = {
        uid: "",
        name: "Fulano",
        last_name: "de Tal",
        member_since: Date.now(),
        phone_number: "(38) 99999-9999",
        current_latitude: -17.217587,
        current_longitude: -46.881064,
        current_zone: "AA",
        status: "available",
        vehicle: {
          brand: "honda",
          model: "CG 150",
          year: 2020,
          plate: "HMR 1092",
        },
        idle_since: Date.now(),
        rating: 5.0,
      };
      defaultPilot.uid = pilotID1;
      await admin.database().ref("pilots").child(pilotID1).set(defaultPilot);
      defaultPilot.uid = pilotID2;
      await admin.database().ref("pilots").child(pilotID2).set(defaultPilot);

      // add trip request to database
      await createTripRequest();

      // confirm trip
      const wrappedConfirm = test.wrap(trip.confirm);
      wrappedConfirm({}, { auth: { uid: defaultUID } });

      // wait enough for confirm to send out request to pilot 1 only
      // TODO: may have to increase this once process payments is implemented
      await sleep(1500);

      // assert pilot1 has been requested
      let pilot1Ref = admin.database().ref("pilots").child(pilotID1);
      let pilot1Snapshot = await pilot1Ref.once("value");
      assert.isNotNull(pilot1Snapshot.val());
      assert.equal(pilot1Snapshot.val().status, "requested");
      // assert pilot2 has not been requested
      let pilot2Ref = admin.database().ref("pilots").child(pilotID2);
      let pilot2Snapshot = await pilot2Ref.once("value");
      assert.isNotNull(pilot2Snapshot.val());
      assert.equal(pilot2Snapshot.val().status, "available");

      // pilot 2 accepts trip, thus failing
      const wrappedAccept = test.wrap(trip.accept);
      try {
        await wrappedAccept(
          { client_id: defaultUID },
          { auth: { uid: pilotID2 } }
        );
        assert(false, "should have failed");
      } catch (e) {
        assert.strictEqual(e.code, "failed-precondition");
        assert.strictEqual(
          e.message,
          "pilot has not been requested for trip or trip has already been picked."
        );
      }
    });

    it("works", async () => {
      const pilotID1 = "pilotID1";
      const pilotID2 = "pilotID2";

      // add two available pilots to the database
      await admin.database().ref("pilots").remove();
      let defaultPilot = {
        uid: "",
        name: "Fulano",
        last_name: "de Tal",
        phone_number: "(38) 99999-9999",
        member_since: Date.now(),
        current_latitude: -17.217587,
        current_longitude: -46.881064,
        current_zone: "AA",
        status: "available",
        vehicle: {
          brand: "honda",
          model: "CG 150",
          year: 2020,
          plate: "HMR 1092",
        },
        idle_since: Date.now(),
        rating: 5.0,
      };
      defaultPilot.uid = pilotID1;
      await admin.database().ref("pilots").child(pilotID1).set(defaultPilot);
      defaultPilot.uid = pilotID2;
      await admin.database().ref("pilots").child(pilotID2).set(defaultPilot);

      // add trip request to database
      await createTripRequest();

      // confirm trip
      const wrappedConfirm = test.wrap(trip.confirm);
      wrappedConfirm({}, { auth: { uid: defaultUID } });

      // wait enough for confirm to send out request to pilot 1 and 2
      // TODO: may have to increase this once process payments is implemented
      await sleep(7000);

      // assert pilot1 has been requested
      let pilot1Ref = admin.database().ref("pilots").child(pilotID1);
      let pilot1Snapshot = await pilot1Ref.once("value");
      assert.isNotNull(pilot1Snapshot.val());
      // this fails if there is a mockPilotBehavior listener that automatically accepts the trip
      assert.equal(pilot1Snapshot.val().status, "requested");
      // assert pilot2 has been requested
      let pilot2Ref = admin.database().ref("pilots").child(pilotID2);
      let pilot2Snapshot = await pilot2Ref.once("value");
      assert.isNotNull(pilot2Snapshot.val());
      assert.equal(pilot2Snapshot.val().status, "requested");

      // pilot 1 accepts trip
      const wrappedAccept = test.wrap(trip.accept);
      await wrappedAccept(
        { client_id: defaultUID },
        { auth: { uid: pilotID1 } }
      );

      // assert pilot1 status is busy
      pilot1Snapshot = await pilot1Ref.once("value");
      assert.isNotNull(pilot1Snapshot.val());
      assert.equal(pilot1Snapshot.val().status, "busy");

      // assert pilot2 status is available again
      pilot2Snapshot = await pilot2Ref.once("value");
      assert.isNotNull(pilot2Snapshot.val());
      assert.equal(pilot2Snapshot.val().status, "available");
    });
  });

  describe("start", () => {
    const genericTest = async (
      data,
      expectedCode,
      expectedMessage,
      ctx = defaultCtx,
      succeeed = false
    ) => {
      const wrapped = test.wrap(trip.start);
      try {
        await wrapped(data, ctx);
        if (succeeed) {
          assert(true, "method finished successfully");
        } else {
          assert(false, "method didn't throw expected error");
        }
      } catch (e) {
        assert.strictEqual(e.code, expectedCode, "receive correct error code");
        assert.strictEqual(
          e.message,
          expectedMessage,
          "receive correct error message"
        );
      }
    };

    after(async () => {
      await admin.database().ref("trip-requests").remove();
      await admin.database().ref("pilots").remove();
    });

    it("user must be authenticated", async () => {
      // run generic test without context
      await genericTest(
        { client_id: "client_id" },
        "failed-precondition",
        "Missing authentication credentials.",
        {}
      );
    });

    it("fails when client has no active trip-request", async () => {
      const pilotID1 = "pilotID1";
      const clientID = "clientID";

      // add a pilot to the database supposedly handing a trip for clientID
      await admin.database().ref("pilots").remove();
      let defaultPilot = {
        uid: pilotID1,
        name: "Fulano",
        last_name: "de Tal",
        member_since: Date.now(),
        phone_number: "(38) 99999-9999",
        current_latitude: -17.217587,
        current_longitude: -46.881064,
        current_client_uid: clientID,
        current_zone: "AA",
        status: "busy",
        vehicle: {
          brand: "honda",
          model: "CG 150",
          year: 2020,
          plate: "HMR 1092",
        },
        idle_since: Date.now(),
        rating: 5.0,
      };
      await admin.database().ref("pilots").child(pilotID1).set(defaultPilot);

      // add no trip request to database
      await admin.database().ref("trip-requests").remove();

      // fail if pilot tries starting trip for clientID without any trip-requests
      const wrappedStart = test.wrap(trip.start);
      try {
        await wrappedStart({}, { auth: { uid: pilotID1 } });
        assert(false, "should have failed");
      } catch (e) {
        assert.equal(e.code, "not-found");
        assert.equal(
          e.message,
          "There is no trip request being handled by the pilot pilotID1"
        );
      }
    });

    it("fails when trying to start trip with status different from waiting-driver", async () => {
      const pilotID1 = "pilotID1";
      const clientID = "clientID";

      // add trip request for clientID with status different from waiting-driver
      let tripRequest = {
        uid: clientID,
        origin_place_id: valid_origin_place_id,
        destination_place_id: valid_destination_place_id,
        trip_status: "waiting-confirmation",
        origin_zone: "AA",
      };
      const tripRequestRef = admin
        .database()
        .ref("trip-requests")
        .child(clientID);
      await tripRequestRef.set(tripRequest);

      // add a pilot to the database supposedly handing the trip for clientID
      await admin.database().ref("pilots").remove();
      let defaultPilot = {
        uid: pilotID1,
        name: "Fulano",
        last_name: "de Tal",
        member_since: Date.now(),
        phone_number: "(38) 99999-9999",
        current_latitude: -17.217587,
        current_longitude: -46.881064,
        current_client_uid: clientID,
        current_zone: "AA",
        status: "busy",
        vehicle: {
          brand: "honda",
          model: "CG 150",
          year: 2020,
          plate: "HMR 1092",
        },
        idle_since: Date.now(),
        rating: 5.0,
      };
      await admin.database().ref("pilots").child(pilotID1).set(defaultPilot);

      // fail if pilot tries starting the trip without waiting-driver status
      const wrappedStart = test.wrap(trip.start);
      try {
        await wrappedStart({}, { auth: { uid: pilotID1 } });
        assert(false, "should have failed");
      } catch (e) {
        assert.equal(e.code, "failed-precondition");
        assert.equal(
          e.message,
          "cannot accept trip in status 'waiting-confirmation'"
        );
      }
    });

    it("fails when trying to start trip for which pilot was not chosen", async () => {
      const pilotID1 = "pilotID1";
      const anotherPilotID = "anotherPilotID";
      const clientID = "clientID";

      // add trip request for clientID that is being handled by another driver
      let tripRequest = {
        uid: clientID,
        origin_place_id: valid_origin_place_id,
        destination_place_id: valid_destination_place_id,
        trip_status: "waiting-driver",
        driver_id: anotherPilotID,
        origin_zone: "AA",
      };
      const tripRequestRef = admin
        .database()
        .ref("trip-requests")
        .child(clientID);
      await tripRequestRef.set(tripRequest);

      // add a pilot to the database supposedly handing the trip for clientID
      await admin.database().ref("pilots").remove();
      let defaultPilot = {
        uid: pilotID1,
        name: "Fulano",
        last_name: "de Tal",
        member_since: Date.now(),
        phone_number: "(38) 99999-9999",
        current_latitude: -17.217587,
        current_longitude: -46.881064,
        current_client_uid: clientID,
        current_zone: "AA",
        status: "busy",
        vehicle: {
          brand: "honda",
          model: "CG 150",
          year: 2020,
          plate: "HMR 1092",
        },
        idle_since: Date.now(),
        rating: 5.0,
      };
      await admin.database().ref("pilots").child(pilotID1).set(defaultPilot);

      // fail if pilot tries starting the trip without waiting-driver status
      const wrappedStart = test.wrap(trip.start);
      try {
        await wrappedStart({}, { auth: { uid: pilotID1 } });
        assert(false, "should have failed");
      } catch (e) {
        assert.equal(e.code, "failed-precondition");
        assert.equal(e.message, "pilot has not been designated to this trip");
      }
    });

    it("works when integrated with confirmTrip and acceptTrip", async () => {
      const pilotID1 = "pilotID1";
      const pilotID2 = "pilotID2";
      const clientID = "clientID";

      // add two available pilots to the database
      await admin.database().ref("pilots").remove();
      await admin.database().ref("pilots").remove();
      let defaultPilot = {
        uid: "",
        name: "Fulano",
        last_name: "de Tal",
        member_since: Date.now(),
        phone_number: "(38) 99999-9999",
        current_latitude: -17.217587,
        current_longitude: -46.881064,
        current_zone: "AA",
        status: "available",
        vehicle: {
          brand: "honda",
          model: "CG 150",
          year: 2020,
          plate: "HMR 1092",
        },
        idle_since: Date.now(),
        rating: 5.0,
      };
      defaultPilot.uid = pilotID1;
      await admin.database().ref("pilots").child(pilotID1).set(defaultPilot);
      defaultPilot.uid = pilotID2;
      await admin.database().ref("pilots").child(pilotID2).set(defaultPilot);

      // add trip request to database
      const tripRequestRef = await createTripRequest();

      // user confirms trip
      const wrappedConfirm = test.wrap(trip.confirm);
      wrappedConfirm({}, { auth: { uid: defaultUID } });

      // wait enough for confirm to send out request to pilot 1 only
      // TODO: may have to increase this once process payments is implemented
      await sleep(1500);

      // assert trip status has changed to looking-for-driver
      let tripSnapshot = await tripRequestRef.once("value");
      assert.isNotNull(tripSnapshot.val());
      assert.equal(tripSnapshot.val().trip_status, "looking-for-driver");

      // assert pilot1 has been requested
      let pilot1Ref = admin.database().ref("pilots").child(pilotID1);
      let pilot1Snapshot = await pilot1Ref.once("value");
      assert.isNotNull(pilot1Snapshot.val());
      assert.equal(pilot1Snapshot.val().status, "requested");
      // assert pilot2 has not been requested
      let pilot2Ref = admin.database().ref("pilots").child(pilotID2);
      let pilot2Snapshot = await pilot2Ref.once("value");
      assert.isNotNull(pilot2Snapshot.val());
      assert.equal(pilot2Snapshot.val().status, "available");

      // fail if pilot 2 tries starting the trip without being requested
      const wrappedStart = test.wrap(trip.start);
      try {
        await wrappedStart(
          { client_id: defaultUID },
          { auth: { uid: pilotID2 } }
        );
        assert(false, "should have failed");
      } catch (e) {
        assert.strictEqual(e.code, "failed-precondition");
        assert.strictEqual(
          e.message,
          "pilot has not been requested for the trip."
        );
      }

      // fail if pilot 1 tries starting the trip without having accepted it first
      try {
        await wrappedStart(
          { client_id: defaultUID },
          { auth: { uid: pilotID1 } }
        );
        assert(false, "should have failed");
      } catch (e) {
        assert.strictEqual(e.code, "failed-precondition");
        assert.strictEqual(
          e.message,
          "pilot has not been requested for the trip."
        );
      }

      // pilot 1 accepts the trip
      const wrappedAccept = test.wrap(trip.accept);
      await wrappedAccept(
        { client_id: defaultUID },
        { auth: { uid: pilotID1 } }
      );

      // assert pilot 1 is busy
      pilot1Snapshot = await pilot1Ref.once("value");
      assert.isNotNull(pilot1Snapshot.val());
      assert.equal(pilot1Snapshot.val().status, "busy");

      // assert trip status has changed to waiting-driver
      tripSnapshot = await tripRequestRef.once("value");
      assert.isNotNull(tripSnapshot.val());
      assert.equal(tripSnapshot.val().trip_status, "waiting-driver");

      // now pilot 1 is able to start the trip
      await wrappedStart(
        { client_id: defaultUID },
        { auth: { uid: pilotID1 } }
      );

      // await for trip status to be set
      await sleep(200);

      // assert trip status has changed to in-progress
      tripSnapshot = await tripRequestRef.once("value");
      assert.isNotNull(tripSnapshot.val());
      assert.equal(tripSnapshot.val().trip_status, "in-progress");
    });
  });

  describe("complete", () => {
    const genericTest = async (
      data,
      expectedCode,
      expectedMessage,
      ctx = defaultCtx,
      succeeed = false
    ) => {
      const wrapped = test.wrap(trip.complete);
      try {
        await wrapped(data, ctx);
        if (succeeed) {
          assert(true, "method finished successfully");
        } else {
          assert(false, "method didn't throw expected error");
        }
      } catch (e) {
        assert.strictEqual(e.code, expectedCode, "receive correct error code");
        assert.strictEqual(
          e.message,
          expectedMessage,
          "receive correct error message"
        );
      }
    };

    before(async () => {
      await admin.database().ref("past-trips").child("clients").remove();
      await admin.database().ref("past-trips").child("pilots").remove();
    });

    after(async () => {
      await admin.database().ref("trip-requests").remove();
      await admin.database().ref("pilots").remove();
      await admin.database().ref("clients").remove();
      await admin.database().ref("past-trips").child("clients").remove();
      await admin.database().ref("past-trips").child("pilots").remove();
    });

    it("user must be authenticated", async () => {
      // run generic test without context
      await genericTest(
        { client_rating: 5 },
        "failed-precondition",
        "Missing authentication credentials.",
        {}
      );
    });

    it("fails when argument is empty", async () => {
      // run generic test without context
      await genericTest(
        {},
        "invalid-argument",
        "missing expected argument 'client_rating'."
      );
    });

    it("fails when client_rating argument is not a number", async () => {
      // run generic test without context
      await genericTest(
        { client_rating: "a string" },
        "invalid-argument",
        "argument 'client_rating' has invalid type. Expected 'number'. Received 'string'."
      );
    });

    it("fails when client_rating argument is not a number between 0 and 5", async () => {
      // run generic test without context
      await genericTest(
        { client_rating: 6 },
        "invalid-argument",
        "argument client_rating must be a number between 0 and 5."
      );
      await genericTest(
        { client_rating: -1 },
        "invalid-argument",
        "argument client_rating must be a number between 0 and 5."
      );
    });

    it("fails when driver is not busy", async () => {
      const pilotID1 = "pilotID1";
      const clientID = "clientID";

      // add a pilot to the database supposedly handing a trip for clientID
      await admin.database().ref("pilots").remove();
      let defaultPilot = {
        uid: pilotID1,
        name: "Fulano",
        last_name: "de Tal",
        member_since: Date.now(),
        phone_number: "(38) 99999-9999",
        current_latitude: -17.217587,
        current_longitude: -46.881064,
        current_client_uid: clientID,
        current_zone: "AA",
        status: "available",
        vehicle: {
          brand: "honda",
          model: "CG 150",
          year: 2020,
          plate: "HMR 1092",
        },
        idle_since: Date.now(),
        rating: 5.0,
      };
      await admin.database().ref("pilots").child(pilotID1).set(defaultPilot);

      // fail if pilot tries confirming the trip without being busy
      const wrappedComplete = test.wrap(trip.complete);
      try {
        await wrappedComplete(
          { client_rating: 5 },
          { auth: { uid: pilotID1 } }
        );
        assert(false, "should have failed");
      } catch (e) {
        assert.equal(e.code, "failed-precondition");
        assert.equal(e.message, "pilot is not handling a trip.");
      }
    });

    it("fails when current_client_uid is not set", async () => {
      const pilotID1 = "pilotID1";
      const clientID = "clientID";

      // add a pilot to the database supposedly handing a trip for clientID
      await admin.database().ref("pilots").remove();
      let defaultPilot = {
        uid: pilotID1,
        name: "Fulano",
        last_name: "de Tal",
        member_since: Date.now(),
        phone_number: "(38) 99999-9999",
        current_latitude: -17.217587,
        current_longitude: -46.881064,
        current_zone: "AA",
        status: "busy",
        vehicle: {
          brand: "honda",
          model: "CG 150",
          year: 2020,
          plate: "HMR 1092",
        },
        idle_since: Date.now(),
        rating: 5.0,
      };
      await admin.database().ref("pilots").child(pilotID1).set(defaultPilot);

      // fail if pilot tries confirming the trip without current_client_uid
      const wrappedComplete = test.wrap(trip.complete);
      try {
        await wrappedComplete(
          { client_rating: 5 },
          { auth: { uid: pilotID1 } }
        );
        assert(false, "should have failed");
      } catch (e) {
        assert.equal(e.code, "failed-precondition");
        assert.equal(e.message, "pilot is not handling a trip.");
      }
    });

    it("fails when there is no client datbase entry for the user", async () => {
      const pilotID1 = "pilotID1";
      const clientID = "clientID";

      // add a pilot to the database supposedly handing a trip for clientID
      await admin.database().ref("pilots").remove();
      let defaultPilot = {
        uid: pilotID1,
        name: "Fulano",
        last_name: "de Tal",
        member_since: Date.now(),
        phone_number: "(38) 99999-9999",
        current_latitude: -17.217587,
        current_longitude: -46.881064,
        current_client_uid: clientID,
        current_zone: "AA",
        status: "busy",
        vehicle: {
          brand: "honda",
          model: "CG 150",
          year: 2020,
          plate: "HMR 1092",
        },
        idle_since: Date.now(),
        rating: 5.0,
      };
      await admin.database().ref("pilots").child(pilotID1).set(defaultPilot);

      // make sure there is no client entry
      await admin.database().ref("clients").remove();

      // fail if pilot tries confirming the trip without current_client_uid
      const wrappedComplete = test.wrap(trip.complete);
      try {
        await wrappedComplete(
          { client_rating: 5 },
          { auth: { uid: pilotID1 } }
        );
        assert(false, "should have failed");
      } catch (e) {
        assert.equal(e.code, "failed-precondition");
        assert.equal(e.message, "there exists no client with id 'clientID'");
      }
    });

    it("fails when client has no active trip-request", async () => {
      const pilotID1 = "pilotID1";
      const clientID = "clientID";

      // add client entry to the database
      const clientRef = admin.database().ref("clients").child(clientID);
      await clientRef.set({
        uid: clientID,
        rating: 5,
      });

      // add a pilot to the database supposedly handing a trip for clientID
      await admin.database().ref("pilots").remove();
      let defaultPilot = {
        uid: pilotID1,
        name: "Fulano",
        last_name: "de Tal",
        member_since: Date.now(),
        phone_number: "(38) 99999-9999",
        current_latitude: -17.217587,
        current_longitude: -46.881064,
        current_client_uid: clientID,
        current_zone: "AA",
        status: "busy",
        vehicle: {
          brand: "honda",
          model: "CG 150",
          year: 2020,
          plate: "HMR 1092",
        },
        idle_since: Date.now(),
        rating: 5.0,
      };
      await admin.database().ref("pilots").child(pilotID1).set(defaultPilot);

      // add no trip request to database
      await admin.database().ref("trip-requests").remove();

      // fail if pilot tries starting trip for clientID without any trip-requests
      const wrappedComplete = test.wrap(trip.complete);
      try {
        await wrappedComplete(
          { client_rating: 5 },
          { auth: { uid: pilotID1 } }
        );
        assert(false, "should have failed");
      } catch (e) {
        assert.equal(
          e.message,
          "There is no trip request being handled by the pilot 'pilotID1'"
        );
        assert.equal(e.code, "not-found");
      }
    });

    it("fails when trying to complete a trip with status different from in-progress", async () => {
      const pilotID1 = "pilotID1";

      // add client entry to the database
      const clientRef = admin.database().ref("clients").child(defaultUID);
      await clientRef.set({
        uid: defaultUID,
        rating: 5,
      });

      // add trip request for defaultUID with status different from in-progress
      await createTripRequest("waiting-driver");

      // add a pilot to the database supposedly handing the trip for defaultUID
      await admin.database().ref("pilots").remove();
      let defaultPilot = {
        uid: pilotID1,
        name: "Fulano",
        last_name: "de Tal",
        member_since: Date.now(),
        phone_number: "(38) 99999-9999",
        current_latitude: -17.217587,
        current_longitude: -46.881064,
        current_client_uid: defaultUID,
        current_zone: "AA",
        status: "busy",
        vehicle: {
          brand: "honda",
          model: "CG 150",
          year: 2020,
          plate: "HMR 1092",
        },
        idle_since: Date.now(),
        rating: 5.0,
      };
      await admin.database().ref("pilots").child(pilotID1).set(defaultPilot);

      // fail if pilot tries completing the trip without in-progress status
      const wrappedComplete = test.wrap(trip.complete);
      try {
        await wrappedComplete(
          { client_rating: 5 },
          { auth: { uid: pilotID1 } }
        );
        assert(false, "should have failed");
      } catch (e) {
        assert.equal(e.code, "failed-precondition");
        assert.equal(
          e.message,
          "cannot complete trip in status 'waiting-driver'"
        );
      }
    });

    it("fails when trying to complete a trip for which the pilot was not chosen", async () => {
      const pilotID1 = "pilotID1";

      // add client entry to the database
      const clientRef = admin.database().ref("clients").child(defaultUID);
      await clientRef.set({
        uid: defaultUID,
        rating: 5,
      });

      // add trip request for clientID being handled by a different pilot
      await createTripRequest("in-progress");

      // add a pilot to the database supposedly handing the trip for clientID
      await admin.database().ref("pilots").remove();
      let defaultPilot = {
        uid: pilotID1,
        name: "Fulano",
        last_name: "de Tal",
        member_since: Date.now(),
        phone_number: "(38) 99999-9999",
        current_latitude: -17.217587,
        current_longitude: -46.881064,
        current_client_uid: defaultUID,
        current_zone: "AA",
        status: "busy",
        vehicle: {
          brand: "honda",
          model: "CG 150",
          year: 2020,
          plate: "HMR 1092",
        },
        idle_since: Date.now(),
        rating: 5.0,
      };
      await admin.database().ref("pilots").child(pilotID1).set(defaultPilot);

      // fail if pilot tries completing the trip being handled by a different pilot
      const wrappedComplete = test.wrap(trip.complete);
      try {
        await wrappedComplete(
          { client_rating: 5 },
          { auth: { uid: pilotID1 } }
        );
        assert(false, "should have failed");
      } catch (e) {
        assert.equal(e.code, "failed-precondition");
        assert.equal(e.message, "pilot has not been designated to this trip");
      }
    });

    it("succesfully updates pilot's and client's data on success", async () => {
      const pilotID1 = "pilotID1";

      // add client entry to the database
      const clientRef = admin.database().ref("clients").child(defaultUID);
      await clientRef.set({
        uid: defaultUID,
        rating: 0,
      });

      // add trip request for defaultUID being handled by the pilot
      let defaultTripRequest = {
        uid: defaultUID,
        origin_place_id: valid_origin_place_id,
        destination_place_id: valid_destination_place_id,
        trip_status: "in-progress",
        origin_zone: "AA",
        fare_price: 5,
        distance_meters: 1000,
        distance_text: "1000",
        duration_seconds: 300,
        duration_text: "5 minutes",
        encoded_points: "encoded_points",
        request_time: Date.now(),
        origin_address: "origin_address",
        destination_address: "destination_address",
        driver_id: pilotID1,
      };
      const tripRequestRef = admin
        .database()
        .ref("trip-requests")
        .child(defaultUID);

      await tripRequestRef.set(defaultTripRequest);

      // add a pilot to the database supposedly handing the trip for defaultUID
      const initialIdleSince = Date.now();
      await admin.database().ref("pilots").remove();
      let defaultPilot = {
        uid: pilotID1,
        name: "Fulano",
        last_name: "de Tal",
        member_since: Date.now(),
        phone_number: "(38) 99999-9999",
        current_latitude: -17.217587,
        current_longitude: -46.881064,
        current_client_uid: defaultUID,
        current_zone: "AA",
        status: "busy",
        vehicle: {
          brand: "honda",
          model: "CG 150",
          year: 2020,
          plate: "HMR 1092",
        },
        idle_since: initialIdleSince,
        rating: 5.0,
      };
      const pilotRef = admin.database().ref("pilots").child(pilotID1);
      await pilotRef.set(defaultPilot);

      // before completing trip, assert the pilot is busy
      let pilotSnapshot = await pilotRef.once("value");
      assert.isNotNull(pilotSnapshot.val());
      assert.equal(pilotSnapshot.val().status, "busy");
      assert.equal(pilotSnapshot.val().current_client_uid, defaultUID);
      assert.equal(pilotSnapshot.val().idle_since, initialIdleSince);

      // brefore completing trip, assert pilot's has no past trips
      let ppt = new PilotPastTrips(pilotID1);
      let pilotPastTrips = await ppt.getPastTrips();
      assert.isEmpty(pilotPastTrips);

      // before pilot completes trip, assert client has not been updated
      let clientSnapshot = await clientRef.once("value");
      assert.isNotNull(clientSnapshot.val());
      assert.equal(clientSnapshot.val().rating, 0);
      assert.equal(clientSnapshot.val().uid, defaultUID);
      assert.isUndefined(clientSnapshot.val().total_rated_trips);
      assert.isUndefined(clientSnapshot.val().total_rating);

      // before pilot complets trip, assert client has no past_trips
      let cpt = new ClientPastTrips(defaultUID);
      let clientPastTrips = await cpt.getPastTrips();
      assert.isEmpty(clientPastTrips);

      // complete trip
      let clientRating = 5;
      const wrappedComplete = test.wrap(trip.complete);
      await wrappedComplete(
        { client_rating: clientRating },
        { auth: { uid: pilotID1 } }
      );
      await sleep(200);

      // assert the pilot has been set available
      pilotSnapshot = await pilotRef.once("value");
      assert.isNotNull(pilotSnapshot.val());
      assert.equal(pilotSnapshot.val().status, "available");
      assert.equal(pilotSnapshot.val().current_client_uid, "");
      assert.isAbove(pilotSnapshot.val().idle_since, initialIdleSince);

      // assert pilot's has a past trip
      pilotPastTrips = await ppt.getPastTrips();
      assert.equal(pilotPastTrips.length, 1);
      assert.equal(pilotPastTrips[0].uid, defaultUID);
      assert.equal(pilotSnapshot.val().total_trips, 1);

      // assert client has been updated
      clientSnapshot = await clientRef.once("value");
      assert.isNotNull(clientSnapshot.val());
      assert.equal(clientSnapshot.val().rating, clientRating);
      assert.equal(clientSnapshot.val().uid, defaultUID);
      assert.equal(clientSnapshot.val().total_rated_trips, 1);
      assert.equal(clientSnapshot.val().total_rating, clientRating);

      // assert client has one past trip with client_rating
      clientPastTrips = await cpt.getPastTrips();
      assert.equal(clientPastTrips.length, 1);
      assert.equal(clientPastTrips[0].uid, defaultUID);
      assert.equal(clientPastTrips[0].client_rating, clientRating);

      // assert a reference key has been added to the trip request.
      let tripSnapshot = await tripRequestRef.once("value");
      assert.isNotNull(tripSnapshot.val());
      assert.isDefined(tripSnapshot.val().pilot_past_trip_ref_key);
    });
  });

  describe("rateDriver", () => {
    const genericTest = async (
      data,
      expectedCode,
      expectedMessage,
      ctx = defaultCtx,
      succeeed = false
    ) => {
      const wrapped = test.wrap(trip.rate_driver);
      try {
        await wrapped(data, ctx);
        if (succeeed) {
          assert(true, "method finished successfully");
        } else {
          assert(false, "method didn't throw expected error");
        }
      } catch (e) {
        assert.strictEqual(e.code, expectedCode, "receive correct error code");
        assert.strictEqual(
          e.message,
          expectedMessage,
          "receive correct error message"
        );
      }
    };

    after(async () => {
      await admin.database().ref("trip-requests").remove();
      await admin.database().ref("pilots").remove();
      await admin.database().ref("clients").remove();
    });

    it("user must be authenticated", async () => {
      // run generic test without context
      await genericTest(
        {},
        "failed-precondition",
        "Missing authentication credentials.",
        {}
      );
    });

    it("argument driver_rating must be present", async () => {
      await genericTest(
        { driver_id: "driver_id" },
        "invalid-argument",
        "missing expected argument 'driver_rating'."
      );
    });

    it("argument driver_rating must be a number", async () => {
      await genericTest(
        { driver_rating: "not a number", driver_id: "driver_id" },
        "invalid-argument",
        "argument 'driver_rating' has invalid type. Expected 'number'. Received 'string'."
      );
    });

    it("argument driver_id must be present", async () => {
      await genericTest(
        { driver_rating: 1 },
        "invalid-argument",
        "missing expected argument 'driver_id'."
      );
    });

    it("argument driver_id must be a string", async () => {
      await genericTest(
        { driver_rating: 1, driver_id: {} },
        "invalid-argument",
        "argument 'driver_id' has invalid type. Expected 'string'. Received 'object'."
      );
    });

    it("argument driver_rating must be a number between 0 and 5", async () => {
      await genericTest(
        { driver_rating: -1, driver_id: "driver_id" },
        "invalid-argument",
        "argument driver_rating must be a number between 0 and 5."
      );
      await genericTest(
        { driver_rating: 6, driver_id: "driver_id" },
        "invalid-argument",
        "argument driver_rating must be a number between 0 and 5."
      );
    });

    it("argument went_well, if present, must be an object", async () => {
      await genericTest(
        {
          driver_rating: 1,
          driver_id: "driver_id",
          went_well: "not an object",
        },
        "invalid-argument",
        "argument 'went_well' has invalid type. Expected 'object'. Received 'string'."
      );
    });

    it("argument went_well, if present, must have only valid 'items'", async () => {
      await genericTest(
        {
          driver_rating: 1,
          driver_id: "driver_id",
          went_well: {
            items: ["invalid-item"],
          },
        },
        "invalid-argument",
        "invalid went_well item 'invalid-item'. Must be one of 'cleanliness', 'safety' and 'waiting-time'.",
        defaultCtx,
        false
      );
    });

    it("argument went_well, if present, must have only valid 'another'", async () => {
      await genericTest(
        {
          driver_rating: 1,
          driver_id: "driver_id",
          went_well: {
            another: 1,
          },
        },
        "invalid-argument",
        "argument 'another' has invalid type. Expected 'string'. Received 'number'.",
        defaultCtx,
        false
      );
    });

    it("argument must_improve, if present, must be an object", async () => {
      await genericTest(
        {
          driver_rating: 1,
          driver_id: "driver_id",
          must_improve: "not an object",
        },
        "invalid-argument",
        "argument 'must_improve' has invalid type. Expected 'object'. Received 'string'."
      );
    });

    it("argument must_improve, if present, must have only valid 'items'", async () => {
      await genericTest(
        {
          driver_rating: 1,
          driver_id: "driver_id",
          must_improve: {
            items: ["invalid-item"],
          },
        },
        "invalid-argument",
        "invalid must_improve item 'invalid-item'. Must be one of 'cleanliness', 'safety' and 'waiting-time'.",
        defaultCtx,
        false
      );
    });

    it("argument must_improve, if present, must have only valid 'another'", async () => {
      await genericTest(
        {
          driver_rating: 1,
          driver_id: "driver_id",
          must_improve: {
            another: 1,
          },
        },
        "invalid-argument",
        "argument 'another' has invalid type. Expected 'string'. Received 'number'.",
        defaultCtx,
        false
      );
    });
  });
});
