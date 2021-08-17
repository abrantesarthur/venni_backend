// import dependencies
import * as admin from "firebase-admin";

/**
 * initializeApp uses the Application Default Credentials library to find service account credentials.
 * The project, then, uses these credentials to call Google Cloud API's. It first looks for the
 * GOOGLE_APPLICATION_CREDENTIALS. Otherwise, it uses the service account that is attached to the
 * resource that is running your code. Otherwise, it uses the default service account that Cloud Functions
 * provide.
 *
 * Additionally, some environment variables are automatically populated in the functions runtime and
 * locally emulated functions (e.g., FIREBASE_CONFIG variable). These are applied automatically when
 * initializeApp is called.
 */
admin.initializeApp();

// Expose Express API as a single Cloud Function:
exports.trip = require("./trip");
exports.database_events = require("./databaseEvents");
exports.payment = require("./payment");
exports.account = require("./account");
exports.partner = require("./partner");
exports.scheduled_function = require("./scheduledFunctions");
exports.demand_by_zone = require("./demandByZone");

// mocks
exports.mock = require("./mock");
