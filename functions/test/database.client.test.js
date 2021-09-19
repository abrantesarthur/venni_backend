// const Client = require("../lib/database/client");
// const chai = require("chai");
// const admin = require("firebase-admin");
// const { ClientPastTrips } = require("../lib/database/pastTrips");

// const assert = chai.assert;

// describe("Client", () => {
//   before(() => {
//     if (admin.apps.length == 0) {
//       admin.initializeApp();
//     }
//   });

//   describe("Class", () => {
//     let c;
//     let clientID;
//     let partnerID;
//     let defaultClient;
//     let defaultTrip;
//     let defaultCard;
//     before(async () => {
//       clientID = "clientID";
//       partnerID = "partnerID";
//       defaultCard = {
//         id: "card_id",
//         holder_name: "Fulano de Tal",
//         first_digits: "523469",
//         last_digits: "1234",
//         expiration_date: "1131",
//         brand: "visa",
//         pagarme_customer_id: 12345,
//         billing_address: {
//           country: "country",
//           state: "state",
//           city: "city",
//           street: "street",
//           street_number: "street_number",
//           zipcode: "zipcode",
//         },
//       };
//       defaultClient = {
//         uid: clientID,
//         payment_method: {
//           default: "cash",
//         },
//         rating: "5",
//       };
//       defaultTrip = {
//         uid: clientID,
//         partner_id: partnerID,
//         trip_status: "waiting-confirmation",
//         origin_place_id: "origin_place_id",
//         destination_place_id: "destination_place_id",
//         origin_lat: "11.111111",
//         origin_lng: "22.222222",
//         destination_lat: "33.333333",
//         destination_lng: "44.444444",
//         origin_zone: "AA",
//         destination_zone: "AA",
//         fare_price: 500,
//         distance_meters: "123",
//         distance_text: "123 meters",
//         duration_seconds: "300",
//         duration_text: "5 minutes",
//         encoded_points: "encoded_points",
//         request_time: "124759",
//         origin_address: "origin_address",
//         destination_address: "destination_address",
//       };
//       c = new Client.Client(clientID);

//       // clear database
//       await admin.database().ref("clients").remove();
//       await admin.database().ref("past-trips").remove();
//     });

//     after(async () => {
//       // clear database
//       await admin.database().ref("clients").remove();
//       await admin.database().ref("past-trips").remove();
//     });

//     describe("getClient", () => {
//       it("returns undefined if there is no client in database", async () => {
//         let result = await c.getClient();
//         assert.isUndefined(result);
//       });

//       it("returns Client.Interface if there is a client in database", async () => {
//         // add client to the database
//         await admin
//           .database()
//           .ref("clients")
//           .child(clientID)
//           .set({
//             uid: clientID,
//             rating: "5",
//             payment_method: {
//               default: "cash",
//             },
//             cards: {
//               card_id: defaultCard,
//             },
//           });
//         // assert client was returned
//         let result = await c.getClient();
//         assert.isDefined(result);
//         assert.equal(result.uid, clientID);
//         assert.equal(result.rating, "5");
//         assert.equal(result.cards.length, 1);
//         assert.equal(result.cards[0].id, "card_id");
//         assert.equal(result.cards[0].brand, "visa");
//         assert.equal(result.cards[0].last_digits, "1234");
//         assert.equal(result.cards[0].pagarme_customer_id, 12345);
//         assert.isDefined(result.cards[0].billing_address);
//         // clear database
//         await admin.database().ref("clients").remove();
//       });
//     });

//     describe("addClient", () => {
//       it("returns Client.Interface if there is a client in database", async () => {
//         // assert there is no client in database
//         let result = await c.getClient();
//         assert.isUndefined(result);
//         // add client to the database
//         await c.addClient(defaultClient);
//         // assert a client was added
//         result = await c.getClient();
//         assert.isDefined(result);
//         // clear database
//         await admin.database().ref("clients").remove();
//       });
//     });

//     describe("pushPastTripAndRate", () => {
//       it("pushes a past trip with client_rating to client's list of past trips", async () => {
//         // assert client has no past trips
//         let cpt = new ClientPastTrips(clientID);
//         let pastTripsCount = await cpt.getPastTripsCount();
//         assert.equal(pastTripsCount, 0);

//         // call pushPastTripAndRate
//         await c.pushPastTripAndRate(defaultTrip, 2);

