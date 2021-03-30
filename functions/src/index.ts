// import dependencies
const admin = require("firebase-admin");

// initilize
admin.initializeApp();

// Expose Express API as a single Cloud Function:
exports.ride = require("./ride");
