// reference: https://firebase.google.com/docs/functions/unit-testing?authuser=1
// initialize firebase-functions-test
const firebaseFunctionsTest = require("firebase-functions-test");
const admin = require("firebase-admin");
const chai = require("chai");
const assert = chai.assert;

// the tests actually hit venni-rider-development project in firebase
const test = firebaseFunctionsTest(
  {
    databaseURL:
      "https://venni-rider-development-8a3f8-default-rtdb.firebaseio.com/",
    projectId: "venni-rider-development-8a3f8",
    storageBucket: "venni-rider-development-8a3f8.appspot.com",
    storageBucket: "venni-rider-development-8a3f8.appspot.com",
  },
  "./devAdminCredentials.json"
);

describe("trip", () => {
  let trip;
  let defaultCtx;
  let valid_origin_place_id;
  let valid_destination_place_id;

  before(() => {
    if (admin.apps.length == 0) {
      admin.initializeApp();
    }
    trip = require("../lib/trip");
    defaultCtx = {
      auth: {
        uid: "any uid",
      },
    };
    valid_origin_place_id = "ChIJzY-urWVKqJQRGA8-aIMZJ4I";
    valid_destination_place_id = "ChIJ31rnOmVKqJQR8FM30Au7boM";
  });

  after(() => {
    // do cleanup tasks
    test.cleanup();
  });

  describe("request", () => {
    afterEach(() => {
      // reset the database
      admin.database().ref("trip-requests").remove();
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

    const invalidArgumentTest = async (data, argumentName) => {
      await genericTest(
        data,
        "invalid-argument",
        "argument " +
          argumentName +
          " must be a string with length greater than 0."
      );
    };

    it("destination_place_id argument must be present", async () => {
      await invalidArgumentTest(
        {
          origin_place_id: "origin_place_id",
        },
        "destination_place_id"
      );
    });

    it("destination_place_id argument must not be empty", async () => {
      await invalidArgumentTest(
        {
          destination_place_id: "",
          origin_place_id: "origin_place_id",
        },
        "destination_place_id"
      );
    });

    it("destination_place_id must have correct type", async () => {
      await invalidArgumentTest(
        {
          destination_place_id: 1,
          origin_place_id: "origin_place_id",
        },
        "destination_place_id"
      );
    });

    it("origin_place_id argument must be present", async () => {
      await invalidArgumentTest(
        {
          destination_place_id: "destination_place_id",
        },
        "origin_place_id"
      );
    });

    it("origin_place_id argument must not be empty", async () => {
      await invalidArgumentTest(
        {
          destination_place_id: "destination_place_id",
          origin_place_id: "",
        },
        "origin_place_id"
      );
    });

    it("origin_place_id must have correct type", async () => {
      await invalidArgumentTest(
        {
          destination_place_id: "destination_place_id",
          origin_place_id: 1,
        },
        "origin_place_id"
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

  describe("edit", () => {
    let defaultUID;

    before(async () => {
      // initialize variables
      defaultUID = "defaultUID";
    });

    after(() => {
      // reset the database
      admin.database().ref("trip-requests").remove();
    });

    const genericTest = async (
      data,
      expectedCode,
      expectedMessage,
      ctx = defaultCtx,
      succeeed = false
    ) => {
      const wrapped = test.wrap(trip.edit);
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

    const invalidArgumentTest = async (data, argumentName) => {
      await genericTest(
        data,
        "invalid-argument",
        "argument " +
          argumentName +
          " must be a string with length greater than 0."
      );
    };

    it("destination_place_id argument must be present", async () => {
      await invalidArgumentTest(
        {
          origin_place_id: "origin_place_id",
        },
        "destination_place_id"
      );
    });

    it("destination_place_id argument must not be empty", async () => {
      await invalidArgumentTest(
        {
          destination_place_id: "",
          origin_place_id: "origin_place_id",
        },
        "destination_place_id"
      );
    });

    it("destination_place_id must have correct type", async () => {
      await invalidArgumentTest(
        {
          destination_place_id: 1,
          origin_place_id: "origin_place_id",
        },
        "destination_place_id"
      );
    });

    it("origin_place_id argument must be present", async () => {
      await invalidArgumentTest(
        {
          destination_place_id: "destination_place_id",
        },
        "origin_place_id"
      );
    });

    it("origin_place_id argument must not be empty", async () => {
      await invalidArgumentTest(
        {
          destination_place_id: "destination_place_id",
          origin_place_id: "",
        },
        "origin_place_id"
      );
    });

    it("origin_place_id must have correct type", async () => {
      await invalidArgumentTest(
        {
          destination_place_id: "destination_place_id",
          origin_place_id: 1,
        },
        "origin_place_id"
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

    it("throws 'not-found' if user already has not active trip request", async () => {
      // set database to not have trip request for the user
      await admin.database().ref("trip-requests").child(defaultUID).remove();

      // run test with specified ui and expect 'not-found' error
      await genericTest(
        {
          origin_place_id: "some_origin_place_id",
          destination_place_id: "some_destination_place_id",
        },
        "not-found",
        "The user already has no active trip request",
        {
          auth: {
            uid: defaultUID,
          },
        }
      );
    });

    const createTripRequest = async () => {
      let defaultTripRequest = {
        uid: defaultUID,
        origin_place_id: valid_origin_place_id,
        destination_place_id: valid_destination_place_id,
      };
      await admin
        .database()
        .ref("trip-requests")
        .child(defaultUID)
        .set(defaultTripRequest);
    };

    it("throws 'invalid-argument' if user provides invalid destination_place_id", async () => {
      // set database to have valid trip request
      await createTripRequest();

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
            uid: defaultUID,
          },
        }
      );

      // reset database
      await admin.database().ref("trip-requests").child(defaultUID).remove();
    });

    it("throws 'invalid-argument' if user provides invalid origin_place_id", async () => {
      // set database to have valid trip request
      await createTripRequest();

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
            uid: defaultUID,
          },
        }
      );

      // reset database
      await admin.database().ref("trip-requests").child(defaultUID).remove();
    });

    it("succeed when all parameters are valid", async () => {
      const new_destination_place_id = "ChIJwyTrjnRKqJQRxHOnccCdkws";
      const db = admin.database().ref("trip-requests").child(defaultUID);

      // set database to have valid ride request using valid_destination_place_id
      await createTripRequest();

      // expect detination_place_id to be valid_destination_place_id
      snapshot = await db.once("value");
      assert.strictEqual(
        snapshot.val().destination_place_id,
        valid_destination_place_id
      );

      // run test editing destination_place_id
      await genericTest(
        {
          origin_place_id: valid_origin_place_id,
          destination_place_id: new_destination_place_id,
        },
        "",
        "",
        {
          auth: {
            uid: defaultUID,
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

      // expect detination_place_id to have been updated
      assert.strictEqual(
        snapshot.val().destination_place_id,
        new_destination_place_id
      );

      // reset the database
      admin.database().ref("trip-requests").remove();
    });
  });
});