//         // assert client now has a past trip with client_rating
//         let pastTrips = await cpt.getPastTrips();
//         assert.equal(pastTrips.length, 1);
//         assert.equal(pastTrips[0].client_rating, "2.00");

//         // clear database
//         await admin.database().ref("past-trips").remove();
//       });

//       it("rates clients with a 5 when they have less than 5 past trips", async () => {
//         // add client to database
//         await c.addClient(defaultClient);

//         let result = await c.getClient();
//         assert.isDefined(result);

//         // call pushPastTripAndRate
//         let rate = 2;
//         await c.pushPastTripAndRate(defaultTrip, rate);

//         // after rating,because client has less than 5 trips, his rating is 5

//         result = await c.getClient();
//         assert.isDefined(result);
//         assert.equal(result.rating, "5.00");

//         // clear database
//         await admin.database().ref("clients").remove();
//         await admin.database().ref("past-trips").remove();
//       });
//     });

//     describe("addCard", () => {
//       it("adds card to the database", async () => {
//         // add client to the database
//         await c.addClient(defaultClient);
//         // assert client has no cards
//         let cards = await c.getCards();
//         assert.isEmpty(cards);
//         // add card to database
//         await c.addCard({
//           id: "card_id",
//           holder_name: "Fulano de Tal",
//           first_digits: "523445",
//           last_digits: "1234",
//           expiration_date: "1131",
//           brand: "mastercard",
//           pagarme_customer_id: 12345,
//           billing_address: {
//             country: "country",
//             state: "state",
//             city: "city",
//             street: "street",
//             street_number: "street_number",
//             zipcode: "zipcode",
//           },
//         });
//         // assert client has a card
//         let card = await c.getCardByID("card_id");
//         assert.isDefined(card);
//         assert.equal(card.id, "card_id");
//         assert.equal(card.brand, "mastercard");
//         assert.equal(card.last_digits, "1234");
//         assert.equal(card.last_digits, "1234");
//         assert.equal(card.holder_name, "Fulano de Tal");
//         assert.equal(card.first_digits, "523445");
//         assert.equal(card.expiration_date, "1131");
//         assert.equal(card.pagarme_customer_id, 12345);
//         assert.isDefined(card.billing_address);
//         assert.equal(card.billing_address.country, "country");
//         assert.equal(card.billing_address.state, "state");
//         assert.equal(card.billing_address.city, "city");
//         assert.equal(card.billing_address.street, "street");
//         assert.equal(card.billing_address.street_number, "street_number");
//         assert.equal(card.billing_address.zipcode, "zipcode");

//         // clear database
//         await admin.database().ref("clients").remove();
//       });
//     });

//     describe("getCardByID", () => {
//       it("returns undefined if client has no cards", async () => {
//         // add client to the database
//         await c.addClient(defaultClient);
//         // assert getCardByID returns undefined
//         let card = await c.getCardByID("card_id");
//         assert.isUndefined(card);
//         // clear database
//         await admin.database().ref("clients").remove();
//       });

//       it("returns card if client has a card", async () => {
//         // add client to the database
//         await c.addClient(defaultClient);
//         // add card to database
//         await c.addCard({
//           id: "card_id",
//           brand: "elo",
//           holder_name: "Fulano de Tal",
//           first_digits: "523445",
//           expiration_date: "1131",
//           last_digits: "1234",
//           pagarme_customer_id: 12345,
//           billing_address: {
//             country: "country",
//             state: "state",
//             city: "city",
//             street: "street",
//             street_number: "street_number",
//             zipcode: "zipcode",
//           },
//         });
//         // assert client has a card
//         let card = await c.getCardByID("card_id");
//         assert.isDefined(card);
//         assert.equal(card.id, "card_id");
//         assert.equal(card.brand, "elo");
//         assert.equal(card.last_digits, "1234");
//         assert.equal(card.holder_name, "Fulano de Tal");
//         assert.equal(card.first_digits, "523445");
//         assert.equal(card.expiration_date, "1131");
//         assert.equal(card.pagarme_customer_id, 12345);
//         assert.isDefined(card.billing_address);
//         assert.equal(card.billing_address.country, "country");
//         assert.equal(card.billing_address.state, "state");
//         assert.equal(card.billing_address.city, "city");
//         assert.equal(card.billing_address.street, "street");
//         assert.equal(card.billing_address.street_number, "street_number");
//         assert.equal(card.billing_address.zipcode, "zipcode");

