const firebaseFunctionsTest = require("firebase-functions-test");
const admin = require("firebase-admin");
const chai = require("chai");
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

describe("partner", () => {
  let partner;
  let partnerID;
  let clientID;
  let defaultCtx;

  before(() => {
    if (admin.apps.length == 0) {
      admin.initializeApp();
    }
    partner = require("../lib/partner");
    partnerID = "partnerID";
    clientID = "clientID";
    defaultCtx = {
      auth: {
        uid: partnerID,
      },
    };
  });

  after(async () => {
    // clear database
    const p = new Partner(partnerID);
    await p.remove();
  });

  describe("connect", () => {
    let defaultPartner;
    beforeEach(() => {
      defaultPartner = {
        uid: partnerID,
        name: "name",
        last_name: "last_name",
        cpf: "00000000000",
        gender: "masculino",
        member_since: (Date.now() - 100000000).toString(),
        phone_number: "phone_number",
        current_zone: "AA",
        status: "unavailable",
        account_status: "approved",
        current_client_uid: clientID,
        vehicle: {
          brand: "brand",
          model: "model",
          year: 1999,
          plate: "plate",
        },
        idle_since: (Date.now() - 100000).toString(),
        rating: "rating",
        pagarme_recipient_id: "pagarme_received_id",
        amount_owed: 2,
      };
    });
    const genericTest = async (
      data,
      expectedCode,
      expectedMessage,
      ctx = defaultCtx,
      succeeed = false
    ) => {
      const wrapped = test.wrap(partner.connect);
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
      await genericTest(
        {
          current_latitude: 10.123456,
          current_longitude: 10.123456,
        },
        "failed-precondition",
        "Missing authentication credentials.",
        {}
      );
    });

    it("fails if missing 'current_longitude' argument", async () => {
      await genericTest(
        {
          current_latitude: 10.123456,
        },
        "invalid-argument",
        "missing expected argument 'current_longitude'."
      );
    });

    it("fails if missing 'current_latitude' argument", async () => {
      await genericTest(
        {
          current_longitude: 10.123456,
        },
        "invalid-argument",
        "missing expected argument 'current_latitude'."
      );
    });

    it("fails if 'current_latitude' is not a number", async () => {
      await genericTest(
        {
          current_latitude: "10.123456",
          current_longitude: 10.123456,
        },
        "invalid-argument",
        "argument 'current_latitude' has invalid type. Expected 'number'. Received 'string'."
      );
    });

    it("fails if 'current_longitude' is not a number", async () => {
      await genericTest(
        {
          current_latitude: 10.123456,
          current_longitude: "10.123456",
        },
        "invalid-argument",
        "argument 'current_longitude' has invalid type. Expected 'number'. Received 'string'."
      );
    });

    it("fails if partner doesn't exist", async () => {
      await genericTest(
        {
          current_latitude: 10.123456,
          current_longitude: 10.123456,
        },
        "not-found",
        "could not find partner with uid partnerID"
      );
    });

    it("fails if partner has 'account_status' different from 'available'", async () => {
      // add partner with 'locked' account_status
      defaultPartner.account_status = "locked";
      const p = new Partner(partnerID);
      await p.update(defaultPartner);
      await genericTest(
        {
          current_latitude: 10.123456,
          current_longitude: 10.123456,
        },
        "failed-precondition",
        "partner with uid partnerID doesn't have an 'approved' account"
      );
    });

    it("fails if partner has 'status' different from 'unavailable'", async () => {
      // add partner with 'locked' account_status
      defaultPartner.status = "busy";
      const p = new Partner(partnerID);
      await p.update(defaultPartner);
      await genericTest(
        {
          current_latitude: 10.123456,
          current_longitude: 10.123456,
        },
        "failed-precondition",
        "partner with uid partnerID doesn't have 'unavailable' status"
      );
    });

    it("sets partner's position and status to 'available' if succeeds", async () => {
      // add partner with 'locked' account_status
      const p = new Partner(partnerID);
      await p.update(defaultPartner);

      // before calling connect, partner has no position and status is 'unavailable'
      let partnerData = await p.getPartner();
      assert.isDefined(partnerData);
      assert.isUndefined(partnerData.current_latitude);
      assert.isUndefined(partnerData.current_longitude);
      assert.equal(partnerData.status, "unavailable");

      // connect
      await genericTest(
        {
          current_latitude: 10.123456,
          current_longitude: 10.123456,
        },
        "",
        "",
        defaultCtx,
        true
      );

      // after calling connect, partner has position and status is 'available'
      partnerData = await p.getPartner();
      assert.isDefined(partnerData);
      assert.equal(partnerData.current_latitude, "10.123456");
      assert.equal(partnerData.current_longitude, "10.123456");
      assert.equal(partnerData.status, "available");
    });
  });
});
