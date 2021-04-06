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

  describe("cleanUserData", () => {
    let cleanUserData;
    let defaultUID;
    let defaultRideRequest;

    before(() => {
      cleanUserData = test.wrap(authEvents.cleanUserData);
      defaultUID = "defaultUID";
      defaultRideRequest = {
        uid: defaultUID,
      };
    });

    beforeEach(async () => {
      // set up realtime database and storage
      await admin
        .database()
        .ref("ride-requests")
        .child(defaultUID)
        .set(defaultRideRequest);
    });

    it("deletes user's data when invoked", async () => {
      // verify that user has data on realtime database
      let snapshot = await admin
        .database()
        .ref("ride-requests")
        .child(defaultUID)
        .once("value");
      assert.strictEqual(snapshot.val().uid, defaultUID);

      // trigger cleanUserData
      cleanUserData({ uid: defaultUID }, {});

      // verify that user has no data on realtime database
      snapshot = await admin
        .database()
        .ref("ride-requests")
        .child(defaultUID)
        .once("value");
      assert(snapshot.val() == null);
    });
  });
});
