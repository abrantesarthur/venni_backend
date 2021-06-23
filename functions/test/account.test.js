const firebaseFunctionsTest = require("firebase-functions-test");
const admin = require("firebase-admin");
const chai = require("chai");
const { Partner } = require("../lib/database/partner");
const { Client } = require("../lib/database/client");
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

describe("account", () => {
  let account;
  let defaultCtx;
  let defaultUID;
  let defaultPartner;
  let defaultClient;

  before(() => {
    if (admin.apps.length == 0) {
      admin.initializeApp();
    }
    account = require("../lib/account");
    defaultUID = "defaultUID";
    defaultCtx = {
      auth: {
        uid: defaultUID,
      },
    };
    defaultPartner = {
      uid: defaultUID,
      name: "Fulano",
      last_name: "de Tal",
      cpf: "00000000000",
      gender: "masculino",
      account_status: "pending_documents",
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
    defaultClient = {
      uid: defaultUID,
      payment_method: {
        default: "cash",
      },
      rating: "5",
    };
  });

  describe("deletePartner", () => {
    const genericTest = async (
      data,
      expectedCode,
      expectedMessage,
      ctx = defaultCtx,
      succeeed = false
    ) => {
      const wrapped = test.wrap(account.delete_partner);
      try {
        await wrapped(data, ctx);
        if (succeeed) {
          assert(true, "deletePartner finished successfully");
        } else {
          assert(false, "deletePartner didn't throw expected error");
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
      await genericTest(
        {},
        "failed-precondition",
        "Missing authentication credentials.",
        {}
      );
    });

    it("deletes partner and auth credentials if user has no client account", async () => {
      const deletePartner = test.wrap(account.delete_partner);

      // add partner to database
      const p = new Partner(defaultUID);
      await p.update(defaultPartner);

      // add user to firebase authentication
      await admin.auth().createUser({ uid: defaultUID });

      // assert partner has been added
      let partner = await p.getPartner();
      assert.isDefined(partner);

      // assert auth has been created
      let user = await admin.auth().getUser(defaultUID);
      assert.isDefined(user);

      // call deletePartner
      await deletePartner({}, defaultCtx);

      // assert partner has been deleted
      partner = await p.getPartner();
      assert.isUndefined(partner);

      // assert auth credentials have been deleted
      try {
        await admin.auth().getUser(defaultUID);
        assert.fail();
      } catch (_) {}
    });

    it("deletes partner but not auth credentials if user has client account", async () => {
      const deletePartner = test.wrap(account.delete_partner);

      // add partner to database
      const p = new Partner(defaultUID);
      await p.update(defaultPartner);

      // add client to database
      const c = new Client(defaultUID);
      await c.addClient(defaultClient);

      // add user to firebase authentication
      await admin.auth().createUser({ uid: defaultUID });

      // assert partner has been added
      let partner = await p.getPartner();
      assert.isDefined(partner);

      // assert client has been added
      let client = await c.getClient();
      assert.isDefined(client);

      // assert auth has been created
      let user = await admin.auth().getUser(defaultUID);
      assert.isDefined(user);

      // call deletePartner
      await deletePartner({}, defaultCtx);

      // assert partner has been deleted
      partner = await p.getPartner();
      assert.isUndefined(partner);

      // assert client has not been deleted
      client = await c.getClient();
      assert.isDefined(client);

      // assert auth credentials have not been deleted
      try {
        user = await admin.auth().getUser(defaultUID);
        assert.isDefined(user);
        // clear auth
        await admin.auth().deleteUser(defaultUID);
      } catch (_) {
        assert.fail();
      }
    });
  });

  describe("deleteClient", () => {
    const genericTest = async (
      data,
      expectedCode,
      expectedMessage,
      ctx = defaultCtx,
      succeeed = false
    ) => {
      const wrapped = test.wrap(account.delete_client);
      try {
        await wrapped(data, ctx);
        if (succeeed) {
          assert(true, "deleteClient finished successfully");
        } else {
          assert(false, "deleteClient didn't throw expected error");
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
      await genericTest(
        {},
        "failed-precondition",
        "Missing authentication credentials.",
        {}
      );
    });

    it("deletes client and auth credentials if user has no partner account", async () => {
      const deleteClient = test.wrap(account.delete_client);

      // add client to database
      const c = new Client(defaultUID);
      await c.addClient(defaultClient);

      // add user to firebase authentication
      await admin.auth().createUser({ uid: defaultUID });

      // assert client has been added
      let client = await c.getClient();
      assert.isDefined(client);

      // assert auth has been created
      let user = await admin.auth().getUser(defaultUID);
      assert.isDefined(user);

      // call deleteClient
      await deleteClient({}, defaultCtx);

      // assert client has been deleted
      client = await c.getClient();
      assert.isUndefined(client);

      // assert auth credentials have been deleted
      try {
        await admin.auth().getUser(defaultUID);
        assert.fail();
      } catch (_) {}
    });

    it("deletes client but not auth credentials if user has partner account", async () => {
      const deleteClient = test.wrap(account.delete_client);

      // add client to database
      const c = new Client(defaultUID);
      await c.addClient(defaultClient);

      // add partner to database
      const p = new Partner(defaultUID);
      await p.update(defaultPartner);

      // add user to firebase authentication
      await admin.auth().createUser({ uid: defaultUID });

      // assert client has been added
      let client = await c.getClient();
      assert.isDefined(client);

      // assert partner has been added
      let partner = await p.getPartner();
      assert.isDefined(partner);

      // assert auth has been created
      let user = await admin.auth().getUser(defaultUID);
      assert.isDefined(user);

      // call deleteClient
      await deleteClient({}, defaultCtx);

      // assert client has  been deleted
      client = await c.getClient();
      assert.isUndefined(client);

      // assert partner has not been deleted
      partner = await p.getPartner();
      assert.isDefined(partner);

      // assert auth credentials have not been deleted
      try {
        user = await admin.auth().getUser(defaultUID);
        assert.isDefined(user);
        // clear auth
        await admin.auth().deleteUser(defaultUID);
      } catch (_) {
        assert.fail();
      }
    });
  });
});
