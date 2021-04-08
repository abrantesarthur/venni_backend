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
  let default_origin_longitude;
  let default_origin_latitude;
  let createTripRequest;
  let defaultUID;

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
    default_origin_longitude = "17.485672";
    default_origin_latitude = "-46.576438"
    // createTripRequest populates the database with request
    createTripRequest = async () => {
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

    const ivalidPlaceIDTest = async (data, argumentName) => {
      await genericTest(
        data,
        "invalid-argument",
        "argument " +
          argumentName +
          " must be a string with length greater than 0."
      );
    };

    const invalidCoordinatesTest = async (data, message) => {
      await genericTest(
        data,
        "invalid-argument",
        message
      )
    }

    it("origin_latitude argument must be present", async () => {
      await invalidCoordinatesTest(
        {
          origin_place_id: valid_origin_place_id,
          destination_place_id: valid_destination_place_id,
          origin_longitude: default_origin_longitude,
        },
        "argument origin_latitude is missing."
      )
    });

    it("origin_latitude argument must be numeric", async () => {
      await invalidCoordinatesTest(
        {
          origin_place_id: valid_origin_place_id,
          destination_place_id: valid_destination_place_id,
          origin_longitude: default_origin_longitude,
          origin_latitude: "abc",
        },
        "argument origin_latitude can't be parsed to a number."
      )
    });

    it("origin_longitude argument must be present", async () => {
      await invalidCoordinatesTest(
        {
          origin_place_id: valid_origin_place_id,
          destination_place_id: valid_destination_place_id,
          origin_latitude: default_origin_latitude,
        },
        "argument origin_longitude is missing."
      )
    });

    it("origin_longitude argument must be numeric", async () => {
      await invalidCoordinatesTest(
        {
          origin_place_id: valid_origin_place_id,
          destination_place_id: valid_destination_place_id,
          origin_latitude: default_origin_latitude,
          origin_longitude: "abc",
        },
        "argument origin_longitude can't be parsed to a number."
      )
    });

    it("destination_place_id argument must be present", async () => {
      await ivalidPlaceIDTest(
        {
          origin_place_id: "origin_place_id",
          origin_latitude: default_origin_latitude,
          origin_longitude: default_origin_longitude,
        },
        "destination_place_id"
      );
    });

    it("destination_place_id argument must not be empty", async () => {
      await ivalidPlaceIDTest(
        {
          destination_place_id: "",
          origin_place_id: "origin_place_id",
          origin_latitude: default_origin_latitude,
          origin_longitude: default_origin_longitude,
        },
        "destination_place_id"
      );
    });

    it("destination_place_id must have correct type", async () => {
      await ivalidPlaceIDTest(
        {
          destination_place_id: 1,
          origin_place_id: "origin_place_id",
          origin_latitude: default_origin_latitude,
          origin_longitude: default_origin_longitude,
        },
        "destination_place_id"
      );
    });

    it("origin_place_id argument must be present", async () => {
      await ivalidPlaceIDTest(
        {
          destination_place_id: "destination_place_id",
          origin_latitude: default_origin_latitude,
          origin_longitude: default_origin_longitude,
        },
        "origin_place_id"
      );
    });

    it("origin_place_id argument must not be empty", async () => {
      await ivalidPlaceIDTest(
        {
          destination_place_id: "destination_place_id",
          origin_place_id: "",
          origin_latitude: default_origin_latitude,
          origin_longitude: default_origin_longitude,
        },
        "origin_place_id"
      );
    });

    it("origin_place_id must have correct type", async () => {
      await ivalidPlaceIDTest(
        {
          destination_place_id: "destination_place_id",
          origin_place_id: 1,
          origin_latitude: default_origin_latitude,
          origin_longitude: default_origin_longitude,
        },
        "origin_place_id"
      );
    });

    it("origin_place_id and destination_place_id must be different", async () => {
      genericTest(
        {
          origin_place_id: "same_id",
          destination_place_id: "same_id",
          origin_latitude: default_origin_latitude,
          origin_longitude: default_origin_longitude,
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
          origin_latitude: default_origin_latitude,
          origin_longitude: default_origin_longitude,
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
          origin_latitude: default_origin_latitude,
          origin_longitude: default_origin_longitude,
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
          origin_latitude: default_origin_latitude,
          origin_longitude: default_origin_longitude,
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
          origin_latitude: default_origin_latitude,
          origin_longitude: default_origin_longitude,
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

  // describe("cancel", () => {
  //   let cancelTrip;

  //   before(() => {
  //     cancelTrip = test.wrap(trip.cancel);
  //   })

  //   it("user must be authenticated", async () => {
  //     const db = admin.database().ref("trip-requests").child(defaultUID);

  //     // set database to have valid ride request using valid_destination_place_id
  //     await createTripRequest();

  //     // expect detination_place_id to be valid_destination_place_id
  //     snapshot = await db.once("value");
  //     assert.strictEqual(
  //       snapshot.val().destination_place_id,
  //       valid_destination_place_id
  //     );

  //     // run test editing destination_place_id
  //     await genericTest(
  //       {
  //         origin_place_id: valid_origin_place_id,
  //         destination_place_id: new_destination_place_id,
  //       },
  //       "",
  //       "",
  //       defaultCtx,
  //       true
  //     );

  //     // expect database to be populated
  //     snapshot = await db.once("value");
  //     assert.isTrue(
  //       snapshot.val() != null,
  //       "trip reqeust was successfully created on database"
  //     );

  //     // expect detination_place_id to have been updated
  //     assert.strictEqual(
  //       snapshot.val().destination_place_id,
  //       new_destination_place_id
  //     );

  //     // reset the database
  //     admin.database().ref("trip-requests").remove();
  //   });
  // });
});
