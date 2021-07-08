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
  PartnerPastTrips,
  ClientPastTrips,
} = require("../lib/database/pastTrips");
const { expect } = require("chai");
const { Client } = require("../lib/database/client");
const { Partner } = require("../lib/database/partner");
const { Pagarme } = require("../lib/vendors/pagarme");
const assert = chai.assert;

// the tests actually hit venni-rider-development project in firebase
const test = firebaseFunctionsTest(
  {
    databaseURL:
      "https://venni-rider-development-8a3f8-default-rtdb.firebaseio.com/",
    projectId: "venni-rider-development-8a3f8",
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
  let getTripRequestByID;

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
    createTripRequest = async (
      status = "waiting-confirmation",
      partnerID = ""
    ) => {
      let defaultTripRequest = {
        uid: defaultUID,
        trip_status: status,
        origin_place_id: valid_origin_place_id,
        destination_place_id: valid_destination_place_id,
        origin_lat: "11.111111",
        origin_lng: "22.222222",
        destination_lat: "33.333333",
        destination_lng: "44.444444",
        origin_zone: "AA",
        fare_price: 500,
        distance_meters: "123",
        distance_text: "123 meters",
        duration_seconds: "300",
        duration_text: "5 minutes",
        encoded_points: "encoded_points",
        request_time: Date.now().toString(),
        origin_address: "origin_address",
        destination_address: "destination_address",
        partner_id: partnerID,
      };

      let tripRequestRef = admin
        .database()
        .ref("trip-requests")
        .child(defaultUID);

      await tripRequestRef.set(defaultTripRequest);
      return tripRequestRef;
    };

    getTripRequestByClientID = async (clientID) => {
      let snapshot = await admin
        .database()
        .ref("trip-requests")
        .child(clientID)
        .once("value");
      return snapshot.val();
    };
  });

  after(async () => {
    // clean database
    await admin.database().ref("trip-requests").remove();
    await admin.database().ref("partners").remove();
    await admin.database().ref("clients").remove();
    await admin.database().ref("past-trips").remove();
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
      await admin.database().ref("partners").remove();
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
    it("fails when the user already has a trip request with lookingForPartner status", async () => {
      await invalidTripStatusTest("looking-for-partner");
    });
    it("fails when the user already has a trip request with waitingPartner status", async () => {
      await invalidTripStatusTest("waiting-partner");
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
      await admin.database().ref("partners").remove();
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

    it("fails if trip has cancelled-by-partner status", async () => {
      await failsWithStatus("cancelled-by-partner");
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

    it("succeeds when trip has no-partners-available status", async () => {
      await succeedsWithStatus("no-partners-available");
    });

    it("succeeds when trip has looking-for-partner status", async () => {
      await succeedsWithStatus("looking-for-partner");
    });

    it("succeeds when trip has waiting-partner status", async () => {
      await succeedsWithStatus("waiting-partner");
    });

    it("succeeds when trip has in-progress status", async () => {
      await succeedsWithStatus("in-progress");
    });

    it("succeeds when integrated with confirmTrip and acceptTrip", async () => {
      // add an available partners to the database
      const partnerID = "partnerID";
      const clientID = "clientID";
      await admin.database().ref("partners").remove();
      let defaultPartner = {
        uid: partnerID,
        name: "Fulano",
        last_name: "de Tal",
        cpf: "00000000000",
        gender: "masculino",
        account_status: "approved",
        phone_number: "(38) 99999-9999",
        member_since: Date.now().toString(),
        current_latitude: "-17.217587",
        current_longitude: "-46.881064",
        current_zone: "AA",
        status: "available",
        vehicle: {
          brand: "honda",
          model: "CG 150",
          year: 2020,
          plate: "HMR 1092",
        },
        idle_since: Date.now().toString(),
        rating: "5.0",
      };
      const partnerRef = admin.database().ref("partners").child(partnerID);
      await partnerRef.set(defaultPartner);

      // add trip request to database with status waiting-confirmation
      let tripRequest = {
        uid: clientID,
        trip_status: "waiting-confirmation",
        origin_place_id: valid_origin_place_id,
        destination_place_id: valid_destination_place_id,
        origin_lat: "11.111111",
        origin_lng: "22.222222",
        destination_lat: "33.333333",
        destination_lng: "44.444444",
        origin_zone: "AA",
        fare_price: 500,
        distance_meters: "123",
        distance_text: "123 meters",
        duration_seconds: "300",
        duration_text: "5 minutes",
        encoded_points: "encoded_points",
        request_time: Date.now().toString(),
        origin_address: "origin_address",
        destination_address: "destination_address",
      };
      await admin.database().ref("trip-requests").remove();
      const tripRequestRef = admin
        .database()
        .ref("trip-requests")
        .child(clientID);
      await tripRequestRef.set(tripRequest);

      // confirm trip
      const wrappedConfirm = test.wrap(trip.confirm);
      wrappedConfirm({}, { auth: { uid: clientID } });

      // wait enough for confirm to send out request to partner
      await sleep(1500);

      // assert trip request has looking-for-partner status
      snapshot = await tripRequestRef.once("value");
      assert.notEqual(snapshot.val(), null);
      assert.equal(snapshot.val().trip_status, "looking-for-partner");

      // assert partner has been requested
      partnerSnapshot = await partnerRef.once("value");
      assert.isNotNull(partnerSnapshot.val());
      // this fails if there is a mockPartnerBehavior listener that automatically accepts the trip
      assert.equal(partnerSnapshot.val().status, "requested");

      // partner accepts trip
      const wrappedAccept = test.wrap(trip.accept);
      await wrappedAccept({}, { auth: { uid: partnerID } });

      // wait enough time for confirmTrip to grant trip to the partner
      await sleep(100);

      // assert partner was granted the trip
      partnerSnapshot = await partnerRef.once("value");
      assert.equal(partnerSnapshot.val().status, "busy");
      assert.equal(partnerSnapshot.val().current_client_uid, clientID);

      // assert trip request has waiting-partner status
      snapshot = await tripRequestRef.once("value");
      assert.notEqual(snapshot.val(), null);
      assert.equal(snapshot.val().trip_status, "waiting-partner");

      // assert trying to delete trip-request succeeds
      const wrapped = test.wrap(trip.client_cancel);
      const response = await wrapped({}, { auth: { uid: clientID } });
      assert.isNotNull(response);
      assert.equal(response.trip_status, "cancelled-by-client");

      // assert trip-request has cancelled-by-client state
      snapshot = await tripRequestRef.once("value");
      assert.isTrue(snapshot.val() != null);
      assert.equal(snapshot.val().trip_status, "cancelled-by-client");

      // assert partner has 'available' status and undefined 'current_client_uid'
      partnerSnapshot = await partnerRef.once("value");
      assert.equal(partnerSnapshot.val().status, "available");
      assert.equal(partnerSnapshot.val().current_client_uid, "");

      // delete resources
      await admin.database().ref("trip-requests").child(clientID).remove();
      await admin.database().ref("partners").child(partnerID).remove();
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
      await admin.database().ref("partners").remove();
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

    it("fails if partner accepts a trip without having been requested", async () => {
      const partnerID1 = "partnerID1";
      const partnerID2 = "partnerID2";
      const clientID = "clientID";

      // add two available partners to the database
      await admin.database().ref("partners").remove();
      let defaultPartner = {
        uid: "",
        name: "Fulano",
        last_name: "de Tal",
        cpf: "00000000000",
        gender: "masculino",
        account_status: "approved",
        member_since: Date.now().toString(),
        phone_number: "(38) 99999-9999",
        current_latitude: "-17.217587",
        current_longitude: "-46.881064",
        current_zone: "AA",
        status: "available",
        vehicle: {
          brand: "honda",
          model: "CG 150",
          year: 2020,
          plate: "HMR 1092",
        },
        idle_since: Date.now().toString(),
        rating: "5.0",
      };
      defaultPartner.uid = partnerID1;
      await admin
        .database()
        .ref("partners")
        .child(partnerID1)
        .set(defaultPartner);
      defaultPartner.uid = partnerID2;
      await admin
        .database()
        .ref("partners")
        .child(partnerID2)
        .set(defaultPartner);

      // add trip request to database
      await createTripRequest();

      // confirm trip
      const wrappedConfirm = test.wrap(trip.confirm);
      wrappedConfirm({}, { auth: { uid: defaultUID } });

      // wait enough for confirm to send out request to partner 1 only
      // TODO: may have to increase this once process payments is implemented
      await sleep(1500);

      // assert partner1 has been requested
      let partner1Ref = admin.database().ref("partners").child(partnerID1);
      let partner1Snapshot = await partner1Ref.once("value");
      assert.isNotNull(partner1Snapshot.val());
      assert.equal(partner1Snapshot.val().status, "requested");
      // assert partner2 has not been requested
      let partner2Ref = admin.database().ref("partners").child(partnerID2);
      let partner2Snapshot = await partner2Ref.once("value");
      assert.isNotNull(partner2Snapshot.val());
      assert.equal(partner2Snapshot.val().status, "available");

      // partner 2 accepts trip, thus failing
      const wrappedAccept = test.wrap(trip.accept);
      try {
        await wrappedAccept({}, { auth: { uid: partnerID2 } });
        assert(false, "should have failed");
      } catch (e) {
        assert.strictEqual(e.code, "failed-precondition");
        assert.strictEqual(
          e.message,
          "partner has not been requested for trip or trip has already been picked."
        );
      }
    });

    it("works", async () => {
      const partnerID1 = "partnerID1";
      const partnerID2 = "partnerID2";

      // add two available partners to the database
      await admin.database().ref("partners").remove();
      let defaultPartner = {
        uid: "",
        name: "Fulano",
        last_name: "de Tal",
        cpf: "00000000000",
        gender: "masculino",
        account_status: "approved",
        phone_number: "(38) 99999-9999",
        member_since: Date.now().toString(),
        current_latitude: "-17.217587",
        current_longitude: "-46.881064",
        current_zone: "AA",
        status: "available",
        vehicle: {
          brand: "honda",
          model: "CG 150",
          year: 2020,
          plate: "HMR 1092",
        },
        idle_since: Date.now().toString(),
        rating: "5.0",
      };
      defaultPartner.uid = partnerID1;
      await admin
        .database()
        .ref("partners")
        .child(partnerID1)
        .set(defaultPartner);
      defaultPartner.uid = partnerID2;
      await admin
        .database()
        .ref("partners")
        .child(partnerID2)
        .set(defaultPartner);

      // add trip request to database
      await createTripRequest();

      // confirm trip
      const wrappedConfirm = test.wrap(trip.confirm);
      wrappedConfirm({}, { auth: { uid: defaultUID } });

      // wait enough for confirm to send out request to partner 1 and 2
      // TODO: may have to increase this once process payments is implemented
      await sleep(7000);

      // assert partner1 has been requested
      let partner1Ref = admin.database().ref("partners").child(partnerID1);
      let partner1Snapshot = await partner1Ref.once("value");
      assert.isNotNull(partner1Snapshot.val());
      // this fails if there is a mockPartnerBehavior listener that automatically accepts the trip
      assert.equal(partner1Snapshot.val().status, "requested");
      // assert partner2 has been requested
      let partner2Ref = admin.database().ref("partners").child(partnerID2);
      let partner2Snapshot = await partner2Ref.once("value");
      assert.isNotNull(partner2Snapshot.val());
      assert.equal(partner2Snapshot.val().status, "requested");

      const wrappedAccept = test.wrap(trip.accept);
      // partner 1 accepts trip first
      let partner1Promise = wrappedAccept({}, { auth: { uid: partnerID1 } });

      // then, partner 2 also accepts the trip
      let partner2Promise = wrappedAccept({}, { auth: { uid: partnerID2 } });

      // assert partner1 status is busy
      await partner1Promise;
      partner1Snapshot = await partner1Ref.once("value");
      assert.isNotNull(partner1Snapshot.val());
      assert.equal(partner1Snapshot.val().status, "busy");

      // assert partner2 was denied the trip and their status is available again
      await partner2Promise;
      partner2Snapshot = await partner2Ref.once("value");
      assert.isNotNull(partner2Snapshot.val());
      assert.equal(partner2Snapshot.val().status, "available");
    });
  });

  describe("confirm", () => {
    let pagarmeClient;
    let payment;

    before(async () => {
      // initialize pagarme
      pagarmeClient = new Pagarme();
      await pagarmeClient.ensureInitialized();
      // initialize payment
      payment = require("../lib/payment");
    });

    const genericTest = async (
      expectedCode,
      expectedMessage,
      ctx = defaultCtx,
      succeeed = false,
      argument = {}
    ) => {
      const wrapped = test.wrap(trip.confirm);
      try {
        await wrapped(argument, ctx);
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
      await admin.database().ref("partners").remove();
    });

    const removeTripRequests = async () => {
      await admin.database().ref("trip-requests").remove();
    };

    const removeClients = async () => {
      await admin.database().ref("clients").remove();
    };

    const removePartners = async () => {
      await admin.database().ref("partners").remove();
    };

    it("user must be authenticated", async () => {
      // run generic test without context with client id
      await genericTest(
        "failed-precondition",
        "Missing authentication credentials.",
        {}
      );
    });

    it("fails if 'card_id' is specified but not a string", async () => {
      await genericTest(
        "invalid-argument",
        "argument 'card_id' has invalid type. Expected 'string'. Received 'number'.",
        defaultCtx,
        false,
        { card_id: 123 }
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

      // populate database with trip request with invalid waiting-partner status

      await createTripRequest("waiting-partner");

      // expect confirmTrip to fail
      await genericTest(
        "failed-precondition",
        "Trip request of user with uid " +
          defaultUID +
          " has invalid status 'waiting-partner'",
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

    it("fails if 'card_id' doesn't not correspond to a card", async () => {
      // populate database with 'client' without 'cards'
      let clientRef = admin.database().ref("clients").child(defaultUID);
      await clientRef.set({
        uid: defaultUID,
        rating: "5.0",
        payment_method: {
          default: "cash",
        },
      });

      // populate database with trip request with valid status
      await createTripRequest("waiting-confirmation");

      // expect confirmTrip to fail
      await genericTest(
        "failed-precondition",
        "Could not find card with id 'inexisting_id'.",
        defaultCtx,
        false,
        { card_id: "inexisting_id" }
      );

      // clear database
      await removeTripRequests();
    });

    it("fails if paying with credit card but the transaction throws error", async () => {
      // create client in database with default payment as a card that wasn't added to pagarme
      const c = new Client(defaultUID);
      await c.addClient({
        uid: defaultUID,
        rating: "5",
        payment_method: {
          default: "credit_card",
          card_id: "card_id",
        },
        cards: {
          card_id: {
            id: "card_id",
            holder_name: "Joao das Neves",
            brand: "visa",
            last_digits: "8909",
            first_digits: "523421",
            expiration_date: "0235",
            pagarme_customer_id: 12345,
            billing_address: {
              country: "br",
              state: "mg",
              city: "Paracatu",
              street: "Rua i",
              street_number: "151",
              zipcode: "38600000",
            },
          },
        },
      });
      // assert client was succesfully created
      let client = await c.getClient();
      assert.isDefined(client);

      // populate database with trip request with valid status
      await createTripRequest("waiting-confirmation");

      // call confirmTrip with id of card to be refused and expect it to fail
      await genericTest(
        "cancelled",
        "Payment was not authorized.",
        defaultCtx,
        false,
        { card_id: "card_id" }
      );

      // clear database
      await removeTripRequests();
      await removeClients();
    });

    it("saves transaction capture info in tripRequest if the transaction is authorized", async () => {
      // delete all partners from the database
      const partnersRef = admin.database().ref("partners");
      await partnersRef.remove();

      // add an available partner to the database
      const partnerID1 = "partnerID1";
      let partner = {
        uid: partnerID1,
        name: "Fulano",
        last_name: "de Tal",
        cpf: "00000000000",
        gender: "masculino",
        account_status: "approved",
        member_since: Date.now().toString(),
        phone_number: "(38) 99999-9999",
        current_latitude: "-17.217587",
        current_longitude: "-46.881064",
        current_zone: "AA",
        status: "available",
        vehicle: {
          brand: "honda",
          model: "CG 150",
          year: 2020,
          plate: "HMR 1092",
        },
        idle_since: Date.now().toString(),
        rating: "5.0",
      };
      await partnersRef.child(partnerID1).set(partner);

      // add client to the database
      const c = new Client(defaultUID);
      await c.addClient({
        uid: defaultUID,
        rating: "5",
        payment_method: {
          default: "cash",
        },
      });

      // create a valid card for the client
      validCard = {
        card_number: "5234213829598909",
        card_expiration_date: "0235",
        card_holder_name: "Joao das Neves",
        card_cvv: "600",
      };
      cardHash = await pagarmeClient.encrypt(validCard);
      let createCardArg = {
        card_number: validCard.card_number,
        card_expiration_date: validCard.card_expiration_date,
        card_holder_name: validCard.card_holder_name,
        card_hash: cardHash,
        cpf_number: "58229366365",
        email: "fulano@venni.app",
        phone_number: "+5538998601275",
        billing_address: {
          country: "br",
          state: "mg",
          city: "Paracatu",
          street: "Rua i",
          street_number: "151",
          zipcode: "38600000",
        },
      };
      const wrappedCreateCard = test.wrap(payment.create_card);
      let createCardResult = await wrappedCreateCard(createCardArg, defaultCtx);

      // add trip request to database
      const tripRequestRef = await createTripRequest();

      // call confirmTrip with id of card to be used in transaction
      const wrappedConfirm = test.wrap(trip.confirm);
      const confirmPromise = wrappedConfirm(
        { card_id: createCardResult.id },
        { auth: { uid: defaultUID } }
      );

      // wait enough time for confirm to send request to partner
      // may have to increae this if test is failing
      await sleep(5500);

      // assert trip has looking-for-partner status
      let tripRequestSnapshot = await tripRequestRef.once("value");
      assert.isNotNull(tripRequestSnapshot.val());
      assert.equal(
        tripRequestSnapshot.val().trip_status,
        "looking-for-partner"
      );

      // assert partner was requested
      let partner1Snapshot = await partnersRef.child(partnerID1).once("value");
      assert.isNotNull(partner1Snapshot.val());
      assert.equal(partner1Snapshot.val().status, "requested");
      assert.isUndefined(partner1Snapshot.val().total_trips);

      // partner one accepts the trip
      const wrappedAccept = test.wrap(trip.accept);
      await wrappedAccept({}, { auth: { uid: partnerID1 } });

      // await for confirmTrip to return
      const confirmResult = await confirmPromise;

      // // make sure that payment_method, card_id and transaction_id were added to trip request
      let tripRequest = await getTripRequestByClientID(defaultUID);
      assert.isNotNull(tripRequest);

      assert.equal(tripRequest.payment_method, "credit_card");
      assert.isDefined(tripRequest.credit_card);
      assert.equal(tripRequest.credit_card.id, createCardResult.id);
      assert.isDefined(tripRequest.transaction_id);

      // clean database
      await removeClients();
      await partnersRef.remove();
      await tripRequestRef.remove();
    });

    it("sets tripRequest 'payment_method' to 'cash' if client is paying cash", async () => {
      // delete all partners from the database
      const partnersRef = admin.database().ref("partners");
      await partnersRef.remove();

      // add an available partner to the database
      const partnerID1 = "partnerID1";
      let partner = {
        uid: partnerID1,
        name: "Fulano",
        last_name: "de Tal",
        cpf: "00000000000",
        gender: "masculino",
        account_status: "approved",
        member_since: Date.now().toString(),
        phone_number: "(38) 99999-9999",
        current_latitude: "-17.217587",
        current_longitude: "-46.881064",
        current_zone: "AA",
        status: "available",
        vehicle: {
          brand: "honda",
          model: "CG 150",
          year: 2020,
          plate: "HMR 1092",
        },
        idle_since: Date.now().toString(),
        rating: "5.0",
      };
      await partnersRef.child(partnerID1).set(partner);

      // add client to the database
      const c = new Client(defaultUID);
      await c.addClient({
        uid: defaultUID,
        rating: "5",
        payment_method: {
          default: "cash",
        },
      });

      // add trip request to database
      const tripRequestRef = await createTripRequest();

      // call confirmTrip without 'card_id' so payment method is 'cash'
      const wrappedConfirm = test.wrap(trip.confirm);
      const confirmPromise = wrappedConfirm({}, { auth: { uid: defaultUID } });

      // wait enough time for confirm to send request to partner
      await sleep(3000);

      // assert trip has looking-for-partner status
      let tripRequestSnapshot = await tripRequestRef.once("value");
      assert.isNotNull(tripRequestSnapshot.val());
      assert.equal(
        tripRequestSnapshot.val().trip_status,
        "looking-for-partner"
      );

      // assert partner was requested
      let partner1Snapshot = await partnersRef.child(partnerID1).once("value");
      assert.isNotNull(partner1Snapshot.val());
      assert.equal(partner1Snapshot.val().status, "requested");
      assert.isUndefined(partner1Snapshot.val().total_trips);

      // partner one accepts the trip
      const wrappedAccept = test.wrap(trip.accept);
      await wrappedAccept({}, { auth: { uid: partnerID1 } });

      // await for confirmTrip to return
      const confirmResult = await confirmPromise;

      let tripRequest = await getTripRequestByClientID(defaultUID);
      assert.isNotNull(tripRequest);
      // assert that payment_method was set to cash
      assert.equal(tripRequest.payment_method, "cash");
      // assert that card_id and transaction_id are undefined
      assert.isUndefined(tripRequest.card_id);
      assert.isUndefined(tripRequest.transaction_id);

      // clean database
      await removeClients();
      await partnersRef.remove();
      await tripRequestRef.remove();
    });

    it("fails if there are no partners nearby", async () => {
      // delete all partners from database
      await admin.database().ref("partners").remove();

      // populate database with trip request with valid status
      await createTripRequest("waiting-confirmation");

      // expect confirmTrip to fail
      await genericTest(
        "failed-precondition",
        "There are no available partners. Try again later."
      );

      // clear database
      await removeTripRequests();
    });

    it("works when integrated with accept trip", async () => {
      // delete all partners from the database
      const partnersRef = admin.database().ref("partners");
      await partnersRef.remove();

      // add three available partners to the database
      const partnerID1 = "partnerID1";
      const partnerID2 = "partnerID2";
      const partnerID3 = "partnerID3";
      let partner = {
        uid: "",
        name: "Fulano",
        last_name: "de Tal",
        cpf: "00000000000",
        gender: "masculino",
        account_status: "approved",
        member_since: Date.now().toString(),
        phone_number: "(38) 99999-9999",
        current_latitude: "-17.217587",
        current_longitude: "-46.881064",
        current_zone: "AA",
        status: "available",
        vehicle: {
          brand: "honda",
          model: "CG 150",
          year: 2020,
          plate: "HMR 1092",
        },
        idle_since: Date.now().toString(),
        rating: "5.0",
      };
      partner.uid = partnerID1;
      await partnersRef.child(partnerID1).set(partner);
      partner.uid = partnerID2;
      await partnersRef.child(partnerID2).set(partner);
      partner.uid = partnerID3;
      await partnersRef.child(partnerID3).set(partner);

      // add trip request to database
      const tripRequestRef = await createTripRequest();

      // confirm trip
      const wrappedConfirm = test.wrap(trip.confirm);
      const confirmPromise = wrappedConfirm({}, { auth: { uid: defaultUID } });

      // wait enough time for confirm to send request to partner1 and partner 2
      await sleep(8500);

      // assert trip has looking-for-partner status
      let tripRequestSnapshot = await tripRequestRef.once("value");
      assert.isNotNull(tripRequestSnapshot.val());
      assert.equal(
        tripRequestSnapshot.val().trip_status,
        "looking-for-partner"
      );

      // assert partner 1 has been requested
      let partner1Snapshot = await partnersRef.child(partnerID1).once("value");
      assert.isNotNull(partner1Snapshot.val());
      assert.equal(partner1Snapshot.val().status, "requested");
      assert.isUndefined(partner1Snapshot.val().total_trips);
      // assert partner 2 has been requested
      let partner2Snapshot = await partnersRef.child(partnerID2).once("value");
      assert.isNotNull(partner2Snapshot.val());
      assert.equal(partner2Snapshot.val().status, "requested");
      // assert partner 3 has not been requested
      let partner3Snapshot = await partnersRef.child(partnerID3).once("value");
      assert.isNotNull(partner3Snapshot.val());
      assert.equal(partner3Snapshot.val().status, "available");

      // partner one accepts the trip
      const wrappedAccept = test.wrap(trip.accept);
      await wrappedAccept({}, { auth: { uid: partnerID1 } });
      await sleep(200);

      // assert confirm trip returned information about partner 1
      const confirmResult = await confirmPromise;
      assert.equal(confirmResult.partner_id, partnerID1);
      assert.equal(confirmResult.partner_status, "busy");
      assert.equal(confirmResult.current_client_uid, defaultUID);
      assert.equal(confirmResult.trip_status, "waiting-partner");
      // partner's total_trips is zero
      assert.equal(confirmResult.partner_total_trips, "0");

      // assert trip has waiting-partner status
      tripRequestSnapshot = await tripRequestRef.once("value");
      assert.isNotNull(tripRequestSnapshot.val());
      assert.equal(tripRequestSnapshot.val().trip_status, "waiting-partner");

      // assert partner 1 status is busy
      partner1Snapshot = await partnersRef.child(partnerID1).once("value");
      assert.isNotNull(partner1Snapshot.val());
      assert.equal(partner1Snapshot.val().status, "busy");
      assert.equal(partner1Snapshot.val().current_client_uid, defaultUID);
      // assert partner 2 status once again available
      partner2Snapshot = await partnersRef.child(partnerID2).once("value");
      assert.isNotNull(partner2Snapshot.val());
      assert.equal(partner2Snapshot.val().status, "available");
      // assert partner 3 is still available
      partner3Snapshot = await partnersRef.child(partnerID3).once("value");
      assert.isNotNull(partner3Snapshot.val());
      assert.equal(partner3Snapshot.val().status, "available");

      // clean database
      await partnersRef.remove();
      await tripRequestRef.remove();
    });

    it("doesn't accept partners who were not picked by the algorithm", async () => {
      // delete all partners from the database
      const partnersRef = admin.database().ref("partners");
      await partnersRef.remove();

      // add one available and one busy partners to the database
      const partnerID1 = "partnerID1";
      const partnerID2 = "partnerID2";
      let partner = {
        uid: "",
        name: "Fulano",
        last_name: "de Tal",
        cpf: "00000000000",
        gender: "masculino",
        account_status: "approved",
        member_since: Date.now().toString(),
        phone_number: "(38) 99999-9999",
        current_latitude: "-17.217587",
        current_longitude: "-46.881064",
        current_zone: "AA",
        status: "",
        vehicle: {
          brand: "honda",
          model: "CG 150",
          year: 2020,
          plate: "HMR 1092",
        },
        idle_since: Date.now().toString(),
        rating: "5.0",
      };
      partner.uid = partnerID1;
      partner.status = "available";
      await partnersRef.child(partnerID1).set(partner);
      partner.uid = partnerID2;
      partner.status = "busy";
      await partnersRef.child(partnerID2).set(partner);

      // add trip request to database
      const tripRequestRef = await createTripRequest();

      // confirm trip
      const wrappedConfirm = test.wrap(trip.confirm);
      const confirmPromise = wrappedConfirm({}, { auth: { uid: defaultUID } });

      // wait enough time for confirm to send request to partner1
      // may have to increase if test is not passing
      await sleep(2500);

      // assert trip has looking-for-partner status
      let tripRequestSnapshot = await tripRequestRef.once("value");
      assert.isNotNull(tripRequestSnapshot.val());
      assert.equal(
        tripRequestSnapshot.val().trip_status,
        "looking-for-partner"
      );

      // assert partner 1 has been requested
      let partner1Snapshot = await partnersRef.child(partnerID1).once("value");
      assert.isNotNull(partner1Snapshot.val());
      assert.equal(partner1Snapshot.val().status, "requested");
      // assert partner 2 has not been requested
      let partner2Snapshot = await partnersRef.child(partnerID2).once("value");
      assert.isNotNull(partner2Snapshot.val());
      assert.equal(partner2Snapshot.val().status, "busy");

      // partner 2 accepts the trip (bypass accepTrip, which would fail)
      await tripRequestRef.child("partner_id").set(partnerID2);

      // assert confirm trip didn't accept partner 2
      tripRequestSnapshot = await tripRequestRef.once("value");
      assert.isNotNull(tripRequestSnapshot.val());
      assert.equal(tripRequestSnapshot.val().partner_id, "");

      // partner 1 accepts the trip
      const wrappedAccept = test.wrap(trip.accept);
      await wrappedAccept({}, { auth: { uid: partnerID1 } });

      // assert confirm trip accepted partner 1
      tripRequestSnapshot = await tripRequestRef.once("value");
      assert.isNotNull(tripRequestSnapshot.val());
      assert.equal(tripRequestSnapshot.val().partner_id, partnerID1);

      // clean database
      await partnersRef.remove();
      await tripRequestRef.remove();
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
      await admin.database().ref("partners").remove();
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
      const partnerID1 = "partnerID1";
      const clientID = "clientID";

      // add a partner to the database supposedly handing a trip for clientID
      await admin.database().ref("partners").remove();
      let defaultPartner = {
        uid: partnerID1,
        name: "Fulano",
        last_name: "de Tal",
        cpf: "00000000000",
        gender: "masculino",
        account_status: "approved",
        member_since: Date.now().toString(),
        phone_number: "(38) 99999-9999",
        current_latitude: "-17.217587",
        current_longitude: "-46.881064",
        current_client_uid: clientID,
        current_zone: "AA",
        status: "busy",
        vehicle: {
          brand: "honda",
          model: "CG 150",
          year: 2020,
          plate: "HMR 1092",
        },
        idle_since: Date.now().toString(),
        rating: "5.0",
      };
      await admin
        .database()
        .ref("partners")
        .child(partnerID1)
        .set(defaultPartner);

      // add no trip request to database
      await admin.database().ref("trip-requests").remove();

      // fail if partner tries starting trip for clientID without any trip-requests
      const wrappedStart = test.wrap(trip.start);
      try {
        await wrappedStart({}, { auth: { uid: partnerID1 } });
        assert(false, "should have failed");
      } catch (e) {
        assert.equal(e.code, "not-found");
        assert.equal(
          e.message,
          "There is no trip request being handled by the partner partnerID1"
        );
      }
    });

    it("fails when trying to start trip with status different from waiting-partner", async () => {
      const partnerID1 = "partnerID1";
      const clientID = "clientID";

      // add trip request for clientID with status different from waiting-partner
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

      // add a partner to the database supposedly handing the trip for clientID
      await admin.database().ref("partners").remove();
      let defaultPartner = {
        uid: partnerID1,
        name: "Fulano",
        last_name: "de Tal",
        cpf: "00000000000",
        gender: "masculino",
        account_status: "approved",
        member_since: Date.now().toString(),
        phone_number: "(38) 99999-9999",
        current_latitude: "-17.217587",
        current_longitude: "-46.881064",
        current_client_uid: clientID,
        current_zone: "AA",
        status: "busy",
        vehicle: {
          brand: "honda",
          model: "CG 150",
          year: 2020,
          plate: "HMR 1092",
        },
        idle_since: Date.now().toString(),
        rating: "5.0",
      };
      await admin
        .database()
        .ref("partners")
        .child(partnerID1)
        .set(defaultPartner);

      // fail if partner tries starting the trip without waiting-partner status
      const wrappedStart = test.wrap(trip.start);
      try {
        await wrappedStart({}, { auth: { uid: partnerID1 } });
        assert(false, "should have failed");
      } catch (e) {
        assert.equal(e.code, "failed-precondition");
        assert.equal(
          e.message,
          "cannot accept trip in status 'waiting-confirmation'"
        );
      }
    });

    it("fails when trying to start trip for which partner was not chosen", async () => {
      const partnerID1 = "partnerID1";
      const anotherPartnerID = "anotherPartnerID";
      const clientID = "clientID";

      // add trip request for clientID that is being handled by another partner
      let tripRequest = {
        uid: clientID,
        origin_place_id: valid_origin_place_id,
        destination_place_id: valid_destination_place_id,
        trip_status: "waiting-partner",
        partner_id: anotherPartnerID,
        origin_zone: "AA",
      };
      const tripRequestRef = admin
        .database()
        .ref("trip-requests")
        .child(clientID);
      await tripRequestRef.set(tripRequest);

      // add a partner to the database supposedly handing the trip for clientID
      await admin.database().ref("partners").remove();
      let defaultPartner = {
        uid: partnerID1,
        name: "Fulano",
        last_name: "de Tal",
        cpf: "00000000000",
        gender: "masculino",
        account_status: "approved",
        member_since: Date.now().toString(),
        phone_number: "(38) 99999-9999",
        current_latitude: "-17.217587",
        current_longitude: "-46.881064",
        current_client_uid: clientID,
        current_zone: "AA",
        status: "busy",
        vehicle: {
          brand: "honda",
          model: "CG 150",
          year: 2020,
          plate: "HMR 1092",
        },
        idle_since: Date.now().toString(),
        rating: "5.0",
      };
      await admin
        .database()
        .ref("partners")
        .child(partnerID1)
        .set(defaultPartner);

      // fail if partner tries starting the trip without waiting-partner status
      const wrappedStart = test.wrap(trip.start);
      try {
        await wrappedStart({}, { auth: { uid: partnerID1 } });
        assert(false, "should have failed");
      } catch (e) {
        assert.equal(e.code, "failed-precondition");
        assert.equal(e.message, "partner has not been designated to this trip");
      }
    });

    it("works when integrated with confirmTrip and acceptTrip", async () => {
      const partnerID1 = "partnerID1";
      const partnerID2 = "partnerID2";

      // add two available partners to the database
      await admin.database().ref("partners").remove();
      await admin.database().ref("partners").remove();
      let defaultPartner = {
        uid: "",
        name: "Fulano",
        last_name: "de Tal",
        cpf: "00000000000",
        gender: "masculino",
        account_status: "approved",
        member_since: Date.now().toString(),
        phone_number: "(38) 99999-9999",
        current_latitude: "-17.217587",
        current_longitude: "-46.881064",
        current_zone: "AA",
        status: "available",
        vehicle: {
          brand: "honda",
          model: "CG 150",
          year: 2020,
          plate: "HMR 1092",
        },
        idle_since: Date.now().toString(),
        rating: "5.0",
      };
      defaultPartner.uid = partnerID1;
      await admin
        .database()
        .ref("partners")
        .child(partnerID1)
        .set(defaultPartner);
      defaultPartner.uid = partnerID2;
      await admin
        .database()
        .ref("partners")
        .child(partnerID2)
        .set(defaultPartner);

      // add trip request to database
      const tripRequestRef = await createTripRequest();

      // user confirms trip
      const wrappedConfirm = test.wrap(trip.confirm);
      wrappedConfirm({}, { auth: { uid: defaultUID } });

      // wait enough for confirm to send out request to partner 1 only
      // TODO: may have to increase this once process payments is implemented
      await sleep(2000);

      // assert trip status has changed to looking-for-partner
      let tripSnapshot = await tripRequestRef.once("value");
      assert.isNotNull(tripSnapshot.val());
      assert.equal(tripSnapshot.val().trip_status, "looking-for-partner");

      // assert partner1 has been requested
      let partner1Ref = admin.database().ref("partners").child(partnerID1);
      let partner1Snapshot = await partner1Ref.once("value");
      assert.isNotNull(partner1Snapshot.val());
      assert.equal(partner1Snapshot.val().status, "requested");
      // assert partner2 has not been requested
      let partner2Ref = admin.database().ref("partners").child(partnerID2);
      let partner2Snapshot = await partner2Ref.once("value");
      assert.isNotNull(partner2Snapshot.val());
      assert.equal(partner2Snapshot.val().status, "available");

      // fail if partner 2 tries starting the trip without being requested
      const wrappedStart = test.wrap(trip.start);
      try {
        await wrappedStart(
          { client_id: defaultUID },
          { auth: { uid: partnerID2 } }
        );
        assert(false, "should have failed");
      } catch (e) {
        assert.strictEqual(e.code, "failed-precondition");
        assert.strictEqual(
          e.message,
          "partner has not been requested for the trip."
        );
      }

      // fail if partner 1 tries starting the trip without having accepted it first
      try {
        await wrappedStart(
          { client_id: defaultUID },
          { auth: { uid: partnerID1 } }
        );
        assert(false, "should have failed");
      } catch (e) {
        assert.strictEqual(e.code, "failed-precondition");
        assert.strictEqual(
          e.message,
          "partner has not been requested for the trip."
        );
      }

      // partner 1 accepts the trip
      const wrappedAccept = test.wrap(trip.accept);
      await wrappedAccept({}, { auth: { uid: partnerID1 } });

      // assert partner 1 is busy
      partner1Snapshot = await partner1Ref.once("value");
      assert.isNotNull(partner1Snapshot.val());
      assert.equal(partner1Snapshot.val().status, "busy");

      // assert trip status has changed to waiting-partner
      tripSnapshot = await tripRequestRef.once("value");
      assert.isNotNull(tripSnapshot.val());
      assert.equal(tripSnapshot.val().trip_status, "waiting-partner");

      // now partner 1 is able to start the trip
      await wrappedStart(
        { client_id: defaultUID },
        { auth: { uid: partnerID1 } }
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
    let pagarmeClient;
    let payment;
    let creditCard;
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
      await admin.database().ref("past-trips").child("partners").remove();
      // initialize pagarme
      pagarmeClient = new Pagarme();
      await pagarmeClient.ensureInitialized();
      // initialize payment
      payment = require("../lib/payment");

      // create credit card
      validCard = {
        card_number: "5234213829598909",
        card_expiration_date: "0235",
        card_holder_name: "Joao das Neves",
        card_cvv: "600",
      };
      cardHash = await pagarmeClient.encrypt(validCard);
      let createCardArg = {
        card_number: validCard.card_number,
        card_expiration_date: validCard.card_expiration_date,
        card_holder_name: validCard.card_holder_name,
        card_hash: cardHash,
        cpf_number: "58229366365",
        email: "fulano@venni.app",
        phone_number: "+5538998601275",
        billing_address: {
          country: "br",
          state: "mg",
          city: "Paracatu",
          street: "Rua i",
          street_number: "151",
          zipcode: "38600000",
        },
      };
      const wrappedCreateCard = test.wrap(payment.create_card);
      creditCard = await wrappedCreateCard(createCardArg, defaultCtx);
    });

    after(async () => {
      await admin.database().ref("trip-requests").remove();
      await admin.database().ref("partners").remove();
      await admin.database().ref("clients").remove();
      await admin.database().ref("past-trips").child("clients").remove();
      await admin.database().ref("past-trips").child("partners").remove();
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

    it("fails when partner is not busy", async () => {
      const partnerID1 = "partnerID1";
      const clientID = "clientID";

      // add a partner to the database supposedly handing a trip for clientID
      await admin.database().ref("partners").remove();
      let defaultPartner = {
        uid: partnerID1,
        name: "Fulano",
        last_name: "de Tal",
        cpf: "00000000000",
        gender: "masculino",
        account_status: "approved",
        member_since: Date.now().toString(),
        phone_number: "(38) 99999-9999",
        current_latitude: "-17.217587",
        current_longitude: "-46.881064",
        current_client_uid: clientID,
        current_zone: "AA",
        status: "available",
        vehicle: {
          brand: "honda",
          model: "CG 150",
          year: 2020,
          plate: "HMR 1092",
        },
        idle_since: Date.now().toString(),
        rating: "5.0",
      };
      await admin
        .database()
        .ref("partners")
        .child(partnerID1)
        .set(defaultPartner);

      // fail if partner tries confirming the trip without being busy
      const wrappedComplete = test.wrap(trip.complete);
      try {
        await wrappedComplete(
          { client_rating: 5 },
          { auth: { uid: partnerID1 } }
        );
        assert(false, "should have failed");
      } catch (e) {
        assert.equal(e.code, "failed-precondition");
        assert.equal(e.message, "partner is not handling a trip.");
      }
    });

    it("fails when current_client_uid is not set", async () => {
      const partnerID1 = "partnerID1";
      const clientID = "clientID";

      // add a partner to the database supposedly handing a trip for clientID
      await admin.database().ref("partners").remove();
      let defaultPartner = {
        uid: partnerID1,
        name: "Fulano",
        last_name: "de Tal",
        cpf: "00000000000",
        gender: "masculino",
        account_status: "approved",
        member_since: Date.now().toString(),
        phone_number: "(38) 99999-9999",
        current_latitude: "-17.217587",
        current_longitude: "-46.881064",
        current_zone: "AA",
        status: "busy",
        vehicle: {
          brand: "honda",
          model: "CG 150",
          year: 2020,
          plate: "HMR 1092",
        },
        idle_since: Date.now().toString(),
        rating: "5.0",
      };
      await admin
        .database()
        .ref("partners")
        .child(partnerID1)
        .set(defaultPartner);

      // fail if partner tries confirming the trip without current_client_uid
      const wrappedComplete = test.wrap(trip.complete);
      try {
        await wrappedComplete(
          { client_rating: 5 },
          { auth: { uid: partnerID1 } }
        );
        assert(false, "should have failed");
      } catch (e) {
        assert.equal(e.code, "failed-precondition");
        assert.equal(e.message, "partner is not handling a trip.");
      }
    });

    it("fails when there is no client datbase entry for the user", async () => {
      const partnerID1 = "partnerID1";
      const clientID = "clientID";

      // add a partner to the database supposedly handing a trip for clientID
      await admin.database().ref("partners").remove();
      let defaultPartner = {
        uid: partnerID1,
        name: "Fulano",
        last_name: "de Tal",
        cpf: "00000000000",
        gender: "masculino",
        account_status: "approved",
        member_since: Date.now().toString(),
        phone_number: "(38) 99999-9999",
        current_latitude: "-17.217587",
        current_longitude: "-46.881064",
        current_client_uid: clientID,
        current_zone: "AA",
        status: "busy",
        vehicle: {
          brand: "honda",
          model: "CG 150",
          year: 2020,
          plate: "HMR 1092",
        },
        idle_since: Date.now().toString(),
        rating: "5.0",
      };
      await admin
        .database()
        .ref("partners")
        .child(partnerID1)
        .set(defaultPartner);

      // add trip request supposedly for user
      let defaultTripRequest = {
        uid: clientID,
        trip_status: "in-progress",
        origin_place_id: valid_origin_place_id,
        destination_place_id: valid_destination_place_id,
        origin_lat: "11.111111",
        origin_lng: "22.222222",
        destination_lat: "33.333333",
        destination_lng: "44.444444",
        origin_zone: "AA",
        fare_price: 500,
        distance_meters: "123",
        distance_text: "123 meters",
        duration_seconds: "300",
        duration_text: "5 minutes",
        encoded_points: "encoded_points",
        request_time: Date.now().toString(),
        origin_address: "origin_address",
        destination_address: "destination_address",
        partner_id: partnerID1,
      };
      await admin
        .database()
        .ref("trip-requests")
        .child(clientID)
        .set(defaultTripRequest);

      // make sure there is no client entry
      await admin.database().ref("clients").remove();

      // fail if partner tries confirming the trip for inexisting user
      const wrappedComplete = test.wrap(trip.complete);
      try {
        await wrappedComplete(
          { client_rating: 5 },
          { auth: { uid: partnerID1 } }
        );
        assert(false, "should have failed");
      } catch (e) {
        assert.equal(e.code, "failed-precondition");
        assert.equal(e.message, "there exists no client with id 'clientID'");
      }

      // clear database
      await admin.database().ref("trip-requests").remove();
      await admin.database().ref("past-trips").remove();
    });

    it("fails when client has no active trip-request", async () => {
      const partnerID1 = "partnerID1";
      const clientID = "clientID";

      // add client entry to the database
      const clientRef = admin.database().ref("clients").child(clientID);
      await clientRef.set({
        uid: clientID,
        rating: "5",
      });

      // add a partner to the database supposedly handing a trip for clientID
      await admin.database().ref("partners").remove();
      let defaultPartner = {
        uid: partnerID1,
        name: "Fulano",
        last_name: "de Tal",
        cpf: "00000000000",
        gender: "masculino",
        account_status: "approved",
        member_since: Date.now().toString(),
        phone_number: "(38) 99999-9999",
        current_latitude: "-17.217587",
        current_longitude: "-46.881064",
        current_client_uid: clientID,
        current_zone: "AA",
        status: "busy",
        vehicle: {
          brand: "honda",
          model: "CG 150",
          year: 2020,
          plate: "HMR 1092",
        },
        idle_since: Date.now().toString(),
        rating: "5.0",
      };
      await admin
        .database()
        .ref("partners")
        .child(partnerID1)
        .set(defaultPartner);

      // add no trip request to database
      await admin.database().ref("trip-requests").remove();

      // fail if partner tries starting trip for clientID without any trip-requests
      const wrappedComplete = test.wrap(trip.complete);
      try {
        await wrappedComplete(
          { client_rating: 5 },
          { auth: { uid: partnerID1 } }
        );
        assert(false, "should have failed");
      } catch (e) {
        assert.equal(
          e.message,
          "There is no trip request being handled by the partner 'partnerID1'"
        );
        assert.equal(e.code, "not-found");
      }

      // await admin.database().ref("clients").remove();
    });

    decreasesPartnerAmountOwed = async (
      description,
      farePrice,
      amountOwed,
      expectedDiscountedAmount
    ) => {
      it(description, async () => {
        // add client to the database
        const c = new Client(defaultUID);
        await c.addClient({
          uid: defaultUID,
          rating: "5",
          payment_method: {
            default: "cash",
          },
        });

        // create transaction with farePrice value supposedly to pay the trip
        const transaction = await pagarmeClient.createTransaction(
          creditCard.id,
          farePrice,
          {
            id: creditCard.pagarme_customer_id,
            name: creditCard.holder_name,
          },
          creditCard.billing_address
        );

        // add trip request for client being handled by the partner with id 'partnerID',
        // and being paid with the pending transaction
        const partnerID = "partnerID";
        let defaultTripRequest = {
          uid: defaultUID,
          trip_status: "in-progress",
          origin_place_id: valid_origin_place_id,
          destination_place_id: valid_destination_place_id,
          origin_lat: "11.111111",
          origin_lng: "22.222222",
          destination_lat: "33.333333",
          destination_lng: "44.444444",
          origin_zone: "AA",
          fare_price: farePrice,
          distance_meters: "123",
          distance_text: "123 meters",
          duration_seconds: "300",
          duration_text: "5 minutes",
          encoded_points: "encoded_points",
          request_time: Date.now().toString(),
          origin_address: "origin_address",
          destination_address: "destination_address",
          partner_id: partnerID,
          payment_method: "credit_card",
          credit_card: creditCard,
          transaction_id: transaction.tid.toString(),
        };
        const tripRequestRef = admin
          .database()
          .ref("trip-requests")
          .child(defaultUID);
        await tripRequestRef.set(defaultTripRequest);

        // add a partner to the database supposedly handing the trip for defaultUID
        // owing amountOwed and with a valid pagarme_recipient_id
        await admin.database().ref("partners").remove();
        let defaultPartner = {
          uid: partnerID,
          name: "Fulano",
          last_name: "de Tal",
          cpf: "00000000000",
          gender: "masculino",
          account_status: "approved",
          member_since: Date.now().toString(),
          phone_number: "(38) 99999-9999",
          current_latitude: "-17.217587",
          current_longitude: "-46.881064",
          current_client_uid: defaultUID,
          current_zone: "AA",
          status: "busy",
          vehicle: {
            brand: "honda",
            model: "CG 150",
            year: 2020,
            plate: "HMR 1092",
          },
          idle_since: Date.now().toString(),
          rating: "5.0",
          amount_owed: amountOwed,
          pagarme_recipient_id: "re_cko91zvv600b60i9tv2qvf24o",
        };
        const partnerRef = admin.database().ref("partners").child(partnerID);
        await partnerRef.set(defaultPartner);

        // before completing trip, assert partner owes amountOwed
        const partner = new Partner(partnerID);
        let p = await partner.getPartner();
        assert.isDefined(p);
        assert.equal(p.amount_owed, amountOwed);

        // clear past-trips
        await admin.database().ref("past-trips").remove();

        // partner calls complete trip
        const wrappedComplete = test.wrap(trip.complete);
        await wrappedComplete(
          { client_rating: 5 },
          { auth: { uid: partnerID } }
        );
        await sleep(200);

        // after completing trip, assert partner owes amountOwed - discounted amount
        p = await partner.getPartner();
        assert.isDefined(p);
        assert.equal(p.amount_owed, amountOwed - expectedDiscountedAmount);

        // assert partner's has a past trip
        const ppt = new PartnerPastTrips(partnerID);
        let partnerPastTrips = await ppt.getPastTrips();
        assert.equal(partnerPastTrips.length, 1);
        assert.equal(partnerPastTrips[0].uid, defaultUID);

        // assert payment field has been added to partner's past trip
        assert.isDefined(partnerPastTrips[0].payment);
        assert.equal(partnerPastTrips[0].payment.success, true);
        assert.equal(
          partnerPastTrips[0].payment.venni_commission,
          Math.round(0.2 * farePrice)
        );
        assert.equal(
          partnerPastTrips[0].payment.previous_owed_commission,
          amountOwed
        );
        assert.equal(
          partnerPastTrips[0].payment.paid_owed_commission,
          expectedDiscountedAmount
        );
        assert.equal(
          partnerPastTrips[0].payment.current_owed_commission,
          amountOwed - expectedDiscountedAmount
        );
        assert.equal(
          partnerPastTrips[0].payment.partner_amount_received,
          farePrice - Math.round(0.2 * farePrice) - expectedDiscountedAmount
        );
      });
    };

    decreasesPartnerAmountOwed(
      "decreases partner's amount_owed if pay with credit_card and partner owes more than 80% of fare price",
      521,
      727,
      Math.ceil(0.8 * 521)
    );

    decreasesPartnerAmountOwed(
      "decreases partner's amount_owed if pay with credit_card and partner owes less than 80% of fare price",
      401,
      157,
      157
    );

    decreasesPartnerAmountOwed(
      "doesn't decrease partner's amount_owed if pay with credit_card but partner owes nothing",
      563,
      0,
      0
    );

    it("flags client and doesn't decrease partners amount_owed if pay with credit_card but capture fails", async () => {
      // add client to the database
      const c = new Client(defaultUID);
      await c.addClient({
        uid: defaultUID,
        rating: "5",
        payment_method: {
          default: "cash",
        },
      });

      // add trip request for client being handled by the partner with id 'partnerID',
      // and being paid with an invalid transaction ID so capture fails
      const partnerID = "partnerID";
      const farePrice = 569;
      let defaultTripRequest = {
        uid: defaultUID,
        trip_status: "in-progress",
        origin_place_id: valid_origin_place_id,
        destination_place_id: valid_destination_place_id,
        origin_lat: "11.111111",
        origin_lng: "22.222222",
        destination_lat: "33.333333",
        destination_lng: "44.444444",
        origin_zone: "AA",
        fare_price: farePrice,
        distance_meters: "123",
        distance_text: "123 meters",
        duration_seconds: "300",
        duration_text: "5 minutes",
        encoded_points: "encoded_points",
        request_time: Date.now().toString(),
        origin_address: "origin_address",
        destination_address: "destination_address",
        partner_id: partnerID,
        payment_method: "credit_card",
        credit_card: creditCard,
        transaction_id: "invalid_transactin_id",
      };
      const tripRequestRef = admin
        .database()
        .ref("trip-requests")
        .child(defaultUID);
      await tripRequestRef.set(defaultTripRequest);

      // add a partner to the database supposedly handing the trip for defaultUID
      // owing amountOwed
      let amountOwed = 311;
      let defaultPartner = {
        uid: partnerID,
        name: "Fulano",
        last_name: "de Tal",
        cpf: "00000000000",
        gender: "masculino",
        account_status: "approved",
        member_since: Date.now().toString(),
        phone_number: "(38) 99999-9999",
        current_latitude: "-17.217587",
        current_longitude: "-46.881064",
        current_client_uid: defaultUID,
        current_zone: "AA",
        status: "busy",
        vehicle: {
          brand: "honda",
          model: "CG 150",
          year: 2020,
          plate: "HMR 1092",
        },
        idle_since: Date.now().toString(),
        rating: "5.0",
        amount_owed: amountOwed,
        pagarme_recipient_id: "re_cko91zvv600b60i9tv2qvf24o",
      };
      const partnerRef = admin.database().ref("partners").child(partnerID);
      await partnerRef.set(defaultPartner);

      // before completing trip, assert partner owes amountOwed
      const partner = new Partner(partnerID);
      let p = await partner.getPartner();
      assert.isDefined(p);
      assert.equal(p.amount_owed, amountOwed);

      // before partner completes trip, assert client has no unpaid trips
      let client = await c.getClient();
      assert.isDefined(client);
      assert.isUndefined(client.unpaid_past_trip_id);

      // partner calls complete trip
      const wrappedComplete = test.wrap(trip.complete);
      await wrappedComplete({ client_rating: 5 }, { auth: { uid: partnerID } });
      await sleep(200);

      // after completing trip, assert partner still owes amountOwed
      p = await partner.getPartner();
      assert.isDefined(p);
      assert.equal(p.amount_owed, amountOwed);

      // after partner complets trip, assert client has an unpaid trip
      // oweing farePrice
      client = await c.getClient();
      assert.isDefined(client);
      assert.isDefined(client.unpaid_past_trip_id);
    });

    it("increases partner's amount_owed if pay with cash", async () => {
      // add client to the database
      const c = new Client(defaultUID);
      await c.addClient({
        uid: defaultUID,
        rating: "5",
        payment_method: {
          default: "cash",
        },
      });

      // add trip request for client being handled by the partner with id 'partnerID',
      // and being paid with cash
      const partnerID = "partnerID";
      const farePrice = 631;
      let defaultTripRequest = {
        uid: defaultUID,
        trip_status: "in-progress",
        origin_place_id: valid_origin_place_id,
        destination_place_id: valid_destination_place_id,
        origin_lat: "11.111111",
        origin_lng: "22.222222",
        destination_lat: "33.333333",
        destination_lng: "44.444444",
        origin_zone: "AA",
        fare_price: farePrice,
        distance_meters: "123",
        distance_text: "123 meters",
        duration_seconds: "300",
        duration_text: "5 minutes",
        encoded_points: "encoded_points",
        request_time: Date.now().toString(),
        origin_address: "origin_address",
        destination_address: "destination_address",
        partner_id: partnerID,
        payment_method: "cash",
      };
      const tripRequestRef = admin
        .database()
        .ref("trip-requests")
        .child(defaultUID);
      await tripRequestRef.set(defaultTripRequest);

      // add a partner to the database supposedly handing the trip for defaultUID
      // owing amountOwed
      let amountOwed = 311;
      let defaultPartner = {
        uid: partnerID,
        name: "Fulano",
        last_name: "de Tal",
        cpf: "00000000000",
        gender: "masculino",
        account_status: "approved",
        member_since: Date.now().toString(),
        phone_number: "(38) 99999-9999",
        current_latitude: "-17.217587",
        current_longitude: "-46.881064",
        current_client_uid: defaultUID,
        current_zone: "AA",
        status: "busy",
        vehicle: {
          brand: "honda",
          model: "CG 150",
          year: 2020,
          plate: "HMR 1092",
        },
        idle_since: Date.now().toString(),
        rating: "5.0",
        amount_owed: amountOwed,
        pagarme_recipient_id: "re_cko91zvv600b60i9tv2qvf24o",
      };
      const partnerRef = admin.database().ref("partners").child(partnerID);
      await partnerRef.set(defaultPartner);

      // before completing trip, assert partner owes amountOwed
      const partner = new Partner(partnerID);
      let p = await partner.getPartner();
      assert.isDefined(p);
      assert.equal(p.amount_owed, amountOwed);

      // partner calls complete trip
      const wrappedComplete = test.wrap(trip.complete);
      await wrappedComplete({ client_rating: 5 }, { auth: { uid: partnerID } });
      await sleep(200);

      // after completing trip, assert partner owes amountOwed + 20% of farePrice
      p = await partner.getPartner();
      assert.isDefined(p);
      assert.equal(p.amount_owed, amountOwed + Math.ceil(0.2 * farePrice));
    });

    it("fails when trying to complete a trip with status different from in-progress", async () => {
      const partnerID1 = "partnerID1";

      // add client entry to the database
      const clientRef = admin.database().ref("clients").child(defaultUID);
      await clientRef.set({
        uid: defaultUID,
        rating: "5",
      });

      // add trip request for defaultUID with status different from in-progress
      await createTripRequest("waiting-partner");

      // add a partner to the database supposedly handing the trip for defaultUID
      let defaultPartner = {
        uid: partnerID1,
        name: "Fulano",
        last_name: "de Tal",
        cpf: "00000000000",
        gender: "masculino",
        account_status: "approved",
        member_since: Date.now().toString(),
        phone_number: "(38) 99999-9999",
        current_latitude: "-17.217587",
        current_longitude: "-46.881064",
        current_client_uid: defaultUID,
        current_zone: "AA",
        status: "busy",
        vehicle: {
          brand: "honda",
          model: "CG 150",
          year: 2020,
          plate: "HMR 1092",
        },
        idle_since: Date.now().toString(),
        rating: "5.0",
      };
      await admin
        .database()
        .ref("partners")
        .child(partnerID1)
        .set(defaultPartner);

      // fail if partner tries completing the trip without in-progress status
      const wrappedComplete = test.wrap(trip.complete);
      try {
        await wrappedComplete(
          { client_rating: 5 },
          { auth: { uid: partnerID1 } }
        );
        assert(false, "should have failed");
      } catch (e) {
        assert.equal(e.code, "failed-precondition");
        assert.equal(
          e.message,
          "cannot complete trip in status 'waiting-partner'"
        );
      }
    });

    it("fails when trying to complete a trip for which the partner was not chosen", async () => {
      const partnerID1 = "partnerID1";

      // add client entry to the database
      const clientRef = admin.database().ref("clients").child(defaultUID);
      await clientRef.set({
        uid: defaultUID,
        rating: "5",
      });

      // add trip request for clientID being handled by a different partner
      await createTripRequest("in-progress");

      // add a partner to the database supposedly handing the trip for clientID
      let defaultPartner = {
        uid: partnerID1,
        name: "Fulano",
        last_name: "de Tal",
        cpf: "00000000000",
        gender: "masculino",
        account_status: "approved",
        member_since: Date.now().toString(),
        phone_number: "(38) 99999-9999",
        current_latitude: "-17.217587",
        current_longitude: "-46.881064",
        current_client_uid: defaultUID,
        current_zone: "AA",
        status: "busy",
        vehicle: {
          brand: "honda",
          model: "CG 150",
          year: 2020,
          plate: "HMR 1092",
        },
        idle_since: Date.now().toString(),
        rating: "5.0",
      };
      await admin
        .database()
        .ref("partners")
        .child(partnerID1)
        .set(defaultPartner);

      // fail if partner tries completing the trip being handled by a different partner
      const wrappedComplete = test.wrap(trip.complete);
      try {
        await wrappedComplete(
          { client_rating: 5 },
          { auth: { uid: partnerID1 } }
        );
        assert(false, "should have failed");
      } catch (e) {
        assert.equal(e.code, "failed-precondition");
        assert.equal(e.message, "partner has not been designated to this trip");
      }
    });

    it("succesfully updates partner's and client's data on success", async () => {
      // clear past-trips
      await admin.database().ref("past-trips").remove();

      const partnerID1 = "partnerID1";

      // add client entry to the database
      const clientRef = admin.database().ref("clients").child(defaultUID);
      await clientRef.set({
        uid: defaultUID,
        payment_method: {
          default: "cash",
        },
        rating: "0",
      });

      // add trip request for defaultUID being handled by the partner
      let defaultTripRequest = {
        uid: defaultUID,
        trip_status: "in-progress",
        origin_place_id: valid_origin_place_id,
        destination_place_id: valid_destination_place_id,
        origin_lat: "11.111111",
        origin_lng: "22.222222",
        destination_lat: "33.333333",
        destination_lng: "44.444444",
        origin_zone: "AA",
        fare_price: 500,
        distance_meters: "123",
        distance_text: "123 meters",
        duration_seconds: "300",
        duration_text: "5 minutes",
        encoded_points: "encoded_points",
        request_time: Date.now().toString(),
        origin_address: "origin_address",
        destination_address: "destination_address",
        partner_id: partnerID1,
      };

      const tripRequestRef = admin
        .database()
        .ref("trip-requests")
        .child(defaultUID);

      await tripRequestRef.set(defaultTripRequest);

      // add a partner to the database supposedly handing the trip for defaultUID
      const initialIdleSince = Date.now().toString();
      let defaultPartner = {
        uid: partnerID1,
        name: "Fulano",
        last_name: "de Tal",
        cpf: "00000000000",
        gender: "masculino",
        account_status: "approved",
        member_since: Date.now().toString(),
        phone_number: "(38) 99999-9999",
        current_latitude: "-17.217587",
        current_longitude: "-46.881064",
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
        rating: "5.0",
      };
      const partnerRef = admin.database().ref("partners").child(partnerID1);
      await partnerRef.set(defaultPartner);

      // before completing trip, assert the partner is busy
      let partnerSnapshot = await partnerRef.once("value");
      assert.isNotNull(partnerSnapshot.val());
      assert.equal(partnerSnapshot.val().status, "busy");
      assert.equal(partnerSnapshot.val().current_client_uid, defaultUID);
      assert.equal(partnerSnapshot.val().idle_since, initialIdleSince);

      // brefore completing trip, assert partner's has no past trips
      let ppt = new PartnerPastTrips(partnerID1);
      let partnerPastTrips = await ppt.getPastTrips();
      assert.isEmpty(partnerPastTrips);

      // before partner completes trip, assert client has not been updated
      let clientSnapshot = await clientRef.once("value");
      assert.isNotNull(clientSnapshot.val());
      assert.equal(clientSnapshot.val().rating, "0");
      assert.equal(clientSnapshot.val().uid, defaultUID);

      // before partner complets trip, assert client has no past_trips
      let cpt = new ClientPastTrips(defaultUID);
      let clientPastTrips = await cpt.getPastTrips();
      assert.isEmpty(clientPastTrips);

      // complete trip
      let clientRating = 5;
      const wrappedComplete = test.wrap(trip.complete);
      await wrappedComplete(
        { client_rating: clientRating },
        { auth: { uid: partnerID1 } }
      );
      await sleep(200);

      // assert the partner has been set available
      partnerSnapshot = await partnerRef.once("value");
      assert.isNotNull(partnerSnapshot.val());
      assert.equal(partnerSnapshot.val().status, "available");
      assert.equal(partnerSnapshot.val().current_client_uid, "");
      assert.isAbove(
        Number(partnerSnapshot.val().idle_since),
        Number(initialIdleSince)
      );

      // assert partner's has a past trip
      partnerPastTrips = await ppt.getPastTrips();
      assert.equal(partnerPastTrips.length, 1);
      assert.equal(partnerPastTrips[0].uid, defaultUID);
      assert.equal(partnerSnapshot.val().total_trips, "1");

      // assert that past trip has not payment field, since it was a credit card payment
      assert.isUndefined(partnerPastTrips[0].payment);

      // assert client has been updated
      clientSnapshot = await clientRef.once("value");
      assert.isNotNull(clientSnapshot.val());
      assert.equal(clientSnapshot.val().rating, "5.00");
      assert.equal(clientSnapshot.val().uid, defaultUID);

      // assert client has one past trip with client_rating and partner_past_trip_ref_key
      clientPastTrips = await cpt.getPastTrips();
      assert.equal(clientPastTrips.length, 1);
      assert.equal(clientPastTrips[0].uid, defaultUID);
      assert.equal(clientPastTrips[0].client_rating, "5.00");
      assert.isDefined(clientPastTrips[0].partner_past_trip_ref_key);

      // assert a reference key has been added to the trip request.
      let tripSnapshot = await tripRequestRef.once("value");
      assert.isNotNull(tripSnapshot.val());
      assert.isDefined(tripSnapshot.val().partner_past_trip_ref_key);
    });
  });

  describe("ratePartner", () => {
    const genericTest = async (
      data,
      expectedCode,
      expectedMessage,
      ctx = defaultCtx,
      succeeed = false
    ) => {
      const wrapped = test.wrap(trip.rate_partner);
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
      await admin.database().ref("partners").remove();
      await admin.database().ref("clients").remove();
    });

    it("fails if user is not authenticated", async () => {
      // run generic test without context
      await genericTest(
        {},
        "failed-precondition",
        "Missing authentication credentials.",
        {}
      );
    });

    it("fails if argument score is not be present", async () => {
      await genericTest(
        { partner_id: "partner_id" },
        "invalid-argument",
        "missing expected argument 'score'."
      );
    });

    it("fails if argument score is not a number", async () => {
      await genericTest(
        { score: "not a number", partner_id: "partner_id" },
        "invalid-argument",
        "argument 'score' has invalid type. Expected 'number'. Received 'string'."
      );
    });

    it("fails if argument partner_id is not present", async () => {
      await genericTest(
        { score: 1 },
        "invalid-argument",
        "missing expected argument 'partner_id'."
      );
    });

    it("fails if argument partner_id is not a string", async () => {
      await genericTest(
        { score: 1, partner_id: {} },
        "invalid-argument",
        "argument 'partner_id' has invalid type. Expected 'string'. Received 'object'."
      );
    });

    it("fails if argument score is not a number between 0 and 5", async () => {
      await genericTest(
        { score: -1, partner_id: "partner_id" },
        "invalid-argument",
        "argument 'score' must be a number between 0 and 5."
      );
      await genericTest(
        { score: 6, partner_id: "partner_id" },
        "invalid-argument",
        "argument 'score' must be a number between 0 and 5."
      );
    });

    it("fails if argument cleanliness_went_well, if present, is not a boolean", async () => {
      await genericTest(
        {
          score: 1,
          partner_id: "partner_id",
          cleanliness_went_well: "not an boolean",
        },
        "invalid-argument",
        "argument 'cleanliness_went_well' has invalid type. Expected 'boolean'. Received 'string'."
      );
    });
    it("fails if argument safety_went_well, if present, is not a boolean", async () => {
      await genericTest(
        {
          score: 1,
          partner_id: "partner_id",
          safety_went_well: "not an boolean",
        },
        "invalid-argument",
        "argument 'safety_went_well' has invalid type. Expected 'boolean'. Received 'string'."
      );
    });
    it("fails if argument waiting_time_went_well, if present, is not a boolean", async () => {
      await genericTest(
        {
          score: 1,
          partner_id: "partner_id",
          waiting_time_went_well: "not an boolean",
        },
        "invalid-argument",
        "argument 'waiting_time_went_well' has invalid type. Expected 'boolean'. Received 'string'."
      );
    });
    it("fails if argument feedback, if present, is not a boolean", async () => {
      await genericTest(
        {
          score: 1,
          partner_id: "partner_id",
          feedback: 1,
        },
        "invalid-argument",
        "argument 'feedback' has invalid type. Expected 'string'. Received 'number'."
      );
    });

    it("fails if trip being does not exist", async () => {
      // remove all trip requests
      await admin.database().ref("trip-requests").remove();

      await genericTest(
        {
          score: 1,
          partner_id: "partner_id",
        },
        "failed-precondition",
        "could not find a trip request for client with id 'defaultUID'"
      );
    });

    it("fails if trip does not have 'completed' status", async () => {
      // create trip request with 'waiting-confirmation' status
      await createTripRequest();

      await genericTest(
        {
          score: 1,
          partner_id: "partner_id",
        },
        "failed-precondition",
        "could not find a trip request with 'completed' status for client with id 'defaultUID'"
      );

      // clear database
      await admin.database().ref("trip-requests").remove();
    });

    it("fails if trip's  'partner_id' does not correspond to id of partner being rated", async () => {
      // create trip request with 'completed' status and invalid partner id
      await createTripRequest("completed", "invalidPartnerID");

      await genericTest(
        {
          score: 1,
          partner_id: "partner_id",
        },
        "failed-precondition",
        "could not find a trip request handled by a partner with id 'partner_id' for client with id 'defaultUID'"
      );

      // clear database
      await admin.database().ref("trip-requests").remove();
    });

    it("fails if trip's 'partner_past_trip_ref_key' is not be set", async () => {
      // create trip request with 'completed' status and valid partner id
      await createTripRequest("completed", "partner_id");

      await genericTest(
        {
          score: 1,
          partner_id: "partner_id",
        },
        "failed-precondition",
        "trip request has undefined field 'partner_past_trip_ref_key'"
      );

      // clear database
      await admin.database().ref("trip-requests").remove();
    });

    const createValidTripRequest = async (refKey = "refKey") => {
      let defaultTripRequest = {
        uid: defaultUID,
        trip_status: "completed",
        origin_place_id: valid_origin_place_id,
        destination_place_id: valid_destination_place_id,
        origin_lat: "11.111111",
        origin_lng: "22.222222",
        destination_lat: "33.333333",
        destination_lng: "44.444444",
        origin_zone: "AA",
        fare_price: 500,
        distance_meters: "123",
        distance_text: "123 meters",
        duration_seconds: "300",
        duration_text: "5 minutes",
        encoded_points: "encoded_points",
        request_time: Date.now().toString(),
        origin_address: "origin_address",
        destination_address: "destination_address",
        partner_id: "partner_id",
        partner_past_trip_ref_key: refKey,
      };

      let tripRequestRef = admin
        .database()
        .ref("trip-requests")
        .child(defaultUID);

      await tripRequestRef.set(defaultTripRequest);
      return tripRequestRef;
    };

    it("fails if partner being rated does not exist", async () => {
      await createValidTripRequest();

      // make sure partner doesn't exist
      await admin.database().ref("partners").remove();

      await genericTest(
        {
          score: 1,
          partner_id: "partner_id",
        },
        "failed-precondition",
        "could not find a partner wiht id id 'partner_id'"
      );

      // clear database
      await admin.database().ref("trip-requests").remove();
    });

    it("updates partner's past trips if succeeds", async () => {
      // clear database
      await admin.database().ref("trip-requests").remove();
      await admin.database().ref("past-trips").remove();
      await admin.database().ref("partners").remove();

      // create a partner
      const partnerID = "partner_id";
      let defaultPartner = {
        uid: partnerID,
        name: "Fulano",
        last_name: "de Tal",
        cpf: "00000000000",
        gender: "masculino",
        account_status: "approved",
        phone_number: "(38) 99999-9999",
        member_since: Date.now().toString(),
        current_latitude: "-17.217587",
        current_longitude: "-46.881064",
        current_zone: "AA",
        status: "available",
        vehicle: {
          brand: "honda",
          model: "CG 150",
          year: 2020,
          plate: "HMR 1092",
        },
        idle_since: Date.now().toString(),
        rating: "5.0",
      };
      const partnerRef = admin.database().ref("partners").child(partnerID);
      await partnerRef.set(defaultPartner);

      // pretend the partner has a past trip
      const ppt = new PartnerPastTrips(partnerID);
      let defaultTrip = {
        uid: defaultUID,
        trip_status: "completed",
        origin_place_id: valid_origin_place_id,
        destination_place_id: valid_destination_place_id,
        origin_lat: "11.111111",
        origin_lng: "22.222222",
        destination_lat: "33.333333",
        destination_lng: "44.444444",
        origin_zone: "AA",
        fare_price: 500,
        distance_meters: "123",
        distance_text: "123 meters",
        duration_seconds: "300",
        duration_text: "5 minutes",
        encoded_points: "encoded_points",
        request_time: Date.now().toString(),
        origin_address: "origin_address",
        destination_address: "destination_address",
        partner_id: partnerID,
      };

      let pastTripRefKey = await ppt.pushPastTrip(defaultTrip);
      await createValidTripRequest(pastTripRefKey);

      // assert partner's past trip has not been rated
      let pastTrips = await ppt.getPastTrips();
      assert.equal(pastTrips.length, 1);
      assert.equal(pastTrips[0].rating, undefined);

      // rate the partner
      await genericTest(
        {
          score: 2,
          partner_id: partnerID,
          cleanliness_went_well: true,
          safety_went_well: false,
          feedback: "the partner is great!",
        },
        undefined,
        "",
        defaultCtx,
        true
      );

      // expect past trip to have been updated
      pastTrips = await ppt.getPastTrips();
      assert.equal(pastTrips.length, 1);
      assert.isDefined(pastTrips[0].partner_rating);
      assert.equal(pastTrips[0].partner_rating.score, "2");
      assert.equal(pastTrips[0].partner_rating.cleanliness_went_well, true);
      assert.equal(pastTrips[0].partner_rating.safety_went_well, false);
      assert.equal(
        pastTrips[0].partner_rating.waiting_time_went_well,
        undefined
      );
      assert.equal(
        pastTrips[0].partner_rating.feedback,
        "the partner is great!"
      );

      // assert trip request has been deleted
      let tripSnapshot = await admin
        .database()
        .ref("trip-requests")
        .child(defaultUID)
        .once("value");
      assert.isNull(tripSnapshot.val());

      // clear database
      await admin.database().ref("trip-requests").remove();
      await admin.database().ref("past-trips").remove();
      await admin.database().ref("partners").remove();
    });

    it("works when integrated", async () => {
      const partnerID1 = "partnerID1";

      //  add client entry to the database
      await admin
        .database()
        .ref("clients")
        .child(defaultUID)
        .set({
          uid: defaultUID,
          payment_method: {
            default: "cash",
          },
          rating: "2",
        });

      // add an available partner to the database
      await admin.database().ref("partners").remove();
      let defaultPartner = {
        uid: "",
        name: "Fulano",
        last_name: "de Tal",
        cpf: "00000000000",
        gender: "masculino",
        account_status: "approved",
        member_since: Date.now().toString(),
        phone_number: "(38) 99999-9999",
        current_latitude: "-17.217587",
        current_longitude: "-46.881064",
        current_zone: "AA",
        status: "available",
        vehicle: {
          brand: "honda",
          model: "CG 150",
          year: 2020,
          plate: "HMR 1092",
        },
        idle_since: Date.now().toString(),
        rating: "5.0",
      };
      defaultPartner.uid = partnerID1;
      await admin
        .database()
        .ref("partners")
        .child(partnerID1)
        .set(defaultPartner);

      // add trip request to database
      const tripRequestRef = await createTripRequest();

      // user confirms trip
      const wrappedConfirm = test.wrap(trip.confirm);
      wrappedConfirm({}, { auth: { uid: defaultUID } });

      // wait enough for confirm to send out request to partner
      await sleep(2000);

      // partner accepts the trip
      const wrappedAccept = test.wrap(trip.accept);
      await wrappedAccept({}, { auth: { uid: partnerID1 } });

      // partner starts the trip
      const wrappedStart = test.wrap(trip.start);
      await wrappedStart(
        { client_id: defaultUID },
        { auth: { uid: partnerID1 } }
      );

      // await for trip status to be set
      await sleep(200);

      // assert partner has no past trips before completing trip
      const ppt = new PartnerPastTrips(partnerID1);
      let pastTrips = await ppt.getPastTrips();
      assert.isEmpty(pastTrips);

      // partner completes the trip
      const wrappedComplete = test.wrap(trip.complete);
      await wrappedComplete(
        { client_rating: 5 },
        { auth: { uid: partnerID1 } }
      );
      await sleep(200);

      // assert partner's past trip has not been rated
      pastTrips = await ppt.getPastTrips();
      assert.equal(pastTrips.length, 1);
      assert.equal(pastTrips[0].rating, undefined);

      // client rates the trip
      const wrappedRatePartner = test.wrap(trip.rate_partner);
      await wrappedRatePartner(
        { score: 5, partner_id: partnerID1, cleanliness_went_well: true },
        defaultCtx
      );

      // expect past trip to have been updated
      pastTrips = await ppt.getPastTrips();
      assert.isDefined(pastTrips[0].partner_rating);
      assert.equal(pastTrips[0].partner_rating.score, "5");
      assert.equal(pastTrips[0].partner_rating.cleanliness_went_well, true);
      assert.equal(pastTrips[0].partner_rating.safety_went_well, undefined);
      assert.equal(
        pastTrips[0].partner_rating.waiting_time_went_well,
        undefined
      );
      assert.equal(pastTrips[0].partner_rating.feedback, undefined);
    });
  });

  describe("clientGetPastTrips", () => {
    const genericTest = async (
      data,
      expectedCode,
      expectedMessage,
      ctx = defaultCtx,
      succeeed = false
    ) => {
      const wrapped = test.wrap(trip.client_get_past_trips);
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
      await admin.database().ref("partners").remove();
      await admin.database().ref("clients").remove();
      await admin.database().ref("past-trips").remove();
    });

    it("fails if user is not authenticated", async () => {
      // run generic test without context
      await genericTest(
        {},
        "failed-precondition",
        "Missing authentication credentials.",
        {}
      );
    });

    it("fails if argument 'page_size' is not greater than 0", async () => {
      await genericTest(
        { page_size: 0 },
        "invalid-argument",
        "argument 'page_size' must greater than 0."
      );

      await genericTest(
        { page_size: -1 },
        "invalid-argument",
        "argument 'page_size' must greater than 0."
      );
    });

    it("fails if argument 'max_request_time' is not greater than 0", async () => {
      await genericTest(
        { max_request_time: 0 },
        "invalid-argument",
        "argument 'max_request_time' must greater than 0."
      );

      await genericTest(
        { max_request_time: -1 },
        "invalid-argument",
        "argument 'max_request_time' must greater than 0."
      );
    });

    it("returns list of client's past trips", async () => {
      // clear database
      await admin.database().ref("past-trips").remove();

      // populate database with client's past trips
      const cpt = new ClientPastTrips(defaultUID);
      let pastTrip = {
        uid: defaultUID,
        trip_status: "completed",
        origin_place_id: valid_origin_place_id,
        destination_place_id: valid_destination_place_id,
        origin_lat: "11.111111",
        origin_lng: "22.222222",
        destination_lat: "33.333333",
        destination_lng: "44.444444",
        origin_zone: "AA",
        fare_price: 500,
        distance_meters: "123",
        distance_text: "123 meters",
        duration_seconds: "300",
        duration_text: "5 minutes",
        encoded_points: "encoded_points",
        request_time: Date.now().toString(),
        origin_address: "origin_address",
        destination_address: "destination_address",
        partner_id: "partnerID",
      };
      let now = Date.now();
      for (var i = 0; i < 3; i++) {
        pastTrip.request_time = (now + i * 10000).toString();
        await cpt.pushPastTrip(pastTrip);
      }

      const wrapped = test.wrap(trip.client_get_past_trips);

      // request all client's past trips
      let pastTrips = await wrapped({}, defaultCtx);

      // expect client_get_past_trip to return 3 trips
      assert.isNotEmpty(pastTrips);
      assert.equal(pastTrips.length, 3);

      // request client's most recent trip
      pastTrips = await wrapped({ page_size: 1 }, defaultCtx);

      // expect client_get_past_trip to return 3 trips
      assert.isNotEmpty(pastTrips);
      assert.equal(pastTrips.length, 1);

      // request client's most remote trip
      pastTrips = await wrapped({ max_request_time: now }, defaultCtx);

      // expect client_get_past_trip to return 3 trips
      assert.isNotEmpty(pastTrips);
      assert.equal(pastTrips.length, 1);

      // request client's past trips before very first trip
      pastTrips = await wrapped({ max_request_time: now - 1 }, defaultCtx);

      // expect client_get_past_trip to return nothing
      assert.isEmpty(pastTrips);
    });
  });

  describe("partnerGetPastTrips", () => {
    const genericTest = async (
      data,
      expectedCode,
      expectedMessage,
      ctx = defaultCtx,
      succeeed = false
    ) => {
      const wrapped = test.wrap(trip.partner_get_past_trips);
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
      await admin.database().ref("partners").remove();
      await admin.database().ref("clients").remove();
      await admin.database().ref("past-trips").remove();
    });

    it("fails if user is not authenticated", async () => {
      // run generic test without context
      await genericTest(
        {},
        "failed-precondition",
        "Missing authentication credentials.",
        {}
      );
    });

    it("fails if argument 'page_size' is not greater than 0", async () => {
      await genericTest(
        { page_size: 0 },
        "invalid-argument",
        "argument 'page_size' must greater than 0."
      );

      await genericTest(
        { page_size: -1 },
        "invalid-argument",
        "argument 'page_size' must greater than 0."
      );
    });

    it("fails if argument 'max_request_time' is not greater than 0", async () => {
      await genericTest(
        { max_request_time: 0 },
        "invalid-argument",
        "argument 'max_request_time' must greater than 0."
      );

      await genericTest(
        { max_request_time: -1 },
        "invalid-argument",
        "argument 'max_request_time' must greater than 0."
      );
    });

    it("fails if argument 'min_request_time' is not greater than 0", async () => {
      await genericTest(
        { min_request_time: 0 },
        "invalid-argument",
        "argument 'min_request_time' must greater than 0."
      );

      await genericTest(
        { min_request_time: -1 },
        "invalid-argument",
        "argument 'min_request_time' must greater than 0."
      );
    });

    it("returns list of partner's past trips", async () => {
      // clear database
      await admin.database().ref("past-trips").remove();

      // populate database with client's past trips
      const ppt = new PartnerPastTrips(defaultUID);
      let pastTrip = {
        uid: defaultUID,
        trip_status: "completed",
        origin_place_id: valid_origin_place_id,
        destination_place_id: valid_destination_place_id,
        origin_lat: "11.111111",
        origin_lng: "22.222222",
        destination_lat: "33.333333",
        destination_lng: "44.444444",
        origin_zone: "AA",
        fare_price: 500,
        distance_meters: "123",
        distance_text: "123 meters",
        duration_seconds: "300",
        duration_text: "5 minutes",
        encoded_points: "encoded_points",
        request_time: Date.now().toString(),
        origin_address: "origin_address",
        destination_address: "destination_address",
        partner_id: "partnerID",
      };
      let now = Date.now();
      for (var i = 0; i < 3; i++) {
        pastTrip.request_time = (now + i * 10000).toString();
        await ppt.pushPastTrip(pastTrip);
      }

      const wrapped = test.wrap(trip.partner_get_past_trips);

      // request all partner's past trips
      let pastTrips = await wrapped({}, defaultCtx);

      // expect partner_get_past_trip to return 3 trips
      assert.isNotEmpty(pastTrips);
      assert.equal(pastTrips.length, 3);

      // request partner's most recent trip
      pastTrips = await wrapped({ page_size: 1 }, defaultCtx);

      // expect partner_get_past_trip to return 1 trip1
      assert.isNotEmpty(pastTrips);
      assert.equal(pastTrips.length, 1);
      assert.equal(pastTrips[0].request_time, now + 20000);

      // request partner's least recent trip
      pastTrips = await wrapped({ max_request_time: now }, defaultCtx);

      // expect partner_get_past_trip to return 1 trips
      assert.isNotEmpty(pastTrips);
      assert.equal(pastTrips.length, 1);
      assert.equal(pastTrips[0].request_time, now);

      // request partner's most recent trip
      pastTrips = await wrapped({ min_request_time: now + 20000 }, defaultCtx);

      // expect partner_get_past_trip to return 1 trips
      assert.isNotEmpty(pastTrips);
      assert.equal(pastTrips.length, 1);

      // request partner's past trips before very first trip
      pastTrips = await wrapped({ max_request_time: now - 1 }, defaultCtx);

      // expect partner_get_past_trip to return nothing
      assert.isEmpty(pastTrips);
    });
  });

  describe("clientGetPastTrip", () => {
    const genericTest = async (
      data,
      expectedCode,
      expectedMessage,
      ctx = defaultCtx,
      succeeed = false
    ) => {
      const wrapped = test.wrap(trip.client_get_past_trip);
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
      await admin.database().ref("partners").remove();
      await admin.database().ref("clients").remove();
      await admin.database().ref("past-trips").remove();
    });

    it("fails if user is not authenticated", async () => {
      // run generic test without context
      await genericTest(
        { past_trip_id: "past_trip_id" },
        "failed-precondition",
        "Missing authentication credentials.",
        {}
      );
    });

    it("fails if argument 'past_trip_id' is missing", async () => {
      await genericTest(
        {},
        "invalid-argument",
        "missing expected argument 'past_trip_id'."
      );
    });

    it("fails if argument 'past_trip_id' is not a string", async () => {
      await genericTest(
        { past_trip_id: 123 },
        "invalid-argument",
        "argument 'past_trip_id' has invalid type. Expected 'string'. Received 'number'."
      );
    });

    it("returns 'undefined' if specified past trip doesn't exist", async () => {
      // clear database
      await admin.database().ref("past-trips").remove();

      const wrapped = test.wrap(trip.client_get_past_trip);

      // request inexistent past trip
      let pastTrip = await wrapped(
        { past_trip_id: "past_trip_id" },
        defaultCtx
      );
      assert.isUndefined(pastTrip);
    });

    it("returns a past trip if specified past trip exists", async () => {
      // clear database
      await admin.database().ref("past-trips").remove();

      // populate database with client's past trips
      const cpt = new ClientPastTrips(defaultUID);
      let pastTrip = {
        uid: defaultUID,
        trip_status: "completed",
        origin_place_id: valid_origin_place_id,
        destination_place_id: valid_destination_place_id,
        origin_lat: "11.111111",
        origin_lng: "22.222222",
        destination_lat: "33.333333",
        destination_lng: "44.444444",
        origin_zone: "AA",
        fare_price: 500,
        distance_meters: "123",
        distance_text: "123 meters",
        duration_seconds: "300",
        duration_text: "5 minutes",
        encoded_points: "encoded_points",
        request_time: Date.now().toString(),
        origin_address: "origin_address",
        destination_address: "destination_address",
        partner_id: "partnerID",
      };
      let pastTripID = await cpt.pushPastTrip(pastTrip);

      const wrapped = test.wrap(trip.client_get_past_trip);

      // request all client's past trips
      let result = await wrapped({ past_trip_id: pastTripID }, defaultCtx);

      // expect client_get_past_trip to return 3 trips
      assert.isDefined(result);
      assert.equal(result.uid, defaultUID);
    });
  });

  describe("partnerGetTripRating", () => {
    const genericTest = async (
      data,
      expectedCode,
      expectedMessage,
      ctx = defaultCtx,
      succeeed = false
    ) => {
      const wrapped = test.wrap(trip.partner_get_trip_rating);
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
      await admin.database().ref("partners").remove();
      await admin.database().ref("clients").remove();
      await admin.database().ref("past-trips").remove();
    });

    it("fails if user is not authenticated", async () => {
      // run generic test without context
      await genericTest(
        {},
        "failed-precondition",
        "Missing authentication credentials.",
        {}
      );
    });

    it("fails if argument 'partner_id' is not present", async () => {
      await genericTest(
        { past_trip_ref_key: "past_trip_ref_key" },
        "invalid-argument",
        "missing expected argument 'partner_id'."
      );
    });

    it("fails if argument 'past_trip_ref_key' is not present", async () => {
      await genericTest(
        { partner_id: "partner_id" },
        "invalid-argument",
        "missing expected argument 'past_trip_ref_key'."
      );
    });

    it("returns undefined to unrated trips", async () => {
      // clear database
      await admin.database().ref("past-trips").remove();

      // populate database with partner past trip without rating
      const partnerID = "partnerID";
      const ppt = new PartnerPastTrips(partnerID);

      let pastTrip = {
        uid: defaultUID,
        trip_status: "completed",
        origin_place_id: valid_origin_place_id,
        destination_place_id: valid_destination_place_id,
        origin_zone: "AA",
        fare_price: 500,
        distance_meters: "123",
        distance_text: "123 meters",
        duration_seconds: "300",
        duration_text: "5 minutes",
        encoded_points: "encoded_points",
        request_time: Date.now().toString(),
        origin_address: "origin_address",
        destination_address: "destination_address",
        partner_id: partnerID,
      };

      const refKey = await ppt.pushPastTrip(pastTrip);

      const wrapped = test.wrap(trip.partner_get_trip_rating);

      // request all client's past trips
      let result = await wrapped(
        { partner_id: partnerID, past_trip_ref_key: refKey },
        defaultCtx
      );
      assert.isUndefined(result);
    });

    it("returns a rating of the partner", async () => {
      // clear database
      await admin.database().ref("past-trips").remove();

      // populate database with partner past trip with rating 4.
      const partnerID = "partnerID";
      const ppt = new PartnerPastTrips(partnerID);
      let pastTrip = {
        uid: defaultUID,
        trip_status: "completed",
        origin_place_id: valid_origin_place_id,
        destination_place_id: valid_destination_place_id,
        origin_lat: "11.111111",
        origin_lng: "22.222222",
        destination_lat: "33.333333",
        destination_lng: "44.444444",
        origin_zone: "AA",
        fare_price: 500,
        distance_meters: "123",
        distance_text: "123 meters",
        duration_seconds: "300",
        duration_text: "5 minutes",
        encoded_points: "encoded_points",
        request_time: Date.now().toString(),
        origin_address: "origin_address",
        destination_address: "destination_address",
        partner_id: partnerID,
        partner_rating: {
          score: "4.00",
        },
      };
      const refKey = await ppt.pushPastTrip(pastTrip);

      const wrapped = test.wrap(trip.partner_get_trip_rating);

      // request all client's past trips
      let result = await wrapped(
        { partner_id: partnerID, past_trip_ref_key: refKey },
        defaultCtx
      );

      assert.isDefined(result);
      assert.equal(result.partner_rating, "4.00");
    });
  });

  describe("partnerGetCurrentTrip", () => {
    const genericTest = async (
      data,
      expectedCode,
      expectedMessage,
      ctx = defaultCtx,
      succeeed = false
    ) => {
      const wrapped = test.wrap(trip.partner_get_current_trip);
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
      // clear database
      await admin.database().ref("trip-requests").remove();
      await admin.database().ref("partners").remove();
      // clear authentication
      await admin.auth().deleteUser(defaultUID);
    });

    let defaultPartner;

    beforeEach(() => {
      defaultPartner = {
        uid: defaultUID,
        name: "Fulano",
        last_name: "de Tal",
        cpf: "00000000000",
        gender: "masculino",
        account_status: "approved",
        phone_number: "(38) 99999-9999",
        member_since: Date.now().toString(),
        current_latitude: "-17.217587",
        current_longitude: "-46.881064",
        current_zone: "AA",
        status: "available",
        vehicle: {
          brand: "honda",
          model: "CG 150",
          year: 2020,
          plate: "HMR 1092",
        },
        idle_since: Date.now().toString(),
        rating: "5.0",
      };
    });

    it("fails if user is not authenticated", async () => {
      // run generic test without context
      await genericTest(
        {},
        "failed-precondition",
        "Missing authentication credentials.",
        {}
      );
    });

    it("throws 'nof-found' if partner does not exist", async () => {
      await genericTest(
        {},
        "not-found",
        "Could not find partner with uid defaultUID"
      );
    });

    it("throws 'failed-precondition' if is neither 'requested' nor 'busy'", async () => {
      // add partner do the database with 'available' status
      const partnerRef = admin.database().ref("partners").child(defaultUID);
      await partnerRef.set(defaultPartner);

      // assert that function fails
      await genericTest(
        {},
        "failed-precondition",
        "The partner with uid defaultUID does not have any current trip requests"
      );
    });

    it("throws 'failed-precondition' if 'current_client_uid' is not set", async () => {
      // add partner do the database without 'current_client_uid' field
      const partnerRef = admin.database().ref("partners").child(defaultUID);
      defaultPartner["status"] = "requested";
      await partnerRef.set(defaultPartner);

      // assert that function fails
      await genericTest(
        {},
        "failed-precondition",
        "The partner with uid defaultUID does not have any current trip requests"
      );
    });

    it("throws 'not-found' if can't find trip for client specified in 'current_client_id'", async () => {
      // add partner do the database with 'current_client_uid' specifying client with inexisting trip
      const partnerRef = admin.database().ref("partners").child(defaultUID);
      defaultPartner["status"] = "requested";
      defaultPartner["current_client_uid"] = defaultUID;
      await partnerRef.set(defaultPartner);

      // assert that function fails
      await genericTest(
        {},
        "not-found",
        "Could not find the current trip of the partner with uid defaultUID"
      );
    });

    it("throws 'not-found' if can't find client who requested the trip", async () => {
      // the partner we added in the previous test is valid for this test case

      // add tripRequest for client with uid defaultUID and being handled
      // by a partner with uid defaultUID
      await createTripRequest("waiting-partner", defaultUID);

      // assert that function fails
      await genericTest(
        {},
        "not-found",
        "Could not find the client who requested the trip of the partner with uid defaultUID"
      );
    });

    it("works", async () => {
      // the partner we added in the previous test is valid for this test case
      // add tripRequest we added in the previous test case is valid for this test case

      // add user to firebase authentication
      await admin.auth().createUser({ uid: defaultUID });

      // add a name to the user
      await admin.auth().updateUser(defaultUID, {
        displayName: "Fulano de Tal",
        phoneNumber: "+5538123456789",
      });

      // send getCurrentTrip request
      const getCurrentTrip = test.wrap(trip.partner_get_current_trip);
      const response = await getCurrentTrip({}, defaultCtx);

      assert.isDefined(response);
      assert.equal(response.uid, defaultUID);
      assert.equal(response.client_name, "Fulano de Tal");
      assert.equal(response.client_phone, "+5538123456789");
    });
  });
});
