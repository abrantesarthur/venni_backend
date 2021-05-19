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
const { expect } = require("chai");
const { Client } = require("../lib/database/client");
const { Pilot } = require("../lib/database/pilot");
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
      pilotID = ""
    ) => {
      let defaultTripRequest = {
        uid: defaultUID,
        trip_status: status,
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
        pilot_id: pilotID,
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
    await admin.database().ref("pilots").remove();
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
    it("fails when the user already has a trip request with lookingForPilot status", async () => {
      await invalidTripStatusTest("looking-for-pilot");
    });
    it("fails when the user already has a trip request with waitingPilot status", async () => {
      await invalidTripStatusTest("waiting-pilot");
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

    it("fails if trip has cancelled-by-pilot status", async () => {
      await failsWithStatus("cancelled-by-pilot");
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

    it("succeeds when trip has no-pilots-available status", async () => {
      await succeedsWithStatus("no-pilots-available");
    });

    it("succeeds when trip has looking-for-pilot status", async () => {
      await succeedsWithStatus("looking-for-pilot");
    });

    it("succeeds when trip has waiting-pilot status", async () => {
      await succeedsWithStatus("waiting-pilot");
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
      const pilotRef = admin.database().ref("pilots").child(pilotID);
      await pilotRef.set(defaultPilot);

      // add trip request to database with status waiting-confirmation
      let tripRequest = {
        uid: clientID,
        trip_status: "waiting-confirmation",
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

      // wait enough for confirm to send out request to pilot
      await sleep(1500);

      // assert trip request has looking-for-pilot status
      snapshot = await tripRequestRef.once("value");
      assert.notEqual(snapshot.val(), null);
      assert.equal(snapshot.val().trip_status, "looking-for-pilot");

      // assert pilot has been requested
      pilotSnapshot = await pilotRef.once("value");
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

      // assert trip request has waiting-pilot status
      snapshot = await tripRequestRef.once("value");
      assert.notEqual(snapshot.val(), null);
      assert.equal(snapshot.val().trip_status, "waiting-pilot");

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
      await admin.database().ref("pilots").remove();
    });

    const removeTripRequests = async () => {
      await admin.database().ref("trip-requests").remove();
    };

    const removeClients = async () => {
      await admin.database().ref("clients").remove();
    };

    const removePilots = async () => {
      await admin.database().ref("pilots").remove();
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

      // populate database with trip request with invalid waiting-pilot status

      await createTripRequest("waiting-pilot");

      // expect confirmTrip to fail
      await genericTest(
        "failed-precondition",
        "Trip request of user with uid " +
          defaultUID +
          " has invalid status 'waiting-pilot'",
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
      // delete all pilots from the database
      const pilotsRef = admin.database().ref("pilots");
      await pilotsRef.remove();

      // add an available pilot to the database
      const pilotID1 = "pilotID1";
      let pilot = {
        uid: pilotID1,
        name: "Fulano",
        last_name: "de Tal",
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
      await pilotsRef.child(pilotID1).set(pilot);

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

      // wait enough time for confirm to send request to pilot
      // may have to increae this if test is failing
      await sleep(5500);

      // assert trip has looking-for-pilot status
      let tripRequestSnapshot = await tripRequestRef.once("value");
      assert.isNotNull(tripRequestSnapshot.val());
      assert.equal(tripRequestSnapshot.val().trip_status, "looking-for-pilot");

      // assert pilot was requested
      let pilot1Snapshot = await pilotsRef.child(pilotID1).once("value");
      assert.isNotNull(pilot1Snapshot.val());
      assert.equal(pilot1Snapshot.val().status, "requested");
      assert.isUndefined(pilot1Snapshot.val().total_trips);

      // pilot one accepts the trip
      const wrappedAccept = test.wrap(trip.accept);
      await wrappedAccept(
        { client_id: defaultUID },
        { auth: { uid: pilotID1 } }
      );

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
      await pilotsRef.remove();
      await tripRequestRef.remove();
    });

    it("sets tripRequest 'payment_method' to 'cash' if client is paying cash", async () => {
      // delete all pilots from the database
      const pilotsRef = admin.database().ref("pilots");
      await pilotsRef.remove();

      // add an available pilot to the database
      const pilotID1 = "pilotID1";
      let pilot = {
        uid: pilotID1,
        name: "Fulano",
        last_name: "de Tal",
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
      await pilotsRef.child(pilotID1).set(pilot);

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

      // wait enough time for confirm to send request to pilot
      await sleep(3000);

      // assert trip has looking-for-pilot status
      let tripRequestSnapshot = await tripRequestRef.once("value");
      assert.isNotNull(tripRequestSnapshot.val());
      assert.equal(tripRequestSnapshot.val().trip_status, "looking-for-pilot");

      // assert pilot was requested
      let pilot1Snapshot = await pilotsRef.child(pilotID1).once("value");
      assert.isNotNull(pilot1Snapshot.val());
      assert.equal(pilot1Snapshot.val().status, "requested");
      assert.isUndefined(pilot1Snapshot.val().total_trips);

      // pilot one accepts the trip
      const wrappedAccept = test.wrap(trip.accept);
      await wrappedAccept(
        { client_id: defaultUID },
        { auth: { uid: pilotID1 } }
      );

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
      await pilotsRef.remove();
      await tripRequestRef.remove();
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
      await sleep(8500);

      // assert trip has looking-for-pilot status
      let tripRequestSnapshot = await tripRequestRef.once("value");
      assert.isNotNull(tripRequestSnapshot.val());
      assert.equal(tripRequestSnapshot.val().trip_status, "looking-for-pilot");

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
      assert.equal(confirmResult.pilot_id, pilotID1);
      assert.equal(confirmResult.pilot_status, "busy");
      assert.equal(confirmResult.current_client_uid, defaultUID);
      assert.equal(confirmResult.trip_status, "waiting-pilot");
      // pilot's total_trips is zero
      assert.equal(confirmResult.pilot_total_trips, "0");

      // assert trip has waiting-pilot status
      tripRequestSnapshot = await tripRequestRef.once("value");
      assert.isNotNull(tripRequestSnapshot.val());
      assert.equal(tripRequestSnapshot.val().trip_status, "waiting-pilot");

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
      // may have to increase if test is not passing
      await sleep(2500);

      // assert trip has looking-for-pilot status
      let tripRequestSnapshot = await tripRequestRef.once("value");
      assert.isNotNull(tripRequestSnapshot.val());
      assert.equal(tripRequestSnapshot.val().trip_status, "looking-for-pilot");

      // assert pilot 1 has been requested
      let pilot1Snapshot = await pilotsRef.child(pilotID1).once("value");
      assert.isNotNull(pilot1Snapshot.val());
      assert.equal(pilot1Snapshot.val().status, "requested");
      // assert pilot 2 has not been requested
      let pilot2Snapshot = await pilotsRef.child(pilotID2).once("value");
      assert.isNotNull(pilot2Snapshot.val());
      assert.equal(pilot2Snapshot.val().status, "busy");

      // pilot 2 accepts the trip (bypass accepTrip, which would fail)
      await tripRequestRef.child("pilot_id").set(pilotID2);

      // assert confirm trip didn't accept pilot 2
      tripRequestSnapshot = await tripRequestRef.once("value");
      assert.isNotNull(tripRequestSnapshot.val());
      assert.equal(tripRequestSnapshot.val().pilot_id, "");

      // pilot 1 accepts the trip
      const wrappedAccept = test.wrap(trip.accept);
      await wrappedAccept(
        { client_id: defaultUID },
        { auth: { uid: pilotID1 } }
      );

      // assert confirm trip accepted pilot 1
      tripRequestSnapshot = await tripRequestRef.once("value");
      assert.isNotNull(tripRequestSnapshot.val());
      assert.equal(tripRequestSnapshot.val().pilot_id, pilotID1);

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
        member_since: Date.now().toString(),
        phone_number: "(38) 99999-9999",
        current_latitude: "-17.217587",
        current_longitude: "-46.881064",
        current_zone: "AA",
        status: "requested",
        current_client_uid: clientID,
        vehicle: {
          brand: "honda",
          model: "CG 150",
          year: 2020,
          plate: "HMR 1092",
        },
        idle_since: Date.now().toString(),
        rating: "5.0",
      };
      await admin.database().ref("pilots").child(pilotID1).set(defaultPilot);

      // add trip request to database being handled by another pilot
      let tripRequest = {
        uid: clientID,
        origin_place_id: valid_origin_place_id,
        destination_place_id: valid_destination_place_id,
        trip_status: "waiting-confirmation",
        origin_zone: "AA",
        pilot_id: "anotherPilot",
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

    it("fails when trying to start trip with status different from waiting-pilot", async () => {
      const pilotID1 = "pilotID1";
      const clientID = "clientID";

      // add trip request for clientID with status different from waiting-pilot
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
      await admin.database().ref("pilots").child(pilotID1).set(defaultPilot);

      // fail if pilot tries starting the trip without waiting-pilot status
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

      // add trip request for clientID that is being handled by another pilot
      let tripRequest = {
        uid: clientID,
        origin_place_id: valid_origin_place_id,
        destination_place_id: valid_destination_place_id,
        trip_status: "waiting-pilot",
        pilot_id: anotherPilotID,
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
      await admin.database().ref("pilots").child(pilotID1).set(defaultPilot);

      // fail if pilot tries starting the trip without waiting-pilot status
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

      // add two available pilots to the database
      await admin.database().ref("pilots").remove();
      await admin.database().ref("pilots").remove();
      let defaultPilot = {
        uid: "",
        name: "Fulano",
        last_name: "de Tal",
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

      // assert trip status has changed to looking-for-pilot
      let tripSnapshot = await tripRequestRef.once("value");
      assert.isNotNull(tripSnapshot.val());
      assert.equal(tripSnapshot.val().trip_status, "looking-for-pilot");

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

      // assert trip status has changed to waiting-pilot
      tripSnapshot = await tripRequestRef.once("value");
      assert.isNotNull(tripSnapshot.val());
      assert.equal(tripSnapshot.val().trip_status, "waiting-pilot");

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
      await admin.database().ref("past-trips").child("pilots").remove();
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

    it("fails when pilot is not busy", async () => {
      const pilotID1 = "pilotID1";
      const clientID = "clientID";

      // add a pilot to the database supposedly handing a trip for clientID
      await admin.database().ref("pilots").remove();
      let defaultPilot = {
        uid: pilotID1,
        name: "Fulano",
        last_name: "de Tal",
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
      await admin.database().ref("pilots").child(pilotID1).set(defaultPilot);

      // add trip request supposedly for user
      let defaultTripRequest = {
        uid: clientID,
        trip_status: "in-progress",
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
        pilot_id: pilotID1,
      };
      await admin
        .database()
        .ref("trip-requests")
        .child(clientID)
        .set(defaultTripRequest);

      // make sure there is no client entry
      await admin.database().ref("clients").remove();

      // fail if pilot tries confirming the trip for inexisting user
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

      // clear database
      await admin.database().ref("trip-requests").remove();
      await admin.database().ref("past-trips").remove();
    });

    it("fails when client has no active trip-request", async () => {
      const pilotID1 = "pilotID1";
      const clientID = "clientID";

      // add client entry to the database
      const clientRef = admin.database().ref("clients").child(clientID);
      await clientRef.set({
        uid: clientID,
        rating: "5",
      });

      // add a pilot to the database supposedly handing a trip for clientID
      await admin.database().ref("pilots").remove();
      let defaultPilot = {
        uid: pilotID1,
        name: "Fulano",
        last_name: "de Tal",
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

      // await admin.database().ref("clients").remove();
    });

    decreasesPilotAmountOwed = async (
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

        // add trip request for client being handled by the pilot with id 'pilotID',
        // and being paid with the pending transaction
        const pilotID = "pilotID";
        let defaultTripRequest = {
          uid: defaultUID,
          trip_status: "in-progress",
          origin_place_id: valid_origin_place_id,
          destination_place_id: valid_destination_place_id,
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
          pilot_id: pilotID,
          payment_method: "credit_card",
          credit_card: creditCard,
          transaction_id: transaction.tid.toString(),
        };
        const tripRequestRef = admin
          .database()
          .ref("trip-requests")
          .child(defaultUID);
        await tripRequestRef.set(defaultTripRequest);

        // add a pilot to the database supposedly handing the trip for defaultUID
        // owing amountOwed and with a valid pagarme_receiver_id
        await admin.database().ref("pilots").remove();
        let defaultPilot = {
          uid: pilotID,
          name: "Fulano",
          last_name: "de Tal",
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
          pagarme_receiver_id: "re_cko91zvv600b60i9tv2qvf24o",
        };
        const pilotRef = admin.database().ref("pilots").child(pilotID);
        await pilotRef.set(defaultPilot);

        // before completing trip, assert pilot owes amountOwed
        const pilot = new Pilot(pilotID);
        let p = await pilot.getPilot();
        assert.isDefined(p);
        assert.equal(p.amount_owed, amountOwed);

        // pilot calls complete trip
        const wrappedComplete = test.wrap(trip.complete);
        await wrappedComplete({ client_rating: 5 }, { auth: { uid: pilotID } });
        await sleep(200);

        // after completing trip, assert pilot owes amountOwed - discounted amount
        p = await pilot.getPilot();
        assert.isDefined(p);
        assert.equal(p.amount_owed, amountOwed - expectedDiscountedAmount);
      });
    };

    decreasesPilotAmountOwed(
      "decreases pilot's amount_owed if pay with credit_card and pilot owes more than 80% of fare price",
      521,
      727,
      Math.ceil(0.8 * 521)
    );

    decreasesPilotAmountOwed(
      "decreases pilot's amount_owed if pay with credit_card and pilot owes less than 80% of fare price",
      401,
      157,
      157
    );

    decreasesPilotAmountOwed(
      "doesn't decrease pilot's amount_owed if pay with credit_card but pilot owes nothing",
      563,
      0,
      0
    );

    it("flags client and doesn't decrease pilots amount_owed if pay with credit_card but capture fails", async () => {
      // add client to the database
      const c = new Client(defaultUID);
      await c.addClient({
        uid: defaultUID,
        rating: "5",
        payment_method: {
          default: "cash",
        },
      });

      // add trip request for client being handled by the pilot with id 'pilotID',
      // and being paid with an invalid transaction ID so capture fails
      const pilotID = "pilotID";
      const farePrice = 569;
      let defaultTripRequest = {
        uid: defaultUID,
        trip_status: "in-progress",
        origin_place_id: valid_origin_place_id,
        destination_place_id: valid_destination_place_id,
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
        pilot_id: pilotID,
        payment_method: "credit_card",
        credit_card: creditCard,
        transaction_id: "invalid_transactin_id",
      };
      const tripRequestRef = admin
        .database()
        .ref("trip-requests")
        .child(defaultUID);
      await tripRequestRef.set(defaultTripRequest);

      // add a pilot to the database supposedly handing the trip for defaultUID
      // owing amountOwed
      let amountOwed = 311;
      let defaultPilot = {
        uid: pilotID,
        name: "Fulano",
        last_name: "de Tal",
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
        pagarme_receiver_id: "re_cko91zvv600b60i9tv2qvf24o",
      };
      const pilotRef = admin.database().ref("pilots").child(pilotID);
      await pilotRef.set(defaultPilot);

      // before completing trip, assert pilot owes amountOwed
      const pilot = new Pilot(pilotID);
      let p = await pilot.getPilot();
      assert.isDefined(p);
      assert.equal(p.amount_owed, amountOwed);

      // before pilot completes trip, assert client has no unpaid trips
      let client = await c.getClient();
      assert.isDefined(client);
      assert.isUndefined(client.amount_owed);
      assert.isUndefined(client.unpaid_past_trip_id);

      // pilot calls complete trip
      const wrappedComplete = test.wrap(trip.complete);
      await wrappedComplete({ client_rating: 5 }, { auth: { uid: pilotID } });
      await sleep(200);

      // after completing trip, assert pilot still owes amountOwed
      p = await pilot.getPilot();
      assert.isDefined(p);
      assert.equal(p.amount_owed, amountOwed);

      // after pilot complets trip, assert client has an unpaid trip
      // oweing farePrice
      client = await c.getClient();
      assert.isDefined(client);
      assert.equal(client.amount_owed, farePrice);
      assert.isDefined(client.unpaid_past_trip_id);
    });

    it("increases pilot's amount_owed if pay with cash", async () => {
      // add client to the database
      const c = new Client(defaultUID);
      await c.addClient({
        uid: defaultUID,
        rating: "5",
        payment_method: {
          default: "cash",
        },
      });

      // add trip request for client being handled by the pilot with id 'pilotID',
      // and being paid with cash
      const pilotID = "pilotID";
      const farePrice = 631;
      let defaultTripRequest = {
        uid: defaultUID,
        trip_status: "in-progress",
        origin_place_id: valid_origin_place_id,
        destination_place_id: valid_destination_place_id,
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
        pilot_id: pilotID,
        payment_method: "cash",
      };
      const tripRequestRef = admin
        .database()
        .ref("trip-requests")
        .child(defaultUID);
      await tripRequestRef.set(defaultTripRequest);

      // add a pilot to the database supposedly handing the trip for defaultUID
      // owing amountOwed
      let amountOwed = 311;
      let defaultPilot = {
        uid: pilotID,
        name: "Fulano",
        last_name: "de Tal",
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
        pagarme_receiver_id: "re_cko91zvv600b60i9tv2qvf24o",
      };
      const pilotRef = admin.database().ref("pilots").child(pilotID);
      await pilotRef.set(defaultPilot);

      // before completing trip, assert pilot owes amountOwed
      const pilot = new Pilot(pilotID);
      let p = await pilot.getPilot();
      assert.isDefined(p);
      assert.equal(p.amount_owed, amountOwed);

      // pilot calls complete trip
      const wrappedComplete = test.wrap(trip.complete);
      await wrappedComplete({ client_rating: 5 }, { auth: { uid: pilotID } });
      await sleep(200);

      // after completing trip, assert pilot owes amountOwed + 20% of farePrice
      p = await pilot.getPilot();
      assert.isDefined(p);
      assert.equal(p.amount_owed, amountOwed + Math.ceil(0.2 * farePrice));
    });

    it("fails when trying to complete a trip with status different from in-progress", async () => {
      const pilotID1 = "pilotID1";

      // add client entry to the database
      const clientRef = admin.database().ref("clients").child(defaultUID);
      await clientRef.set({
        uid: defaultUID,
        rating: "5",
      });

      // add trip request for defaultUID with status different from in-progress
      await createTripRequest("waiting-pilot");

      // add a pilot to the database supposedly handing the trip for defaultUID
      let defaultPilot = {
        uid: pilotID1,
        name: "Fulano",
        last_name: "de Tal",
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
          "cannot complete trip in status 'waiting-pilot'"
        );
      }
    });

    it("fails when trying to complete a trip for which the pilot was not chosen", async () => {
      const pilotID1 = "pilotID1";

      // add client entry to the database
      const clientRef = admin.database().ref("clients").child(defaultUID);
      await clientRef.set({
        uid: defaultUID,
        rating: "5",
      });

      // add trip request for clientID being handled by a different pilot
      await createTripRequest("in-progress");

      // add a pilot to the database supposedly handing the trip for clientID
      let defaultPilot = {
        uid: pilotID1,
        name: "Fulano",
        last_name: "de Tal",
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
      // clear past-trips
      await admin.database().ref("past-trips").remove();

      const pilotID1 = "pilotID1";

      // add client entry to the database
      const clientRef = admin.database().ref("clients").child(defaultUID);
      await clientRef.set({
        uid: defaultUID,
        payment_method: {
          default: "cash",
        },
        rating: "0",
      });

      // add trip request for defaultUID being handled by the pilot
      let defaultTripRequest = {
        uid: defaultUID,
        trip_status: "in-progress",
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
        pilot_id: pilotID1,
      };

      const tripRequestRef = admin
        .database()
        .ref("trip-requests")
        .child(defaultUID);

      await tripRequestRef.set(defaultTripRequest);

      // add a pilot to the database supposedly handing the trip for defaultUID
      const initialIdleSince = Date.now().toString();
      let defaultPilot = {
        uid: pilotID1,
        name: "Fulano",
        last_name: "de Tal",
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
      assert.equal(clientSnapshot.val().rating, "0");
      assert.equal(clientSnapshot.val().uid, defaultUID);

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
      assert.isAbove(
        Number(pilotSnapshot.val().idle_since),
        Number(initialIdleSince)
      );

      // assert pilot's has a past trip
      pilotPastTrips = await ppt.getPastTrips();
      assert.equal(pilotPastTrips.length, 1);
      assert.equal(pilotPastTrips[0].uid, defaultUID);
      assert.equal(pilotSnapshot.val().total_trips, "1");

      // assert client has been updated
      clientSnapshot = await clientRef.once("value");
      assert.isNotNull(clientSnapshot.val());
      assert.equal(clientSnapshot.val().rating, "5.00");
      assert.equal(clientSnapshot.val().uid, defaultUID);

      // assert client has one past trip with client_rating and pilot_past_trip_ref_key
      clientPastTrips = await cpt.getPastTrips();
      assert.equal(clientPastTrips.length, 1);
      assert.equal(clientPastTrips[0].uid, defaultUID);
      assert.equal(clientPastTrips[0].client_rating, "5.00");
      assert.isDefined(clientPastTrips[0].pilot_past_trip_ref_key);

      // assert a reference key has been added to the trip request.
      let tripSnapshot = await tripRequestRef.once("value");
      assert.isNotNull(tripSnapshot.val());
      assert.isDefined(tripSnapshot.val().pilot_past_trip_ref_key);
    });
  });

  describe("ratePilot", () => {
    const genericTest = async (
      data,
      expectedCode,
      expectedMessage,
      ctx = defaultCtx,
      succeeed = false
    ) => {
      const wrapped = test.wrap(trip.rate_pilot);
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
        { pilot_id: "pilot_id" },
        "invalid-argument",
        "missing expected argument 'score'."
      );
    });

    it("fails if argument score is not a number", async () => {
      await genericTest(
        { score: "not a number", pilot_id: "pilot_id" },
        "invalid-argument",
        "argument 'score' has invalid type. Expected 'number'. Received 'string'."
      );
    });

    it("fails if argument pilot_id is not present", async () => {
      await genericTest(
        { score: 1 },
        "invalid-argument",
        "missing expected argument 'pilot_id'."
      );
    });

    it("fails if argument pilot_id is not a string", async () => {
      await genericTest(
        { score: 1, pilot_id: {} },
        "invalid-argument",
        "argument 'pilot_id' has invalid type. Expected 'string'. Received 'object'."
      );
    });

    it("fails if argument score is not a number between 0 and 5", async () => {
      await genericTest(
        { score: -1, pilot_id: "pilot_id" },
        "invalid-argument",
        "argument 'score' must be a number between 0 and 5."
      );
      await genericTest(
        { score: 6, pilot_id: "pilot_id" },
        "invalid-argument",
        "argument 'score' must be a number between 0 and 5."
      );
    });

    it("fails if argument cleanliness_went_well, if present, is not a boolean", async () => {
      await genericTest(
        {
          score: 1,
          pilot_id: "pilot_id",
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
          pilot_id: "pilot_id",
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
          pilot_id: "pilot_id",
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
          pilot_id: "pilot_id",
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
          pilot_id: "pilot_id",
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
          pilot_id: "pilot_id",
        },
        "failed-precondition",
        "could not find a trip request with 'completed' status for client with id 'defaultUID'"
      );

      // clear database
      await admin.database().ref("trip-requests").remove();
    });

    it("fails if trip's  'pilot_id' does not correspond to id of pilot being rated", async () => {
      // create trip request with 'completed' status and invalid pilot id
      await createTripRequest("completed", "invalidPilotID");

      await genericTest(
        {
          score: 1,
          pilot_id: "pilot_id",
        },
        "failed-precondition",
        "could not find a trip request handled by a pilot with id 'pilot_id' for client with id 'defaultUID'"
      );

      // clear database
      await admin.database().ref("trip-requests").remove();
    });

    it("fails if trip's 'pilot_past_trip_ref_key' is not be set", async () => {
      // create trip request with 'completed' status and valid pilot id
      await createTripRequest("completed", "pilot_id");

      await genericTest(
        {
          score: 1,
          pilot_id: "pilot_id",
        },
        "failed-precondition",
        "trip request has undefined field 'pilot_past_trip_ref_key'"
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
        pilot_id: "pilot_id",
        pilot_past_trip_ref_key: refKey,
      };

      let tripRequestRef = admin
        .database()
        .ref("trip-requests")
        .child(defaultUID);

      await tripRequestRef.set(defaultTripRequest);
      return tripRequestRef;
    };

    it("fails if pilot being rated does not exist", async () => {
      await createValidTripRequest();

      // make sure pilot doesn't exist
      await admin.database().ref("pilots").remove();

      await genericTest(
        {
          score: 1,
          pilot_id: "pilot_id",
        },
        "failed-precondition",
        "could not find a pilot wiht id id 'pilot_id'"
      );

      // clear database
      await admin.database().ref("trip-requests").remove();
    });

    it("updates pilot's past trips if succeeds", async () => {
      // clear database
      await admin.database().ref("trip-requests").remove();
      await admin.database().ref("past-trips").remove();
      await admin.database().ref("pilots").remove();

      // create a pilot
      const pilotID = "pilot_id";
      let defaultPilot = {
        uid: pilotID,
        name: "Fulano",
        last_name: "de Tal",
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
      const pilotRef = admin.database().ref("pilots").child(pilotID);
      await pilotRef.set(defaultPilot);

      // pretend the pilot has a past trip
      const ppt = new PilotPastTrips(pilotID);
      let defaultTrip = {
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
        pilot_id: pilotID,
      };

      let pastTripRefKey = await ppt.pushPastTrip(defaultTrip);
      await createValidTripRequest(pastTripRefKey);

      // assert pilot's past trip has not been rated
      let pastTrips = await ppt.getPastTrips();
      assert.equal(pastTrips.length, 1);
      assert.equal(pastTrips[0].rating, undefined);

      // rate the pilot
      await genericTest(
        {
          score: 2,
          pilot_id: pilotID,
          cleanliness_went_well: true,
          safety_went_well: false,
          feedback: "the pilot is great!",
        },
        undefined,
        "",
        defaultCtx,
        true
      );

      // expect past trip to have been updated
      pastTrips = await ppt.getPastTrips();
      assert.equal(pastTrips.length, 1);
      assert.isDefined(pastTrips[0].pilot_rating);
      assert.equal(pastTrips[0].pilot_rating.score, "2");
      assert.equal(pastTrips[0].pilot_rating.cleanliness_went_well, true);
      assert.equal(pastTrips[0].pilot_rating.safety_went_well, false);
      assert.equal(pastTrips[0].pilot_rating.waiting_time_went_well, undefined);
      assert.equal(pastTrips[0].pilot_rating.feedback, "the pilot is great!");

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
      await admin.database().ref("pilots").remove();
    });

    it("works when integrated", async () => {
      const pilotID1 = "pilotID1";

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

      // add an available pilot to the database
      await admin.database().ref("pilots").remove();
      let defaultPilot = {
        uid: "",
        name: "Fulano",
        last_name: "de Tal",
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
      defaultPilot.uid = pilotID1;
      await admin.database().ref("pilots").child(pilotID1).set(defaultPilot);

      // add trip request to database
      const tripRequestRef = await createTripRequest();

      // user confirms trip
      const wrappedConfirm = test.wrap(trip.confirm);
      wrappedConfirm({}, { auth: { uid: defaultUID } });

      // wait enough for confirm to send out request to pilot
      await sleep(1500);

      // pilot accepts the trip
      const wrappedAccept = test.wrap(trip.accept);
      await wrappedAccept(
        { client_id: defaultUID },
        { auth: { uid: pilotID1 } }
      );

      // pilot starts the trip
      const wrappedStart = test.wrap(trip.start);
      await wrappedStart(
        { client_id: defaultUID },
        { auth: { uid: pilotID1 } }
      );

      // await for trip status to be set
      await sleep(200);

      // assert pilot has no past trips before completing trip
      const ppt = new PilotPastTrips(pilotID1);
      let pastTrips = await ppt.getPastTrips();
      assert.isEmpty(pastTrips);

      // pilot completes the trip
      const wrappedComplete = test.wrap(trip.complete);
      await wrappedComplete({ client_rating: 5 }, { auth: { uid: pilotID1 } });
      await sleep(200);

      // assert pilot's past trip has not been rated
      pastTrips = await ppt.getPastTrips();
      assert.equal(pastTrips.length, 1);
      assert.equal(pastTrips[0].rating, undefined);

      // client rates the trip
      const wrappedRatePilot = test.wrap(trip.rate_pilot);
      await wrappedRatePilot(
        { score: 5, pilot_id: pilotID1, cleanliness_went_well: true },
        defaultCtx
      );

      // expect past trip to have been updated
      pastTrips = await ppt.getPastTrips();
      assert.isDefined(pastTrips[0].pilot_rating);
      assert.equal(pastTrips[0].pilot_rating.score, "5");
      assert.equal(pastTrips[0].pilot_rating.cleanliness_went_well, true);
      assert.equal(pastTrips[0].pilot_rating.safety_went_well, undefined);
      assert.equal(pastTrips[0].pilot_rating.waiting_time_went_well, undefined);
      assert.equal(pastTrips[0].pilot_rating.feedback, undefined);
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
      await admin.database().ref("pilots").remove();
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
        pilot_id: "pilotID",
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
      await admin.database().ref("pilots").remove();
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
        pilot_id: "pilotID",
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

  describe("pilotGetTripRating", () => {
    const genericTest = async (
      data,
      expectedCode,
      expectedMessage,
      ctx = defaultCtx,
      succeeed = false
    ) => {
      const wrapped = test.wrap(trip.pilot_get_trip_rating);
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

    it("fails if argument 'pilot_id' is not present", async () => {
      await genericTest(
        { past_trip_ref_key: "past_trip_ref_key" },
        "invalid-argument",
        "missing expected argument 'pilot_id'."
      );
    });

    it("fails if argument 'past_trip_ref_key' is not present", async () => {
      await genericTest(
        { pilot_id: "pilot_id" },
        "invalid-argument",
        "missing expected argument 'past_trip_ref_key'."
      );
    });

    it("returns undefined to unrated trips", async () => {
      // clear database
      await admin.database().ref("past-trips").remove();

      // populate database with pilot past trip without rating
      const pilotID = "pilotID";
      const ppt = new PilotPastTrips(pilotID);

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
        pilot_id: pilotID,
      };

      const refKey = await ppt.pushPastTrip(pastTrip);

      const wrapped = test.wrap(trip.pilot_get_trip_rating);

      // request all client's past trips
      let result = await wrapped(
        { pilot_id: pilotID, past_trip_ref_key: refKey },
        defaultCtx
      );
      assert.isUndefined(result);
    });

    it("returns a rating of the pilot", async () => {
      // clear database
      await admin.database().ref("past-trips").remove();

      // populate database with pilot past trip with rating 4.
      const pilotID = "pilotID";
      const ppt = new PilotPastTrips(pilotID);
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
        pilot_id: pilotID,
        pilot_rating: {
          score: "4.00",
        },
      };
      const refKey = await ppt.pushPastTrip(pastTrip);

      const wrapped = test.wrap(trip.pilot_get_trip_rating);

      // request all client's past trips
      let result = await wrapped(
        { pilot_id: pilotID, past_trip_ref_key: refKey },
        defaultCtx
      );

      assert.isDefined(result);
      assert.equal(result.pilot_rating, "4.00");
    });
  });
});
