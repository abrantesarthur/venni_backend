// reference: https://firebase.google.com/docs/functions/unit-testing?authuser=1
// initialize firebase-functions-test
const firebaseFunctionsTest = require("firebase-functions-test");
const admin = require("firebase-admin");
const chai = require("chai");
const mocks = require("../lib/mock");
const zones = require("../lib/zones");
const { sleep } = require("../lib/utils");
const { wrap } = require("firebase-functions-test/lib/main");
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
      };
      await admin
        .database()
        .ref("trip-requests")
        .child(defaultUID)
        .set(defaultTripRequest);
    };
  });

  after(async () => {
    // clean database
    // await admin.database().ref("trip-requests").remove();
    await admin.database().ref("pilots").remove();
    // do cleanup tasks
    test.cleanup();
  });

  describe("request", () => {
    afterEach(() => {
      // reset the database
      admin.database().ref("trip-requests").remove();
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

    const ivalidPlaceIDTest = async (data, argumentName) => {
      await genericTest(
        data,
        "invalid-argument",
        "argument " +
          argumentName +
          " must be a string with length greater than 0."
      );
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

      // add trip request with inProgress status to the database
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
        "destination_place_id"
      );
    });

    it("destination_place_id argument must not be empty", async () => {
      await ivalidPlaceIDTest(
        {
          destination_place_id: "",
          origin_place_id: "origin_place_id",
        },
        "destination_place_id"
      );
    });

    it("destination_place_id must have correct type", async () => {
      await ivalidPlaceIDTest(
        {
          destination_place_id: 1,
          origin_place_id: "origin_place_id",
        },
        "destination_place_id"
      );
    });

    it("origin_place_id argument must be present", async () => {
      await ivalidPlaceIDTest(
        {
          destination_place_id: "destination_place_id",
        },
        "origin_place_id"
      );
    });

    it("origin_place_id argument must not be empty", async () => {
      await ivalidPlaceIDTest(
        {
          destination_place_id: "destination_place_id",
          origin_place_id: "",
        },
        "origin_place_id"
      );
    });

    it("origin_place_id must have correct type", async () => {
      await ivalidPlaceIDTest(
        {
          destination_place_id: "destination_place_id",
          origin_place_id: 1,
        },
        "origin_place_id"
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
    it("fails when the user already has a trip request with waitingConfirmation status", async () => {
      await invalidTripStatusTest("waiting-confirmation");
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

      // expect trip-request to have cancelled-by-client state
      snapshot = await tripRequestRef.once("value");
      assert.isTrue(snapshot.val() != null);
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

    it("fails if trip has payment-failed status", async () => {
      await failsWithStatus("payment-failed");
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

    it("fails if trip has no-drivers-available status", async () => {
      await failsWithStatus("no-drivers-available");
    });

    it("fails if trip has looking-for-driver status", async () => {
      await failsWithStatus("looking-for-driver");
    });

    it("fails if trip has waiting-payment status", async () => {
      await failsWithStatus("waiting-payment");
    });

    it("succeeds when trip has waiting-confirmation status", async () => {
      await succeedsWithStatus("waiting-confirmation");
    });

    it("succeeds when trip has waiting-driver status", async () => {
      await succeedsWithStatus("waiting-driver");
    });

    it("succeeds when trip has in-progress status", async () => {
      await succeedsWithStatus("in-progress");
    });
  });

  // we have not tested success or pilots accepting the trip yet
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

    const createTripRequestWithStatus = async (status) => {
      let tripRequest = {
        uid: defaultUID,
        origin_place_id: valid_origin_place_id,
        destination_place_id: valid_destination_place_id,
        trip_status: status,
        origin_zone: "AA",
      };
      await admin
        .database()
        .ref("trip-requests")
        .child(defaultUID)
        .set(tripRequest);
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
      await createTripRequestWithStatus("waiting-payment");

      // expect confirmTrip to fail
      await genericTest(
        "failed-precondition",
        "Trip request of user with uid " +
          defaultUID +
          " has invalid status 'waiting-payment'",
        defaultCtx
      );

      // populate database with trip request with invalid waiting-driver status

      await createTripRequestWithStatus("waiting-driver");

      // expect confirmTrip to fail
      await genericTest(
        "failed-precondition",
        "Trip request of user with uid " +
          defaultUID +
          " has invalid status 'waiting-driver'",
        defaultCtx
      );

      // populate database with trip request with invalid completed status
      await createTripRequestWithStatus("completed");

      // expect confirmTrip to fail
      await genericTest(
        "failed-precondition",
        "Trip request of user with uid " +
          defaultUID +
          " has invalid status 'completed'",
        defaultCtx
      );

      // populate database with trip request with invalid cancelled-by-driver status
      await createTripRequestWithStatus("cancelled-by-driver");

      // expect confirmTrip to fail
      await genericTest(
        "failed-precondition",
        "Trip request of user with uid " +
          defaultUID +
          " has invalid status 'cancelled-by-driver'",
        defaultCtx
      );

      // populate database with trip request with invalid cancelled-by-client status
      await createTripRequestWithStatus("cancelled-by-client");

      // expect confirmTrip to fail
      await genericTest(
        "failed-precondition",
        "Trip request of user with uid " +
          defaultUID +
          " has invalid status 'cancelled-by-client'",
        defaultCtx
      );

      // populate database with trip request with invalid in-progress status
      await createTripRequestWithStatus("in-progress");

      // expect confirmTrip to fail
      await genericTest(
        "failed-precondition",
        "Trip request of user with uid " +
          defaultUID +
          " has invalid status 'in-progress'",
        defaultCtx
      );
    });

    it("fails if there are no pilots nearby", async () => {
      // delete all pilots from database
      await admin.database().ref("pilots").remove();

      // populate database with trip request with valid status
      await createTripRequestWithStatus("waiting-confirmation");

      // expect confirmTrip to fail
      await genericTest(
        "failed-precondition",
        "There are no available pilots. Try again later."
      );
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

    it("user must be authenticated", async () => {
      // run generic test without context
      await genericTest(
        { client_id: "client_id" },
        "failed-precondition",
        "Missing authentication credentials.",
        {}
      );
    });

    it("argument must contain client_id string", async () => {
      await genericTest(
        {},
        "invalid-argument",
        "argument client_id must be a string with length greater than 0.",
        defaultCtx
      );
    });

    it("pilot must have been requested", async () => {
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
        total_trips: 123,
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
      let tripRequest = {
        uid: clientID,
        origin_place_id: valid_origin_place_id,
        destination_place_id: valid_destination_place_id,
        trip_status: "waiting-confirmation",
        origin_zone: "AA",
      };
      await admin
        .database()
        .ref("trip-requests")
        .child(clientID)
        .set(tripRequest);

      // confirm trip
      const wrappedConfirm = test.wrap(trip.confirm);
      wrappedConfirm({}, { auth: { uid: clientID } });

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
          { client_id: clientID },
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
      const clientID = "clientID";

      // add two available pilots to the database
      await admin.database().ref("pilots").remove();
      let defaultPilot = {
        uid: "",
        name: "Fulano",
        last_name: "de Tal",
        phone_number: "(38) 99999-9999",
        total_trips: 123,
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
      let tripRequest = {
        uid: clientID,
        origin_place_id: valid_origin_place_id,
        destination_place_id: valid_destination_place_id,
        trip_status: "waiting-confirmation",
        origin_zone: "AA",
      };
      await admin
        .database()
        .ref("trip-requests")
        .child(clientID)
        .set(tripRequest);

      // confirm trip
      const wrappedConfirm = test.wrap(trip.confirm);
      wrappedConfirm({}, { auth: { uid: clientID } });

      // wait enough for confirm to send out request to pilot 1 and 2
      // TODO: may have to increase this once process payments is implemented
      await sleep(5500);

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
      await wrappedAccept({ client_id: clientID }, { auth: { uid: pilotID1 } });

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
});
