const { app } = require("firebase-functions");

function calculateFare(distanceMeters) {
  if (distanceMeters <= 1500) {
    return 4;
  }
  if (distanceMeters > 1500 && distanceMeters < 10) {
    return 0.67 * distanceMeters + 3;
  }
  return (0.7 * distanceMeters) / 1000 + 3;
}

exports.calculateFare = calculateFare;