//         // clear database
//         await admin.database().ref("clients").remove();
//       });
//     });

//     describe("getCards", () => {
//       it("returns empty list if client has no cards", async () => {
//         // add client to the database
//         await c.addClient(defaultClient);
//         // assert getCardByID returns undefined
//         let card = await c.getCards("card_id");
//         assert.isEmpty(card);
//         // clear database
//         await admin.database().ref("clients").remove();
//       });

//       it("returns list of cards if client has cards", async () => {
//         // add client to the database
//         await c.addClient(defaultClient);
//         // add two cards to database
//         let defaultCard = {
//           id: "card_id",
//           brand: "visa",
//           holder_name: "Fulano de Tal",
//           first_digits: "523445",
//           expiration_date: "1131",
//           last_digits: "1234",
//           pagarme_customer_id: 12345,
//           billing_address: {
//             country: "country",
//             state: "state",
//             city: "city",
//             street: "street",
//             street_number: "street_number",
//             zipcode: "zipcode",
//           },
//         };
//         await c.addCard(defaultCard);
//         defaultCard.id = "card_id_2";
//         await c.addCard(defaultCard);

//         // assert client has two a card
//         let card = await c.getCards();
//         assert.equal(card.length, 2);
//         assert.equal(card[0].id, "card_id");
//         assert.equal(card[1].id, "card_id_2");
//         assert.equal(card[0].last_digits, "1234");
//         assert.equal(card[0].holder_name, "Fulano de Tal");
//         assert.equal(card[0].first_digits, "523445");
//         assert.equal(card[0].expiration_date, "1131");
//         assert.equal(card[0].brand, "visa");
//         assert.equal(card[0].pagarme_customer_id, 12345);
//         assert.isDefined(card[0].billing_address);
//         assert.equal(card[0].billing_address.country, "country");
//         assert.equal(card[0].billing_address.state, "state");
//         assert.equal(card[0].billing_address.city, "city");
//         assert.equal(card[0].billing_address.street, "street");
//         assert.equal(card[0].billing_address.street_number, "street_number");
//         assert.equal(card[0].billing_address.zipcode, "zipcode");

//         // clear database
//         await admin.database().ref("clients").remove();
//       });
//     });

//     describe("setPaymentMethod", async () => {
//       it("works", async () => {
//         // add client to the database
//         await c.addClient(defaultClient);

//         // assert payment method is credit card
//         let client = await c.getClient();

//         assert.isDefined(client);
//         assert.isDefined(client.payment_method);
//         assert.equal(client.payment_method.default, "cash");

//         // set payment method to credit_card
//         await c.setPaymentMethod("credit_card", "card_id");

//         // assert it worked
//         client = await c.getClient();
//         assert.isDefined(client);
//         assert.isDefined(client.payment_method);
//         assert.equal(client.payment_method.default, "credit_card");
//         assert.equal(client.payment_method.card_id, "card_id");

//         // set payment method back to "cash"
//         await c.setPaymentMethod("cash");

//         // assert it worked
//         client = await c.getClient();
//         assert.isDefined(client);
//         assert.isDefined(client.payment_method);
//         assert.equal(client.payment_method.default, "cash");
//         assert.isUndefined(client.payment_method.card_id);

//         // clear database
//         await admin.database().ref("clients").remove();
//       });
//     });

//     describe("setUnpaidTrip", async () => {
//       it("works", async () => {
//         // add client without unpaid trip to the database
//         await c.addClient(defaultClient);

//         // assert client has no unpaid trips
//         let client = c.getClient();
//         assert.isDefined(client);
//         assert.isUndefined(client.unpaid_past_trip_id);

//         // add unpaid past trip
//         await c.setUnpaidTrip("tripRefKey");

//         // assert it worked
//         client = await c.getClient();
//         assert.isDefined(client);
//         assert.equal(client.unpaid_past_trip_id, "tripRefKey");

//         // clear database
//         await admin.database().ref("clients").remove();
//       });
//     });
//   });

//   describe("Interface", () => {
//     describe("is", () => {
//       let validArg;

//       beforeEach(() => {
//         validArg = {
//           uid: "clientUID",
//           rating: "5",
//           payment_method: {
//             default: "cash",
//           },
//           cards: {
//             card_id: {
//               id: "card_id",
//               brand: "visa",
//               holder_name: "Fulano de Tal",
//               first_digits: "523445",
//               expiration_date: "1131",
//               last_digits: "1234",
//               pagarme_customer_id: 12345,
//               billing_address: {
//                 country: "country",
//                 state: "state",
//                 city: "city",
//                 street: "street",
//                 street_number: "street_number",
//                 zipcode: "zipcode",
//               },
//             },
//           },
//         };
//       });

