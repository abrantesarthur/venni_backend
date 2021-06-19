// const tr = require("../lib/database/tripRequest");
// const chai = require("chai");

// const assert = chai.assert;

// describe("TripRequest.Interface", () => {
//   describe("is", () => {
//     let validArg;

//     beforeEach(() => {
//       validArg = {
//         uid: "uid",
//         trip_status: "waiting-confirmation",
//         origin_place_id: "origin_place_id",
//         destination_place_id: "destination_place_id",
//         origin_zone: "AA",
//         fare_price: 500,
//         distance_meters: "123",
//         distance_text: "123 meters",
//         duration_seconds: "300",
//         duration_text: "5 minutes",
//         encoded_points: "encoded_points",
//         request_time: "124759",
//         origin_address: "origin_address",
//         destination_address: "destination_address",
//         partner_rating: {
//           score: "2",
//           safety_went_well: true,
//           cleanliness_went_well: false,
//           feedback: "good trip!",
//         },
//       };
//     });
//     it("returns false when object is undefined", () => {
//       assert.equal(tr.TripRequest.Interface.is(undefined), false);
//     });
//     it("returns false when object is null", () => {
//       assert.equal(tr.TripRequest.Interface.is(null), false);
//     });

//     // test required fields presence
//     const falseIfNotPresent = (field) => {
//       it("returns false if '" + field + "' is not present", () => {
//         let invalidArg = validArg;
//         delete invalidArg[field];
//         assert.equal(tr.TripRequest.Interface.is(invalidArg), false);
//       });
//     };
//     falseIfNotPresent("uid");
//     falseIfNotPresent("trip_status");
//     falseIfNotPresent("origin_place_id");
//     falseIfNotPresent("destination_place_id");
//     falseIfNotPresent("origin_zone");
//     falseIfNotPresent("fare_price");
//     falseIfNotPresent("distance_meters");
//     falseIfNotPresent("distance_text");
//     falseIfNotPresent("duration_seconds");
//     falseIfNotPresent("duration_text");
//     falseIfNotPresent("encoded_points");
//     falseIfNotPresent("request_time");
//     falseIfNotPresent("origin_address");
//     falseIfNotPresent("destination_address");

//     // test required fields types
//     // TODO: move to utils
//     const falseIfWronglyTyped = (field, wrongValue) => {
//       it("returns false if '" + field + "' has wrong type", () => {
//         let invalidArg = validArg;
//         invalidArg[field] = wrongValue;
//         assert.equal(tr.TripRequest.Interface.is(invalidArg), false);
//       });
//     };
//     falseIfWronglyTyped("uid", 123);
//     falseIfWronglyTyped("trip_status", 123);
//     falseIfWronglyTyped("origin_place_id", 123);
//     falseIfWronglyTyped("destination_place_id", 123);
//     falseIfWronglyTyped("origin_zone", "not valid");
//     falseIfWronglyTyped("fare_price", "not a number");
//     falseIfWronglyTyped("distance_meters", "not numeric");
//     falseIfWronglyTyped("distance_text", 123);
//     falseIfWronglyTyped("duration_seconds", "not numeric");
//     falseIfWronglyTyped("duration_text", 123);
//     falseIfWronglyTyped("encoded_points", 123);
//     falseIfWronglyTyped("request_time", "not numeric");
//     falseIfWronglyTyped("origin_address", 123);
//     falseIfWronglyTyped("destination_address", 123);

//     // test optional fields types
//     const falseIfOptionalWronglyTyped = (field, wrongValue) => {
//       it(
//         "returns false if, '" + field + "', is present and has wrong type",
//         () => {
//           let invalidArg = validArg;
//           invalidArg[field] = wrongValue;
//           assert.equal(tr.TripRequest.Interface.is(invalidArg), false);
//           delete invalidArg[field];
//           assert.equal(tr.TripRequest.Interface.is(invalidArg), true);
//         }
//       );
//     };
//     falseIfOptionalWronglyTyped("partner_id", 123);
//     falseIfOptionalWronglyTyped("client_rating", "not numeric");
//     falseIfOptionalWronglyTyped("payment_method", "invalid");
//     falseIfOptionalWronglyTyped("credit_card", { id: "card_id" });
//     falseIfOptionalWronglyTyped("transaction_id", 123);

