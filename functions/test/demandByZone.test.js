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

describe("demandByZone", () => {
  let demandByZone;

  before(async () => {
    if (admin.apps.length == 0) {
      admin.initializeApp();
    }
    demandByZone = require("../lib/demandByZone");
  });

  describe("get", () => {
    const genericTest = async (
      data,
      expectedCode,
      expectedMessage,
      ctx = defaultCtx,
      succeeed = false
    ) => {
      const wrapped = test.wrap(demandByZone.get);
      try {
        await wrapped(data, ctx);
        if (succeeed) {
          assert(true, "demandByZone.get finished successfully");
        } else {
          assert(false, "demandByZone.get didn't throw expected error");
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
  });
});
