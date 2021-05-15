const firebaseFunctionsTest = require("firebase-functions-test");
const admin = require("firebase-admin");
const chai = require("chai");
const { Client } = require("../lib/database/client");
const { Pagarme } = require("../lib/vendors/pagarme");

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

  describe("set_default_payment_method", () => {
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
});