//     it("returns false if, partner_rating, if present, is not an object", () => {
//       let invalidArg = validArg;
//       invalidArg["partner_rating"] = "not an object";
//       assert.equal(tr.TripRequest.Interface.is(invalidArg), false);
//     });

//     it("returns false if, partner_rating, if present, has no score", () => {
//       let invalidArg = validArg;
//       invalidArg["partner_rating"] = {
//         cleanliness_went_well: true,
//       };
//       assert.equal(tr.TripRequest.Interface.is(invalidArg), false);
//     });

//     it("returns false if, partner_rating, if present, has invalid key", () => {
//       let invalidArg = validArg;
//       invalidArg["partner_rating"] = {
//         score: "2",
//         invalid_key: true,
//       };
//       assert.equal(tr.TripRequest.Interface.is(invalidArg), false);
//     });

//     it("returns true when object is TripRequest.Interface", () => {
//       assert.equal(tr.TripRequest.Interface.is(validArg), true);
//     });
//   });

//   describe("fromObj", () => {
//     let validArg;

//     beforeEach(() => {
//       validArg = {
//         uid: "uid",
//         trip_status: "waiting-confirmation",
//         origin_place_id: "origin_place_id",
//         destination_place_id: "destination_place_id",
//         origin_zone: "AA",
//         fare_price: 500,
//         distance_meters: "123",
//         distance_text: "123 meters",
//         duration_seconds: "300",
//         duration_text: "5 minutes",
//         encoded_points: "encoded_points",
//         request_time: "124759",
//         origin_address: "origin_address",
//         destination_address: "destination_address",
//         partner_past_trip_ref_key: "partner_past_trip_ref_key",
//         partner_id: "partner_id",
//         client_rating: "4.0",
//         payment_method: "credit_card",
//         credit_card: {
//           id: "card_id",
//           holder_name: "Fulano de Tal",
//           first_digits: "524345",
//           last_digits: "8907",
//           expiration_date: "1123",
//           brand: "visa",
//           pagarme_customer_id: 12345,
//           billing_address: {
//             country: "br",
//             state: "mg",
//             city: "paracatu",
//             street: "rua i",
//             street_number: "31",
//             zipcode: "38600000",
//           },
//         },
//         transaction_id: "transaction_id",
//         partner_rating: {
//           score: "2",
//           safety_went_well: true,
//           cleanliness_went_well: false,
//           feedback: "good trip!",
//         },
//       };
//     });

//     it("returns undefined if obj is null", () => {
//       assert.isUndefined(tr.TripRequest.Interface.fromObj(null));
//     });
//     it("returns undefined if obj is undefined", () => {
//       assert.isUndefined(tr.TripRequest.Interface.fromObj(undefined));
//     });

//     it("returns TripRequest.Interface if obj is TripRequest.Interface", () => {
//       const response = tr.TripRequest.Interface.fromObj(validArg);
//       assert.isDefined(response);
//       assert.equal(response.uid, "uid");
//       assert.equal(response.trip_status, "waiting-confirmation");
//       assert.equal(response.origin_place_id, "origin_place_id");
//       assert.equal(response.destination_place_id, "destination_place_id");
//       assert.equal(response.origin_zone, "AA");
//       assert.equal(response.fare_price, "500");
//       assert.equal(response.distance_meters, "123");
//       assert.equal(response.distance_text, "123 meters");
//       assert.equal(response.duration_seconds, "300");
//       assert.equal(response.duration_text, "5 minutes");
//       assert.equal(response.encoded_points, "encoded_points");
//       assert.equal(response.request_time, "124759");
//       assert.equal(response.origin_address, "origin_address");
//       assert.equal(response.destination_address, "destination_address");
//       assert.isDefined(response.partner_rating);
//       assert.equal(response.partner_rating.score, "2");
//       assert.equal(response.partner_rating.cleanliness_went_well, false);
//       assert.equal(response.partner_rating.safety_went_well, true);
//       assert.equal(response.partner_rating.waiting_time_went_well, undefined);
//       assert.equal(response.partner_rating.feedback, "good trip!");
//       assert.equal(
//         response.partner_past_trip_ref_key,
//         "partner_past_trip_ref_key"
//       );
//       assert.equal(response.partner_id, "partner_id");
//       assert.equal(response.payment_method, "credit_card");
//       assert.equal(response.client_rating, "4.0");
//       assert.isDefined(response.credit_card);
//       assert.equal(response.transaction_id, "transaction_id");
//     });
//   });
// });
