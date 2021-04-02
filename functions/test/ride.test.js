// reference: https://firebase.google.com/docs/functions/unit-testing?authuser=1
// initialize firebase-functions-test
const test = require("firebase-functions-test")(
  {
    databaseURL: "https://venni-rider-test-default-rtdb.firebaseio.com/",
    storageBucket: "venni-rider-test.appspot.com",
    projectId: "venni-rider-test",
  },
  "../devAdminCredentials.json"
);

// TODO: mock functions config if necessary

// import functions
const myFunctions = require("../src/ride.ts");

// wrap functions
const wrappedWidgets = test.wrap(myFunctions.widgets);

// for reference: https://github.com/firebase/functions-samples/blob/master/quickstarts/uppercase/functions/test/test.online.js
