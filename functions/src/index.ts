// import dependencies
import * as admin from "firebase-admin";

/**
 * initializeApp uses the Application Default Credentials library to find service account credentials.
 * the project, then, uses these credentials to call Google Cloud API's. It first looks for the
 * GOOGLE_APPLICATION_CREDENTIALS. Otherwise, it uses the service account that is attached to the
 * resource that is running your code. Otherwise, it uses the default service account that Cloud Functions
 * provide.
 */
admin.initializeApp();

// Expose Express API as a single Cloud Function:
exports.ride = require("./ride");
