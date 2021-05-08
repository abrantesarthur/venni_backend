const firebaseFunctionsTest = require("firebase-functions-test");
const admin = require("firebase-admin");
const chai = require("chai");
const { Client } = require("../lib/database/client");
const { pagarme } = require("../lib/vendors/pagarme");

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
    pagarmeClient = new pagarme();
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
        card_number: "1234123412341234",
        card_expiration_date: "0199",
        card_holder_name: "Joao das Neves",
        card_cvv: "111",
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
        cpf_number: "11111111111",
        billing_address: {
          country: "br",
          state: "mg",
          city: "Paracatu",
          street: "street",
          street_number: "100",
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

    it("fail if client has no email address", async () => {
      // create user without email
      await admin.auth().createUser({ uid: defaultUID });

      // assert createCard fails
      await genericTest(
        validArg,
        "failed-precondition",
        "Client with id '" + defaultUID + "' has no registered email."
      );

      // delete all clients from firebase auth
      await admin.auth().deleteUser(defaultUID);
    });

    it("fail if client has no phone number", async () => {
      // create user
      await admin.auth().createUser({ uid: defaultUID });
      // add email, but not phoneNumber
      await admin
        .auth()
        .updateUser(defaultUID, { email: "client@example.com" });

      // assert createCard fails
      await genericTest(
        validArg,
        "failed-precondition",
        "Client with id '" + defaultUID + "' has no registered phone number."
      );

      // delete all clients from firebase auth
      await admin.auth().deleteUser(defaultUID);
    });

    it("succeeds at creating card if all fields are valid", async () => {
      // create client in database
      const c = new Client(defaultUID);
      await c.addClient({
        uid: defaultUID,
        rating: "5",
      });

      // create client in authentication
      await admin.auth().createUser({ uid: defaultUID });
      // add email and phoneNumber
      await admin.auth().updateUser(defaultUID, {
        email: "client@example.com",
        phoneNumber: "+5538777777777",
      });

      // before creating card, assert client has no cards
      let cards = await c.getCards();
      assert.isEmpty(cards);

      // assert createCard succeeds
      const wrapped = test.wrap(payment.create_card);
      const response = await wrapped(validArg, defaultCtx);

      assert.isDefined(response);
      assert.isDefined(response.id);
      assert.isDefined(response.last_digits);
      assert.isDefined(response.pagarme_customer_id);
      assert.isDefined(response.billing_address);

      // after creating card, assert client has cards
      cards = await c.getCards();
      assert.isNotEmpty(cards);
      assert.equal(cards.length, 1);

      // delete client from firebase database and auth
      await admin.database().ref("clients").remove();
      await admin.auth().deleteUser(defaultUID);
    });
  });
});