//       it("returns false when object is undefined", () => {
//         assert.equal(Client.Client.Interface.is(undefined), false);
//       });
//       it("returns false when object is null", () => {
//         assert.equal(Client.Client.Interface.is(null), false);
//       });

//       // test optional fields types
//       const falseIfOptionalWronglyTyped = (field, wrongValue) => {
//         it(
//           "returns false if, '" + field + "', is present and has wrong type",
//           () => {
//             let invalidArg = validArg;
//             invalidArg[field] = wrongValue;
//             assert.equal(Client.Client.Interface.is(invalidArg), false);
//             delete invalidArg[field];
//             assert.equal(Client.Client.Interface.is(invalidArg), true);
//           }
//         );
//       };
//       falseIfOptionalWronglyTyped("unpaid_past_trip_id", 123);
//       falseIfOptionalWronglyTyped("name", 123);
//       falseIfOptionalWronglyTyped("last_name", 123);
//       falseIfOptionalWronglyTyped("full_name", 123);
//       falseIfOptionalWronglyTyped("email", 123);
//       falseIfOptionalWronglyTyped("phone_number", 123);

//       it("returns false if 'cards' field is present and incorrect", () => {
//         let invalidArg = validArg;
//         invalidArg["cards"] = {
//           card_id: {
//             id: "card_id",
//             brand: "visa",
//             last_digits: "1234",
//             pagarme_customer_id: 12345,
//             billing_address: {},
//           },
//         };
//         assert.equal(Client.Client.Interface.is(invalidArg), false);
//       });

//       it("returns false if 'payment_method' is credit_card without card_id", () => {
//         let invalidArg = validArg;
//         invalidArg["payment_method"] = {
//           default: "credit_card",
//         };
//         assert.equal(Client.Client.Interface.is(invalidArg), false);
//       });

//       it("returns false if 'payment_method.default' is neither 'cash' nor 'credit_card'", () => {
//         let invalidArg = validArg;
//         invalidArg["payment_method"] = {
//           default: "invalid",
//         };
//         assert.equal(Client.Client.Interface.is(invalidArg), false);
//       });

//       it("returns true if all possible fields are present and valid", () => {
//         assert.equal(Client.Client.Interface.is(validArg), true);
//       });
//     });

//     describe("fromObj", () => {
//       it("returns undefined if obj is null", () => {
//         assert.equal(Client.Client.Interface.fromObj(null), undefined);
//       });
//       it("returns undefined if obj is undefined", () => {
//         assert.equal(Client.Client.Interface.fromObj(undefined), undefined);
//       });

//       it("returns undefined if obj is not Client.Interface I", () => {
//         const obj = {
//           uid: "clientUID",
//         };
//         assert.equal(Client.Client.Interface.fromObj(obj), undefined);
//       });

//       it("returns undefined if obj is not Client.Interface II", () => {
//         const obj = {
//           rating: "5",
//         };
//         assert.equal(Client.Client.Interface.fromObj(obj), undefined);
//       });

//       it("returns undefined if obj is not Client.Interface II", () => {
//         const obj = {
//           uid: "clientUID",
//           rating: "5",
//           cards: {
//             card_id: {
//               id: "card_id",
//             },
//           },
//         };
//         assert.equal(Client.Client.Interface.fromObj(obj), undefined);
//       });

//       it("returns Client.Interface if obj is Client.Interface I", () => {
//         const obj = {
//           uid: "clientUID",
//           payment_method: {
//             default: "cash",
//           },
//           rating: "5",
//         };

//         const response = Client.Client.Interface.fromObj(obj);
//         assert.isDefined(response);
//         assert.equal(response.uid, "clientUID");
//         assert.equal(response.rating, "5");
//         assert.equal(response.payment_method.default, "cash");
//         assert.isUndefined(response.payment_method.card_id);
//       });

//       it("returns Client.Interface if obj is Client.Interface II", () => {
//         const obj = {
//           uid: "clientUID",
//           payment_method: {
//             default: "credit_card",
//             card_id: "card_id",
//           },
//           rating: "5",
//         };

