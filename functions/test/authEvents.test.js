const firebaseFunctionsTest = require("firebase-functions-test");
const admin = require("firebase-admin");
const chai = require("chai");

const assert = chai.assert;

const test = firebaseFunctionsTest(
  {
    databaseURL:
      "https://venni-rider-development-8a3f8-default-rtdb.firebaseio.com/",
    storageBucket: "venni-rider-development-8a3f8.appspot.com",
    projectId: "venni-rider-development-8a3f8",
    databaseURL:
      "https://venni-rider-development-8a3f8-default-rtdb.firebaseio.com/",
  },
  "./devAdminCredentials.json"
);

describe("authEvents", () => {
  let authEvents;

  before(() => {
    if (admin.apps.length == 0) {
      admin.initializeApp();
    }
    authEvents = require("../lib/authEvents");
  });

  after(() => {
    test.cleanup();
  });

  describe("clean_user_data", () => {
    let clean_user_data;
    let defaultUID;
    let defaultTripRequest;

    before(() => {
      clean_user_data = test.wrap(authEvents.clean_user_data);
      defaultUID = "defaultUID";
      defaultTripRequest = {
        uid: defaultUID,
      };
    });

    beforeEach(async () => {
      // set up realtime database
      await admin
        .database()
        .ref("trip-requests")
        .child(defaultUID)
        .set(defaultTripRequest);
    });

    it("deletes user's data when invoked", async () => {
      // verify that user has data on realtime database
      let snapshot = await admin
        .database()
        .ref("trip-requests")
        .child(defaultUID)
        .once("value");
      assert.strictEqual(snapshot.val().uid, defaultUID);

      // trigger clean_user_data
      clean_user_data({ uid: defaultUID }, {});

      // verify that user has no data on realtime database
      snapshot = await admin
        .database()
        .ref("trip-requests")
        .child(defaultUID)
        .once("value");
      assert(snapshot.val() == null);
    });
  });
});
