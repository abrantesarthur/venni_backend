const functions = require("firebase-functions");
const express = require("express");

// connect to firebase server
const admin = require("firebase-admin");
admin.initializeApp();

// define the application
const app = express();

app.get("/", (req, res) => {
  // send response
  res.status(200).json({message: "OK"});

});

// Expose Express API as a single Cloud Function:
exports.createFakeUser = functions.https.onRequest(app)