//         const response = Client.Client.Interface.fromObj(obj);
//         assert.isDefined(response);
//         assert.equal(response.uid, "clientUID");
//         assert.equal(response.rating, "5");
//         assert.isDefined(response.cards);
//         assert.equal(response.cards.length, 0);
//         assert.equal(response.payment_method.default, "credit_card"),
//           assert.equal(response.payment_method.card_id, "card_id");
//         assert.isUndefined(response.unpaid_past_trip_id);
//       });

//       it("returns Client.Interface if obj is Client.Interface III", () => {
//         const obj = {
//           uid: "clientUID",
//           name: "name",
//           last_name: "lastName",
//           full_name: "fullName",
//           email: "email",
//           phone_number: "9999",
//           rating: "5",
//           payment_method: {
//             default: "cash",
//           },
//           cards: {
//             card_id: {
//               id: "card_id",
//               brand: "visa",
//               holder_name: "Fulano de Tal",
//               first_digits: "523445",
//               expiration_date: "1131",
//               last_digits: "1234",
//               pagarme_customer_id: 12345,
//               billing_address: {
//                 country: "country",
//                 state: "state",
//                 city: "city",
//                 street: "street",
//                 street_number: "street_number",
//                 zipcode: "zipcode",
//               },
//             },
//           },
//           unpaid_past_trip_id: "unpaid_past_trip_id",
//         };

//         const response = Client.Client.Interface.fromObj(obj);
//         assert.isDefined(response);
//         assert.equal(response.uid, "clientUID");
//         assert.equal(response.name, "name");
//         assert.equal(response.last_name, "lastName");
//         assert.equal(response.full_name, "fullName");
//         assert.equal(response.email, "email");
//         assert.equal(response.phone_number, "9999");
//         assert.equal(response.rating, "5");
//         assert.isDefined(response.cards);
//         assert.equal(response.cards.length, 1);
//         assert.equal(response.cards[0].id, "card_id");
//         assert.equal(response.cards[0].brand, "visa");
//         assert.equal(response.payment_method.default, "cash");
//         assert.isUndefined(response.payment_method.card_id);
//         assert.equal(response.unpaid_past_trip_id, "unpaid_past_trip_id");
//       });
//     });

//     describe("Card", () => {
//       describe("is", () => {
//         let validCard;

//         beforeEach(() => {
//           validCard = {
//             id: "card_id",
//             brand: "visa",
//             holder_name: "Fulano de Tal",
//             first_digits: "523445",
//             expiration_date: "1131",
//             last_digits: "1234",
//             pagarme_customer_id: 12345,
//             billing_address: {
//               country: "country",
//               state: "state",
//               city: "city",
//               street: "street",
//               street_number: "street_number",
//               zipcode: "zipcode",
//             },
//           };
//         });

//         it("returns false when object is undefined", () => {
//           assert.equal(Client.Client.Interface.Card.is(undefined), false);
//         });
//         it("returns false when object is null", () => {
//           assert.equal(Client.Client.Interface.Card.is(null), false);
//         });

//         it("returns false when object is empty", () => {
//           assert.equal(Client.Client.Interface.Card.is({}), false);
//         });

//         const falseIfMissingField = (field) => {
//           it("returns false if '" + field + "' is missing", () => {
//             let invalidCard = validCard;
//             delete invalidCard[field];
//             assert.equal(Client.Client.Interface.Card.is(invalidCard), false);
//           });
//         };

//         falseIfMissingField("id");
//         falseIfMissingField("brand");
//         falseIfMissingField("holder_name");
//         falseIfMissingField("first_digits");
//         falseIfMissingField("last_digits");
//         falseIfMissingField("expiration_date");
//         falseIfMissingField("pagarme_customer_id");
//         falseIfMissingField("billing_address");

//         it("returns false if 'first_digits' field doesn't have length 6", () => {
//           let invalidCard = validCard;
//           (invalidCard["first_digits"] = "12345"),
//             assert.equal(Client.Client.Interface.Card.is(invalidCard), false);
//         });

//         it("returns false if 'first_digits' is not all numbers", () => {
//           let invalidCard = validCard;
//           (invalidCard["first_digits"] = "12345a"),
//             assert.equal(Client.Client.Interface.Card.is(invalidCard), false);
//         });

//         it("returns false if 'last_digits' field doesn't have length 4", () => {
//           let invalidCard = validCard;
//           (invalidCard["last_digits"] = "123"),
//             assert.equal(Client.Client.Interface.Card.is(invalidCard), false);
//         });

