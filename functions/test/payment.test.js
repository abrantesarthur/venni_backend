const firebaseFunctionsTest = require("firebase-functions-test");
const admin = require("firebase-admin");
const chai = require("chai");
const { Client } = require("../lib/database/client");
const { Pagarme } = require("../lib/vendors/pagarme");
const { ClientPastTrips } = require("../lib/database/pastTrips");
const { Partner } = require("../lib/database/partner");

const assert = chai.assert;
const test = firebaseFunctionsTest(
  {
    databaseURL:
      "https://venni-rider-development-8a3f8-default-rtdb.firebaseio.com/",
    projectId: "venni-rider-development-8a3f8",
    storageBucket: "venni-rider-development-8a3f8.appspot.com",
  },
  "./devAdminCredentials.json"
);

describe("payment", () => {
  let pagarmeClient;
  let payment;
  let defaultCtx;
  let defaultUID;

  before(async () => {
    if (admin.apps.length == 0) {
      admin.initializeApp();
    }
    defaultUID = "defaultUID";
    defaultCtx = {
      auth: {
        uid: defaultUID,
      },
    };
    // initialize pagarme
    pagarmeClient = new Pagarme();
    await pagarmeClient.ensureInitialized();
    // initialize payment
    payment = require("../lib/payment");
  });

  describe("createCard", () => {
    let validArg;
    let defaultCard;
    let defaultCardHash;

    before(async () => {
      // add default client without cards to the database
      const c = new Client(defaultUID);
      await c.addClient({
        uid: defaultUID,
        rating: "5",
      });
      // initialize defaultCard
      defaultCard = {
        card_number: "5234213829598909",
        card_expiration_date: "0235",
        card_holder_name: "Joao das Neves",
        card_cvv: "500",
      };

      // calculate defaultCardHash
      defaultCardHash = await pagarmeClient.encrypt(defaultCard);
    });

    beforeEach(async () => {
      // create a card hash

      // define a valid argument for createCard
      validArg = {
        card_number: defaultCard.card_number,
        card_expiration_date: defaultCard.card_expiration_date,
        card_holder_name: defaultCard.card_holder_name,
        card_hash: defaultCardHash,
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
    });

    const genericTest = async (
      data,
      expectedCode,
      expectedMessage,
      ctx = defaultCtx,
      succeeed = false
    ) => {
      const wrapped = test.wrap(payment.create_card);
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

    it("fails if user is not authenticated", async () => {
      // pass empty context as a parameter
      await genericTest(
        {},
        "failed-precondition",
        "Missing authentication credentials.",
        {}
      );
    });

    const failIfNotPresent = async (argName) => {
      let invalidArg = validArg;
      delete invalidArg[argName];
      await genericTest(
        invalidArg,
        "invalid-argument",
        "missing expected argument '" + argName + "'."
      );
    };

    const failIfNotRightType = async (argName, expectedType, actualValue) => {
      let invalidArg = validArg;
      invalidArg[argName] = actualValue;
      await genericTest(
        invalidArg,
        "invalid-argument",
        "argument '" +
          argName +
          "' has invalid type. Expected '" +
          expectedType +
          "'. Received '" +
          typeof actualValue +
          "'."
      );
    };

    it("fails if 'card_number' is not present", async () => {
      await failIfNotPresent("card_number");
    });

    it("fails if 'card_number' is not a string", async () => {
      await failIfNotRightType("card_number", "string", 123);
    });

    it("fails if 'card_expiration_date' is not present", async () => {
      await failIfNotPresent("card_expiration_date");
    });

    it("fails if 'card_expiration_date' is not a string", async () => {
      await failIfNotRightType("card_expiration_date", "string", 123);
    });

    it("fails if 'card_holder_name' is not present", async () => {
      await failIfNotPresent("card_holder_name");
    });

    it("fails if 'card_holder_name' is not a string", async () => {
      await failIfNotRightType("card_holder_name", "string", 123);
    });

    it("fails if 'card_hash' is not present", async () => {
      await failIfNotPresent("card_hash");
    });

    it("fails if 'card_hash' is not a string", async () => {
      await failIfNotRightType("card_hash", "string", 123);
    });

    it("fails if 'cpf_number' is not present", async () => {
      await failIfNotPresent("cpf_number");
    });

    it("fails if 'cpf_number' is not a string", async () => {
      await failIfNotRightType("cpf_number", "string", 123);
    });

    it("fails if 'phone_number' is not present", async () => {
      await failIfNotPresent("phone_number");
    });

    it("fails if 'phone_number' is not a string", async () => {
      await failIfNotRightType("phone_number", "string", 123);
    });

    it("fails if 'email' is not present", async () => {
      await failIfNotPresent("email");
    });

    it("fails if 'email' is not a string", async () => {
      await failIfNotRightType("email", "string", 123);
    });

    it("fails if 'billing_address' is not present", async () => {
      await failIfNotPresent("billing_address");
    });

    it("fails if 'billing_address' is not an object", async () => {
      await failIfNotRightType("billing_address", "object", 123);
    });

    it("fail if 'card_number' doesn't have 16 characters", async () => {
      let invalidArg = validArg;
      invalidArg["card_number"] = "123412341234123";
      await genericTest(
        invalidArg,
        "invalid-argument",
        "argument 'card_number' must have exactly 16 digits."
      );
    });

    it("fail if 'card_number' is not all digits", async () => {
      let invalidArg = validArg;
      invalidArg["card_number"] = "123412341234123a";
      await genericTest(
        invalidArg,
        "invalid-argument",
        "argument 'card_number' must have exactly 16 digits."
      );
    });

    it("fail if 'card_expiration_date' doesn't have 4 characters", async () => {
      let invalidArg = validArg;
      invalidArg["card_expiration_date"] = "123";
      await genericTest(
        invalidArg,
        "invalid-argument",
        "argument 'card_expiration_date' must have MMYY format."
      );
    });

    it("fail if 'card_expiration_date' is not all digits", async () => {
      let invalidArg = validArg;
      invalidArg["card_expiration_date"] = "123a";
      await genericTest(
        invalidArg,
        "invalid-argument",
        "argument 'card_expiration_date' must have MMYY format."
      );
    });

    it("fail if 'card_expiration_date' has invalid month", async () => {
      let invalidArg = validArg;
      invalidArg["card_expiration_date"] = "1325";
      await genericTest(
        invalidArg,
        "invalid-argument",
        "argument 'card_expiration_date' has invalid month."
      );
    });

    it("fail if 'card_expiration_date' has invalid year", async () => {
      let invalidArg = validArg;
      invalidArg["card_expiration_date"] = "1220";
      await genericTest(
        invalidArg,
        "invalid-argument",
        "year in 'card_expiration_date' must not be before this year."
      );
    });

    it("fail if 'cpf_number' doesn't have 11 characters", async () => {
      let invalidArg = validArg;
      invalidArg["cpf_number"] = "1111111111";
      await genericTest(
        invalidArg,
        "invalid-argument",
        "argument 'cpf_number' must have exactly 11 digits."
      );
    });

    it("fail if 'cpf_number' is not all digits", async () => {
      let invalidArg = validArg;
      invalidArg["cpf_number"] = "1111111111a";
      await genericTest(
        invalidArg,
        "invalid-argument",
        "argument 'cpf_number' must have exactly 11 digits."
      );
    });

    it("fail if 'billing_address' is not valid", async () => {
      let invalidArg = validArg;
      invalidArg["billing_address"] = { invalid_field: "invalid_field" };
      await genericTest(
        invalidArg,
        "invalid-argument",
        "argument 'billing_address' is invalid."
      );
    });

    it("succeeds at creating card if all fields are valid", async () => {
      // create client in database
      const c = new Client(defaultUID);
      await c.addClient({
        uid: defaultUID,
        rating: "5",
      });

      // before creating card, assert client has no cards
      let cards = await c.getCards();
      assert.isEmpty(cards);

      // assert createCard succeeds
      const wrapped = test.wrap(payment.create_card);
      const response = await wrapped(validArg, defaultCtx);

      assert.isDefined(response);
      assert.isDefined(response.id);
      assert.isDefined(response.brand);
      assert.isDefined(response.last_digits);
      assert.isDefined(response.pagarme_customer_id);
      assert.isDefined(response.billing_address);

      // after creating card, assert client has cards
      cards = await c.getCards();
      assert.isNotEmpty(cards);
      assert.equal(cards.length, 1);

      // delete client from firebase database and auth
      await admin.database().ref("clients").remove();
    });
  });

  describe("delete_card", () => {
    let defaultCard;
    let defaultCardHash;

    before(async () => {
      // add default client without cards to the database
      const c = new Client(defaultUID);
      await c.addClient({
        uid: defaultUID,
        rating: "5",
      });
      // initialize defaultCard
      defaultCard = {
        card_number: "5234213829598909",
        card_expiration_date: "0235",
        card_holder_name: "Joao das Neves",
        card_cvv: "500",
      };

      // calculate defaultCardHash
      defaultCardHash = await pagarmeClient.encrypt(defaultCard);
    });

    const genericTest = async (
      data,
      expectedCode,
      expectedMessage,
      ctx = defaultCtx,
      succeeed = false
    ) => {
      const wrapped = test.wrap(payment.delete_card);
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

    it("fails if user is not authenticated", async () => {
      // pass empty context as a parameter
      await genericTest(
        {},
        "failed-precondition",
        "Missing authentication credentials.",
        {}
      );
    });

    it("fails if 'card_id' is not present", async () => {
      await genericTest(
        {},
        "invalid-argument",
        "missing expected argument 'card_id'."
      );
    });

    it("updates client's default payment method if deleted card is default", async () => {
      // create client in database with card to be deleted as default payment method
      const c = new Client(defaultUID);
      await c.addClient({
        uid: defaultUID,
        rating: "5",
        payment_method: {
          default: "credit_card",
          card_id: "card_id",
        },
      });

      await c.addCard({
        id: "card_id",
        holder_name: "Fulano de Tal",
        first_digits: "523445",
        last_digits: "8209",
        expiration_date: "1131",
        brand: "visa",
        pagarme_customer_id: 12345,
        billing_address: {
          country: "br",
          state: "mg",
          city: "Paracatu",
          street: "Rua i",
          street_number: "151",
          zipcode: "38600000",
        },
      });

      // before delete card, assert default payment method is the card
      let client = await c.getClient();
      assert.isDefined(client);
      assert.equal(client.payment_method.default, "credit_card");
      assert.equal(client.payment_method.card_id, "card_id");

      // delete card
      const wrapped = test.wrap(payment.delete_card);
      const response = await wrapped({ card_id: "card_id" }, defaultCtx);

      // after deleting card, assert default payment method changed to cash
      client = await c.getClient();
      assert.isDefined(client);
      assert.equal(client.payment_method.default, "cash");
      assert.isUndefined(client.payment_method.card_id);

      // delete client from firebase database and auth
      await admin.database().ref("clients").remove();
    });

    it("does not update client's default payment method if deleted card is not default", async () => {
      // create client in database
      const c = new Client(defaultUID);
      await c.addClient({
        uid: defaultUID,
        rating: "5",
        payment_method: {
          default: "credit_card",
          card_id: "some_other_card",
        },
      });

      await c.addCard({
        id: "card_id",
        holder_name: "Fulano de Tal",
        first_digits: "523445",
        last_digits: "8209",
        expiration_date: "1131",
        brand: "visa",
        pagarme_customer_id: 12345,
        billing_address: {
          country: "br",
          state: "mg",
          city: "Paracatu",
          street: "Rua i",
          street_number: "151",
          zipcode: "38600000",
        },
      });

      // before delete card, assert client has card and default payment method
      let client = await c.getClient();
      assert.isDefined(client);
      assert.equal(client.payment_method.default, "credit_card");
      assert.equal(client.payment_method.card_id, "some_other_card");
      assert.isNotEmpty(client.cards);
      assert.equal(client.cards.length, 1);
      assert.equal(client.cards[0].id, "card_id");

      // delete card
      const wrapped = test.wrap(payment.delete_card);
      const response = await wrapped({ card_id: "card_id" }, defaultCtx);

      // after deleting card, assert client has no cards and payment method didn't change
      client = await c.getClient();
      assert.isDefined(client);
      assert.equal(client.payment_method.default, "credit_card");
      assert.equal(client.payment_method.card_id, "some_other_card");
      assert.isEmpty(client.cards);

      // delete client from firebase database and auth
      await admin.database().ref("clients").remove();
    });
  });

  describe("setDefaultPaymentMethod", () => {
    const genericTest = async (
      data,
      expectedCode,
      expectedMessage,
      ctx = defaultCtx,
      succeeed = false
    ) => {
      const wrapped = test.wrap(payment.set_default_payment_method);
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

    it("fails if user is not authenticated", async () => {
      // pass empty context as a parameter
      await genericTest(
        {},
        "failed-precondition",
        "Missing authentication credentials.",
        {}
      );
    });

    it("fails if 'card_id' is not a string", async () => {
      await genericTest(
        { card_id: 1234 },
        "invalid-argument",
        "argument 'card_id' has invalid type. Expected 'string'. Received 'number'."
      );
    });

    it("updates payment method to 'cash' if 'card_id' is not present", async () => {
      // add client with credit card payment method
      const c = new Client(defaultUID);
      await c.addClient({
        uid: defaultUID,
        rating: "5",
        payment_method: {
          default: "credit_card",
          card_id: "card_id",
        },
      });

      // before calling update, pament method is 'credit_card'
      let client = await c.getClient();
      assert.equal(client.payment_method.default, "credit_card");
      assert.equal(client.payment_method.card_id, "card_id");

      // call set_default_payment_method without 'card_id'
      const wrapped = test.wrap(payment.set_default_payment_method);
      await wrapped({}, defaultCtx);

      // after updating, payment method is 'cash'
      client = await c.getClient();
      assert.equal(client.payment_method.default, "cash");
      assert.isUndefined(client.payment_method.card_id);

      // delete client from firebase database and auth
      await admin.database().ref("clients").remove();
    });

    it("updates payment method to 'credit_card' if 'card_id' is present", async () => {
      // add client with 'cash' payment method
      const c = new Client(defaultUID);
      await c.addClient({
        uid: defaultUID,
        rating: "5",
        payment_method: {
          default: "cash",
        },
      });

      // before calling update, pament method is 'cash'
      let client = await c.getClient();
      assert.equal(client.payment_method.default, "cash");
      assert.isUndefined(client.payment_method.card_id);

      // call set_default_payment_method with 'card_id'
      const wrapped = test.wrap(payment.set_default_payment_method);
      await wrapped({ card_id: "card_id" }, defaultCtx);

      // after updating, payment method is 'credit_card'
      client = await c.getClient();
      assert.equal(client.payment_method.default, "credit_card");
      assert.equal(client.payment_method.card_id, "card_id");

      // delete client from firebase database and auth
      await admin.database().ref("clients").remove();
    });

    it("updates payment method's 'card_id' if 'card_id' is present", async () => {
      // add client with 'cash' payment method
      const c = new Client(defaultUID);
      await c.addClient({
        uid: defaultUID,
        rating: "5",
        payment_method: {
          default: "credit_card",
          card_id: "some_card_id",
        },
      });

      // before calling update, card_id is 'some_card_id'
      let client = await c.getClient();
      assert.equal(client.payment_method.default, "credit_card");
      assert.equal(client.payment_method.card_id, "some_card_id");

      // call set_default_payment_method with 'card_id'
      const wrapped = test.wrap(payment.set_default_payment_method);
      await wrapped({ card_id: "card_id" }, defaultCtx);

      // after updating, card_id is 'card_id'
      client = await c.getClient();
      assert.equal(client.payment_method.default, "credit_card");
      assert.equal(client.payment_method.card_id, "card_id");

      // delete client from firebase database and auth
      await admin.database().ref("clients").remove();
    });
  });

  describe("captureUnpaidTrip", () => {
    let creditCard;
    before(async () => {
      // create credit card
      let validCard = {
        card_number: "5234213829598909",
        card_expiration_date: "0235",
        card_holder_name: "Joao das Neves",
        card_cvv: "600",
      };
      let cardHash = await pagarmeClient.encrypt(validCard);
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
      // clear database
      await admin.database().ref("clients").remove();
      await admin.database().ref("partners").remove();
      await admin.database().ref("past-trips").remove();
    });

    const genericTest = async (
      data,
      expectedCode,
      expectedMessage,
      ctx = defaultCtx,
      succeeed = false
    ) => {
      const wrapped = test.wrap(payment.capture_unpaid_trip);
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

    it("fails if user is not authenticated", async () => {
      // pass empty context as a parameter
      await genericTest(
        { card_id: creditCard.id },
        "failed-precondition",
        "Missing authentication credentials.",
        {}
      );
    });

    it("fails if 'card_id' argument is missing", async () => {
      // pass empty context as a parameter
      await genericTest(
        {},
        "invalid-argument",
        "missing expected argument 'card_id'."
      );
    });

    it("throws 'not-found' if client does not exist", async () => {
      await genericTest(
        { card_id: creditCard.id },
        "not-found",
        "Could not fiend client with id 'client_id'",
        { auth: { uid: "client_id" } }
      );
    });

    it("throws 'failed-precondition' if client does not have 'unpaid_past_trip_id' field", async () => {
      // add client without unpaid past trip to the database
      const c = new Client(defaultUID);
      await c.addClient({
        uid: defaultUID,
        rating: "5",
        payment_method: {
          default: "cash",
        },
      });

      await genericTest(
        { card_id: creditCard.id },
        "failed-precondition",
        "There is no pending payments for the client."
      );
    });

    it("unsets client's 'unpaid_past_trip_id' field if specified trip does not exist", async () => {
      // add client with 'unpaid_past_trip_id' specifying inexisting trip
      const c = new Client(defaultUID);
      await c.addClient({
        uid: defaultUID,
        rating: "5",
        payment_method: {
          default: "cash",
        },
        unpaid_past_trip_id: "inexisting_trip_id",
      });

      // assert client's 'unpaid_past_trip_id' is set before capturing payment
      let client = await c.getClient();
      assert.isDefined(client);
      assert.equal(client.unpaid_past_trip_id, "inexisting_trip_id");

      const wrapped = test.wrap(payment.capture_unpaid_trip);
      let result = await wrapped({ card_id: creditCard.id }, defaultCtx);
      assert.isTrue(result);

      // assert client's 'unpaid_past_trip_id' is not set after capturing payment
      client = await c.getClient();
      assert.isDefined(client);
      assert.isUndefined(client.unpaid_past_trip_id);
    });

    it("fails if client doesn't have card specified by 'card_id'", async () => {
      // add unpaidTrip for client, handled by the partner with id 'partnerID',
      let unpaidTrip = {
        uid: defaultUID,
        trip_status: "completed",
        origin_place_id: "ChIJzY-urWVKqJQRGA8-aIMZJ4I",
        destination_place_id: "ChIJ31rnOmVKqJQR8FM30Au7boM",
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
        payment_method: "credit_card",
        credit_card: creditCard,
      };
      const cpt = new ClientPastTrips(defaultUID);
      let pastTripID = await cpt.pushPastTrip(unpaidTrip);

      // add client to the database without a credit card
      const c = new Client(defaultUID);
      await c.addClient({
        uid: defaultUID,
        rating: "5",
        payment_method: {
          default: "cash",
        },
        unpaid_past_trip_id: pastTripID,
      });

      // assert 'captureUnpaidTrip' fails
      genericTest(
        { card_id: creditCard.id },
        "not-found",
        "Client has no card with id '" + creditCard.id + "'",
        defaultCtx,
        false
      );
    });

    it("unsets 'unpaid_past_trip_id' if pays with same card used to request trip", async () => {
      // create transaction with R$5,00 value supposedly to pay the trip
      const farePrice = 500;
      const transaction = await pagarmeClient.createTransaction(
        creditCard.id,
        farePrice,
        {
          id: creditCard.pagarme_customer_id,
          name: creditCard.holder_name,
        },
        creditCard.billing_address
      );

      // add unpaidTrip for client, handled by the partner with id 'partnerID',
      // and paid with the pending transaction
      const partnerID = "partnerID";
      let unpaidTrip = {
        uid: defaultUID,
        trip_status: "completed",
        origin_place_id: "ChIJzY-urWVKqJQRGA8-aIMZJ4I",
        destination_place_id: "ChIJ31rnOmVKqJQR8FM30Au7boM",
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
      const cpt = new ClientPastTrips(defaultUID);
      let pastTripID = await cpt.pushPastTrip(unpaidTrip);

      // add client to the database with 'unpaid_past_trip_id' field set
      const c = new Client(defaultUID);
      await c.addClient({
        uid: defaultUID,
        rating: "5",
        payment_method: {
          default: "cash",
        },
        unpaid_past_trip_id: pastTripID,
      });

      // add creditCard to the client
      await c.addCard(creditCard);

      // add a partner to the database supposedly handing the trip for defaultUID
      // owing amountOwed and with a valid pagarme_recipient_id
      await admin.database().ref("partners").remove();
      let defaultPartner = {
        uid: partnerID,
        name: "Fulano",
        last_name: "de Tal",
        cpf: "00000000000",
        gender: "masculino",
        account_status: "pending_documents",
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
        pagarme_recipient_id: "re_cko91zvv600b60i9tv2qvf24o",
      };
      const partnerRef = admin.database().ref("partners").child(partnerID);
      await partnerRef.set(defaultPartner);

      // before calling captureUnpaidTrip, assert client has 'unpaid_past_trip_id' field set
      let client = await c.getClient();
      assert.isDefined(client);
      assert.isDefined(client.unpaid_past_trip_id);

      // call 'captureUnpaidTrip' and asert it returns 'true'
      const wrapped = test.wrap(payment.capture_unpaid_trip);
      let result = await wrapped({ card_id: creditCard.id }, defaultCtx);
      assert.isTrue(result);

      // after calling captureUnpaidTrip, assert client has 'unpaid_past_trip_id' field unset
      client = await c.getClient();
      assert.isDefined(client);
      assert.isUndefined(client.unpaid_past_trip_id);
    });

    it("unsets 'unpaid_past_trip_id' if pays with card different from one used to request trip", async () => {
      // create transaction with R$5,00 value supposedly to pay the trip using a credit card A
      const farePrice = 500;
      const transaction = await pagarmeClient.createTransaction(
        creditCard.id,
        farePrice,
        {
          id: creditCard.pagarme_customer_id,
          name: creditCard.holder_name,
        },
        creditCard.billing_address
      );

      // add unpaidTrip for client, handled by the partner with id 'partnerID',
      // and paid with the credit card A
      const partnerID = "partnerID";
      let unpaidTrip = {
        uid: defaultUID,
        trip_status: "completed",
        origin_place_id: "ChIJzY-urWVKqJQRGA8-aIMZJ4I",
        destination_place_id: "ChIJ31rnOmVKqJQR8FM30Au7boM",
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
      const cpt = new ClientPastTrips(defaultUID);
      let pastTripID = await cpt.pushPastTrip(unpaidTrip);

      // add client to the database with 'unpaid_past_trip_id' field set
      const c = new Client(defaultUID);
      await c.addClient({
        uid: defaultUID,
        rating: "5",
        payment_method: {
          default: "cash",
        },
        unpaid_past_trip_id: pastTripID,
      });

      // add the credit card A to the client
      await c.addCard(creditCard);

      // add a partner to the database supposedly handing the trip for defaultUID
      // owing amountOwed and with a valid pagarme_recipient_id
      await admin.database().ref("partners").remove();
      let defaultPartner = {
        uid: partnerID,
        name: "Fulano",
        last_name: "de Tal",
        cpf: "00000000000",
        gender: "masculino",
        account_status: "pending_documents",
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
        pagarme_recipient_id: "re_cko91zvv600b60i9tv2qvf24o",
      };
      const partnerRef = admin.database().ref("partners").child(partnerID);
      await partnerRef.set(defaultPartner);

      // create a credit card B
      let validCard = {
        card_number: "5234213829598909",
        card_expiration_date: "0235",
        card_holder_name: "Joao das Neves",
        card_cvv: "600",
      };
      let cardHash = await pagarmeClient.encrypt(validCard);
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
      anotherCreditCard = await wrappedCreateCard(createCardArg, defaultCtx);
      // add the credit card B to the client
      await c.addCard(anotherCreditCard);

      // before calling captureUnpaidTrip, assert client has 'unpaid_past_trip_id' field set
      let client = await c.getClient();
      assert.isDefined(client);
      assert.isDefined(client.unpaid_past_trip_id);

      // call 'captureUnpaidTrip' using credit card B and asert it returns 'true'
      const wrapped = test.wrap(payment.capture_unpaid_trip);
      let result = await wrapped({ card_id: anotherCreditCard.id }, defaultCtx);
      assert.isTrue(result);

      // after calling captureUnpaidTrip, assert client has 'unpaid_past_trip_id' field unset
      client = await c.getClient();
      assert.isDefined(client);
      assert.isUndefined(client.unpaid_past_trip_id);
    });

    it("does not unset 'unpaid_past_trip_id' if fails to capture payment", async () => {
      // add unpaidTrip for client without transaction_id so capturing it fails
      let unpaidTrip = {
        uid: defaultUID,
        trip_status: "completed",
        origin_place_id: "ChIJzY-urWVKqJQRGA8-aIMZJ4I",
        destination_place_id: "ChIJ31rnOmVKqJQR8FM30Au7boM",
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
        payment_method: "credit_card",
        credit_card: creditCard,
      };
      const cpt = new ClientPastTrips(defaultUID);
      let pastTripID = await cpt.pushPastTrip(unpaidTrip);

      // add client to the database with 'unpaid_past_trip_id' field set
      const c = new Client(defaultUID);
      await c.addClient({
        uid: defaultUID,
        rating: "5",
        payment_method: {
          default: "cash",
        },
        unpaid_past_trip_id: pastTripID,
      });
      // add card to the client
      await c.addCard(creditCard);

      // before calling captureUnpaidTrip, assert client has 'unpaid_past_trip_id' field set
      let client = await c.getClient();
      assert.isDefined(client);
      assert.isDefined(client.unpaid_past_trip_id);

      // call 'captureUnpaidTrip' and assert it returns 'false'
      const wrapped = test.wrap(payment.capture_unpaid_trip);
      let result = await wrapped({ card_id: creditCard.id }, defaultCtx);
      assert.isFalse(result);

      // after calling captureUnpaidTrip, assert client still has 'unpaid_past_trip_id' set
      client = await c.getClient();
      assert.isDefined(client);
      assert.isDefined(client.unpaid_past_trip_id);
    });
  });

  describe("createBankAccount", () => {
    let validArg;
    beforeEach(async () => {
      validArg = {
        bank_code: "000",
        agency: "0000",
        agency_dv: "0",
        account: "00000",
        account_dv: "0",
        type: "conta_corrente",
        document_number: "00000000000",
        legal_name: "Joao da Silva",
      };
    });

    after(async () => {
      // clear database
      await admin.database().ref("partners").remove();
    });

    const genericTest = async (
      data,
      expectedCode,
      expectedMessage,
      ctx = defaultCtx,
      succeeed = false
    ) => {
      const wrapped = test.wrap(payment.create_bank_account);
      try {
        await wrapped(data, ctx);
        if (succeeed) {
          assert(true, "create_bank_account finished successfully");
        } else {
          assert(false, "create_bank_account didn't throw expected error");
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

    it("fails if user is not authenticated", async () => {
      // pass empty context as a parameter
      await genericTest(
        validArg,
        "failed-precondition",
        "Missing authentication credentials.",
        {}
      );
    });

    const failsIfMissingArg = (arg) => {
      it("fails if '" + arg + "' argument is missing", async () => {
        let invalidArg = validArg;
        delete invalidArg[arg];
        await genericTest(
          invalidArg,
          "invalid-argument",
          "missing expected argument '" + arg + "'."
        );
      });
    };

    failsIfMissingArg("bank_code");
    failsIfMissingArg("agency");
    failsIfMissingArg("account");
    failsIfMissingArg("account_dv");
    failsIfMissingArg("type");
    failsIfMissingArg("document_number");
    failsIfMissingArg("legal_name");

    const failsIfWrongType = (arg, expectedType, actualValue) => {
      it("fails if '" + arg + "' argument has wrong type", async () => {
        let invalidArg = validArg;
        invalidArg[arg] = actualValue;
        await genericTest(
          invalidArg,
          "invalid-argument",
          "argument '" +
            arg +
            "' has invalid type. Expected '" +
            expectedType +
            "'. Received '" +
            typeof actualValue +
            "'."
        );
      });
    };

    failsIfWrongType("bank_code", "string", 123);
    failsIfWrongType("agency", "string", 123);
    failsIfWrongType("agency_dv", "string", 123);
    failsIfWrongType("account", "string", 123);
    failsIfWrongType("account_dv", "string", 123);
    failsIfWrongType("type", "string", 123);
    failsIfWrongType("legal_name", "string", 123);
    failsIfWrongType("document_number", "string", 123);

    it("fails if 'bank_code' argument does not have length 3", async () => {
      let invalidArg = validArg;
      invalidArg["bank_code"] = "0000";
      await genericTest(
        invalidArg,
        "invalid-argument",
        "argument 'bank_code' must have 3 digits."
      );
    });

    it("fails if 'bank_code' argument is not all digits", async () => {
      let invalidArg = validArg;
      invalidArg["bank_code"] = "00a";
      await genericTest(
        invalidArg,
        "invalid-argument",
        "argument 'bank_code' must have 3 digits."
      );
    });

    it("fails if 'agency' argument has length greater than 4", async () => {
      let invalidArg = validArg;
      invalidArg["agency"] = "00000";
      await genericTest(
        invalidArg,
        "invalid-argument",
        "argument 'agency' must have at most 4 digits."
      );
    });

    it("fails if 'agency' argument is not all digits", async () => {
      let invalidArg = validArg;
      invalidArg["agency"] = "000a";
      await genericTest(
        invalidArg,
        "invalid-argument",
        "argument 'agency' must have at most 4 digits."
      );
    });

    it("fails if 'account' argument has length greater than 13", async () => {
      let invalidArg = validArg;
      invalidArg["account"] = "00000000000000";
      await genericTest(
        invalidArg,
        "invalid-argument",
        "argument 'account' must have at most 13 digits."
      );
    });

    it("fails if 'account' argument is not all digits", async () => {
      let invalidArg = validArg;
      invalidArg["account"] = "000000000000x";
      await genericTest(
        invalidArg,
        "invalid-argument",
        "argument 'account' must have at most 13 digits."
      );
    });

    it("fails if 'account_dv' argument has length greater than 2", async () => {
      let invalidArg = validArg;
      invalidArg["account_dv"] = "000";
      await genericTest(
        invalidArg,
        "invalid-argument",
        "argument 'account_dv' must have at most 2 digits."
      );
    });

    it("fails if 'account_dv' argument is not all digits", async () => {
      let invalidArg = validArg;
      invalidArg["account_dv"] = "0x";
      await genericTest(
        invalidArg,
        "invalid-argument",
        "argument 'account_dv' must have at most 2 digits."
      );
    });

    it("fails if 'type' argument is invalid", async () => {
      let invalidArg = validArg;
      invalidArg["type"] = "invalid";
      await genericTest(
        invalidArg,
        "invalid-argument",
        "argument 'type' must be one of 'conta_corrente', 'conta_poupanca', 'conta_corrente_conjunta', and 'conta_poupanca_conjunta'"
      );
    });

    it("adds a bank_account to the partner on success", async () => {
      // add a partner to the database
      const p = new Partner(defaultUID);
      await p.update({
        uid: defaultUID,
        name: "Joao",
        last_name: "da Silva",
        cpf: "00000000000",
        gender: "masculino",
        phone_number: "+5500000000000",
        account_status: "pending_documents",
      });

      // assert partner has no bank account info
      let partner = await p.getPartner();

      assert.isDefined(partner);
      assert.isUndefined(partner.bank_account);

      // run createBankAccount
      await genericTest(validArg, "", "", defaultCtx, true);

      // assert partner now has bank account info
      partner = await p.getPartner();

      assert.isDefined(partner);
      assert.isDefined(partner.bank_account);
      assert.isDefined(partner.bank_account.id);
      assert.equal(partner.bank_account.bank_code, validArg.bank_code);
      assert.equal(partner.bank_account.agency, validArg.agency);
      assert.equal(partner.bank_account.agency_dv, validArg.agency_dv);
      assert.equal(partner.bank_account.account, validArg.account);
      assert.equal(partner.bank_account.account_dv, validArg.account_dv);
      assert.equal(partner.bank_account.type, validArg.type);
      assert.equal(
        partner.bank_account.document_number,
        validArg.document_number
      );
      assert.equal(partner.bank_account.legal_name, validArg.legal_name);
    });
  });

  describe("getBalance", () => {
    const genericTest = async (
      data,
      expectedCode,
      expectedMessage,
      ctx = defaultCtx,
      succeeed = false
    ) => {
      const wrapped = test.wrap(payment.get_balance);
      try {
        await wrapped(data, ctx);
        if (succeeed) {
          assert(true, "get_balance finished successfully");
        } else {
          assert(false, "get_balance didn't throw expected error");
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

    it("fails if user is not authenticated", async () => {
      // pass empty context as a parameter
      await genericTest(
        { pagarme_recipient_id: "pagarme_recipient_id" },
        "failed-precondition",
        "Missing authentication credentials.",
        {}
      );
    });

    it("fails if 'pagarme_recipient_id' argument is missing", async () => {
      await genericTest(
        {},
        "invalid-argument",
        "missing expected argument 'pagarme_recipient_id'."
      );
    });

    it("fails if 'pagarme_recipient_id' argument has wrong type", async () => {
      await genericTest(
        {
          pagarme_recipient_id: 21,
        },
        "invalid-argument",
        "argument 'pagarme_recipient_id' has invalid type. Expected 'string'. Received 'number'."
      );
    });

    it("returns a recipient balance on success", async () => {
      // request balance of existing pagarme recipient
      const getBalance = test.wrap(payment.get_balance);
      let balance = await getBalance(
        { pagarme_recipient_id: "re_ckq08x3ec0gsj0h9twldhs9zm" },
        defaultCtx
      );

      // assert partner has no bank account info
      assert.isDefined(balance);
      assert.isDefined(balance.waiting_funds);
      assert.isDefined(balance.available);
      assert.isDefined(balance.transferred);
    });
  });

  describe("createTransfer", () => {
    const genericTest = async (
      data,
      expectedCode,
      expectedMessage,
      ctx = defaultCtx,
      succeeed = false
    ) => {
      const wrapped = test.wrap(payment.create_transfer);
      try {
        await wrapped(data, ctx);
        if (succeeed) {
          assert(true, "create_transfer finished successfully");
        } else {
          assert(false, "create_transfer didn't throw expected error");
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

    it("fails if user is not authenticated", async () => {
      // pass empty context as a parameter
      await genericTest(
        { amount: "1000", pagarme_recipient_id: "pagarme_recipient_id" },
        "failed-precondition",
        "Missing authentication credentials.",
        {}
      );
    });

    it("fails if 'pagarme_recipient_id' argument is missing", async () => {
      await genericTest(
        { amount: "1000" },
        "invalid-argument",
        "missing expected argument 'pagarme_recipient_id'."
      );
    });

    it("fails if 'amount' argument is missing", async () => {
      await genericTest(
        { pagarme_recipient_id: "pagarme_recipient_id" },
        "invalid-argument",
        "missing expected argument 'amount'."
      );
    });

    it("fails if 'pagarme_recipient_id' argument has wrong type", async () => {
      await genericTest(
        {
          amount: "1000",
          pagarme_recipient_id: 21,
        },
        "invalid-argument",
        "argument 'pagarme_recipient_id' has invalid type. Expected 'string'. Received 'number'."
      );
    });

    it("fails if 'amount' argument has wrong type", async () => {
      await genericTest(
        {
          amount: 21,
          pagarme_recipient_id: "pagarme_recipient_id",
        },
        "invalid-argument",
        "argument 'amount' has invalid type. Expected 'string'. Received 'number'."
      );
    });

    it("fails if 'amount' is not numeric", async () => {
      await genericTest(
        {
          amount: "12a",
          pagarme_recipient_id: "pagarme_recipient_id",
        },
        "invalid-argument",
        "argument 'number' must have at most 6 digits."
      );
    });

    it("fails if 'amount' has more than 6 digits", async () => {
      await genericTest(
        {
          amount: "1234567",
          pagarme_recipient_id: "pagarme_recipient_id",
        },
        "invalid-argument",
        "argument 'number' must have at most 6 digits."
      );
    });

    it("fails when recipient doesn't have enough funds", async () => {
      // request balance of existing pagarme recipient

      await genericTest(
        {
          amount: "100",
          pagarme_recipient_id: "re_ckq08x3ec0gsj0h9twldhs9zm",
        },
        "unknown",
        "Falha ao criar transferência para recipiente com id re_ckq08x3ec0gsj0h9twldhs9zm",
        defaultCtx,
        false
      );
    });
  });
});