//         it("returns false if 'last_digits' is not all numbers", () => {
//           let invalidCard = validCard;
//           (invalidCard["last_digits"] = "123a"),
//             assert.equal(Client.Client.Interface.Card.is(invalidCard), false);
//         });

//         it("returns false if 'expiration_date' field doesn't have length 4", () => {
//           let invalidCard = validCard;
//           (invalidCard["expiration_date"] = "123"),
//             assert.equal(Client.Client.Interface.Card.is(invalidCard), false);
//         });

//         it("returns false if 'expiration_date' is not all numbers", () => {
//           let invalidCard = validCard;
//           (invalidCard["expiration_date"] = "123a"),
//             assert.equal(Client.Client.Interface.Card.is(invalidCard), false);
//         });

//         it("returns false if 'billing_address' is incorrect", () => {
//           let invalidCard = validCard;
//           (invalidCard["billing_address"] = {}),
//             assert.equal(Client.Client.Interface.Card.is(invalidCard), false);
//         });

//         it("returns true if all fields are valid", () => {
//           assert.equal(Client.Client.Interface.Card.is(validCard), true);
//         });
//       });

//       describe("fromJson", () => {
//         let validCard;

//         beforeEach(() => {
//           validCard = {
//             id: "card_id",
//             brand: "visa",
//             holder_name: "Fulano de Tal",
//             first_digits: "523445",
//             expiration_date: "1131",
//             last_digits: "1234",
//             pagarme_customer_id: 12345,
//             billing_address: {
//               country: "country",
//               state: "state",
//               city: "city",
//               street: "street",
//               street_number: "street_number",
//               zipcode: "zipcode",
//             },
//           };
//         });

//         it("returns undefined if obj is null", () => {
//           assert.equal(Client.Client.Interface.Card.fromObj(null), undefined);
//         });
//         it("returns undefined if obj is undefined", () => {
//           assert.equal(
//             Client.Client.Interface.Card.fromObj(undefined),
//             undefined
//           );
//         });

//         it("returns undefined if obj is empty", () => {
//           assert.equal(Client.Client.Interface.Card.fromObj({}), undefined);
//         });

//         it("returns Card if obj is valid", () => {
//           let card = Client.Client.Interface.Card.fromObj(validCard);
//           assert.isDefined(card);
//           assert.equal(card.id, "card_id");
//           assert.equal(card.brand, "visa");
//           assert.equal(card.last_digits, "1234");
//           assert.equal(card.pagarme_customer_id, 12345);
//           assert.isDefined(card.billing_address);
//         });
//       });
//     });

//     describe("Address", () => {
//       describe("is", () => {
//         it("returns false when object is undefined", () => {
//           assert.equal(Client.Client.Interface.Address.is(undefined), false);
//         });
//         it("returns false when object is null", () => {
//           assert.equal(Client.Client.Interface.Address.is(null), false);
//         });
//         it("returns false if object is empty", () => {
//           const obj = {};
//           assert.equal(Client.Client.Interface.Address.is(obj), false);
//         });
//         it("returns true if all fields are valid", () => {
//           const obj = {
//             country: "country",
//             state: "state",
//             city: "city",
//             street: "street",
//             street_number: "street_number",
//             zipcode: "zipcode",
//           };
//           assert.equal(Client.Client.Interface.Address.is(obj), true);
//         });
//       });
//       describe("fromJson", () => {
//         it("returns undefined if obj is null", () => {
//           assert.equal(
//             Client.Client.Interface.Address.fromObj(null),
//             undefined
//           );
//         });
//         it("returns undefined if obj is undefined", () => {
//           assert.equal(
//             Client.Client.Interface.Address.fromObj(undefined),
//             undefined
//           );
//         });
//         it("returns Address if obj is valid", () => {
//           const obj = {
//             country: "country",
//             state: "state",
//             city: "city",
//             street: "street",
//             street_number: "street_number",
//             zipcode: "zipcode",
//           };
//           let address = Client.Client.Interface.Address.fromObj(obj);
//           assert.isDefined(address);
//           assert.equal(address.country, "country");
//           assert.equal(address.state, "state");
//           assert.equal(address.city, "city");
//           assert.equal(address.street, "street");
//           assert.equal(address.street_number, "street_number");
//           assert.equal(address.zipcode, "zipcode");
//         });
//       });
//     });
//   });
// });
