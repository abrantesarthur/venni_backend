const Client = require("../lib/database/client");
const chai = require("chai");
const admin = require("firebase-admin");
const { ClientPastTrips } = require("../lib/database/pastTrips");

const assert = chai.assert;

describe("Client", () => {
  before(() => {
    if (admin.apps.length == 0) {
      admin.initializeApp();
    }
  });

  describe("Class", () => {
    let c;
    let clientID;
    let pilotID;
    let defaultClient;
    let defaultTrip;
    let defaultCard;
    before(async () => {
      clientID = "clientID";
      pilotID = "pilotID";
      defaultCard = {
        id: "card_id",
        pagarme_customer_id: 12345,
        billing_address: {
          country: "country",
          state: "state",
          city: "city",
          street: "street",
          street_number: "street_number",
          zipcode: "zipcode",
        },
      };
      defaultClient = {
        uid: clientID,
        rating: "5",
      };
      defaultTrip = {
        uid: clientID,
        trip_status: "completed",
        origin_place_id: "origin_place_id",
        destination_place_id: "destination_place_id",
        origin_zone: "AA",
        fare_price: 5,
        distance_meters: 100,
        distance_text: "100 metes",
        duration_seconds: 300,
        duration_text: "5 minutes",
        encoded_points: "encoded_points",
        request_time: Date.now().toString(),
        origin_address: "origin_address",
        destination_address: "destination_address",
        pilot_id: pilotID,
      };
      c = new Client.Client(clientID);

      // clear database
      await admin.database().ref("clients").remove();
      await admin.database().ref("past-trips").remove();
    });

    after(async () => {
      // clear database
      await admin.database().ref("clients").remove();
      await admin.database().ref("past-trips").remove();
    });

    describe("getClient", () => {
      it("returns undefined if there is no client in database", async () => {
        let result = await c.getClient();
        assert.isUndefined(result);
      });

      it("returns Client.Interface if there is a client in database", async () => {
        // add client to the database
        await admin
          .database()
          .ref("clients")
          .child(clientID)
          .set({
            uid: clientID,
            rating: "5",
            cards: {
              card_id: defaultCard,
            },
          });
        // assert client was returned
        let result = await c.getClient();
        assert.isDefined(result);
        assert.equal(result.uid, clientID);
        assert.equal(result.rating, "5");
        assert.equal(result.cards.length, 1);
        assert.equal(result.cards[0].id, "card_id");
        assert.equal(result.cards[0].pagarme_customer_id, 12345);
        assert.isDefined(result.cards[0].billing_address);
        // clear database
        await admin.database().ref("clients").remove();
      });
    });

    describe("addClient", () => {
      it("returns Client.Interface if there is a client in database", async () => {
        // assert there is no client in database
        let result = await c.getClient();
        assert.isUndefined(result);
        // add client to the database
        await c.addClient(defaultClient);
        // assert a client was added
        result = await c.getClient();
        assert.isDefined(result);
        // clear database
        await admin.database().ref("clients").remove();
      });
    });

    describe("pushPastTripAndRate", () => {
      it("pushes a past trip with client_rating to client's list of past trips", async () => {
        // assert client has no past trips
        let cpt = new ClientPastTrips(clientID);
        let pastTripsCount = await cpt.getPastTripsCount();
        assert.equal(pastTripsCount, 0);

        // call pushPastTripAndRate
        await c.pushPastTripAndRate(defaultTrip, 2);

        // assert client now has a past trip with client_rating
        let pastTrips = await cpt.getPastTrips();
        assert.equal(pastTrips.length, 1);
        assert.equal(pastTrips[0].client_rating, "2.00");

        // clear database
        await admin.database().ref("past-trips").remove();
      });

      it("rates clients with a 5 when they have less than 5 past trips", async () => {
        // add client to database
        await c.addClient(defaultClient);

        let result = await c.getClient();
        assert.isDefined(result);

        // call pushPastTripAndRate
        let rate = 2;
        await c.pushPastTripAndRate(defaultTrip, rate);

        // after rating,because client has less than 5 trips, his rating is 5

        result = await c.getClient();
        assert.isDefined(result);
        assert.equal(result.rating, "5.00");

        // clear database
        await admin.database().ref("clients").remove();
        await admin.database().ref("past-trips").remove();
      });
    });

    describe("addCard", () => {
      it("adds card to the database", async () => {
        // add client to the database
        await c.addClient(defaultClient);
        // assert client has no cards
        let cards = await c.getCards();
        assert.isEmpty(cards);
        // add card to database
        await c.addCard({
          id: "card_id",
          pagarme_customer_id: 12345,
          billing_address: {
            country: "country",
            state: "state",
            city: "city",
            street: "street",
            street_number: "street_number",
            zipcode: "zipcode",
          },
        });
        // assert client has a card
        let card = await c.getCardByID("card_id");
        assert.isDefined(card);
        assert.equal(card.id, "card_id");
        assert.equal(card.pagarme_customer_id, 12345);
        assert.isDefined(card.billing_address);
        assert.equal(card.billing_address.country, "country");
        assert.equal(card.billing_address.state, "state");
        assert.equal(card.billing_address.city, "city");
        assert.equal(card.billing_address.street, "street");
        assert.equal(card.billing_address.street_number, "street_number");
        assert.equal(card.billing_address.zipcode, "zipcode");

        // clear database
        await admin.database().ref("clients").remove();
      });
    });

    describe("getCardByID", () => {
      it("returns undefined if client has no cards", async () => {
        // add client to the database
        await c.addClient(defaultClient);
        // assert getCardByID returns undefined
        let card = await c.getCardByID("card_id");
        assert.isUndefined(card);
        // clear database
        await admin.database().ref("clients").remove();
      });

      it("returns card if client has a card", async () => {
        // add client to the database
        await c.addClient(defaultClient);
        // add card to database
        await c.addCard({
          id: "card_id",
          pagarme_customer_id: 12345,
          billing_address: {
            country: "country",
            state: "state",
            city: "city",
            street: "street",
            street_number: "street_number",
            zipcode: "zipcode",
          },
        });
        // assert client has a card
        let card = await c.getCardByID("card_id");
        assert.isDefined(card);
        assert.equal(card.id, "card_id");
        assert.equal(card.pagarme_customer_id, 12345);
        assert.isDefined(card.billing_address);
        assert.equal(card.billing_address.country, "country");
        assert.equal(card.billing_address.state, "state");
        assert.equal(card.billing_address.city, "city");
        assert.equal(card.billing_address.street, "street");
        assert.equal(card.billing_address.street_number, "street_number");
        assert.equal(card.billing_address.zipcode, "zipcode");

        // clear database
        await admin.database().ref("clients").remove();
      });
    });

    describe("getCards", () => {
      it("returns empty list if client has no cards", async () => {
        // add client to the database
        await c.addClient(defaultClient);
        // assert getCardByID returns undefined
        let card = await c.getCards("card_id");
        assert.isEmpty(card);
        // clear database
        await admin.database().ref("clients").remove();
      });

      it("returns list of cards if client has cards", async () => {
        // add client to the database
        await c.addClient(defaultClient);
        // add two cards to database
        let defaultCard = {
          id: "card_id",
          pagarme_customer_id: 12345,
          billing_address: {
            country: "country",
            state: "state",
            city: "city",
            street: "street",
            street_number: "street_number",
            zipcode: "zipcode",
          },
        };
        await c.addCard(defaultCard);
        defaultCard.id = "card_id_2";
        await c.addCard(defaultCard);

        // assert client has two a card
        let card = await c.getCards();
        assert.equal(card.length, 2);
        assert.equal(card[0].id, "card_id");
        assert.equal(card[1].id, "card_id_2");
        assert.equal(card[0].pagarme_customer_id, 12345);
        assert.isDefined(card[0].billing_address);
        assert.equal(card[0].billing_address.country, "country");
        assert.equal(card[0].billing_address.state, "state");
        assert.equal(card[0].billing_address.city, "city");
        assert.equal(card[0].billing_address.street, "street");
        assert.equal(card[0].billing_address.street_number, "street_number");
        assert.equal(card[0].billing_address.zipcode, "zipcode");

        // clear database
        await admin.database().ref("clients").remove();
      });
    });
  });

  describe("Interface", () => {
    describe("is", () => {
      it("returns false when object is undefined", () => {
        assert.equal(Client.Client.Interface.is(undefined), false);
      });
      it("returns false when object is null", () => {
        assert.equal(Client.Client.Interface.is(null), false);
      });

      it("returns false if 'cards' field is present and incorrect", () => {
        const obj = {
          uid: "clientUID",
          rating: "5",
          cards: {
            card_id: {
              id: "card_id",
              pagarme_customer_id: 12345,
              billing_address: {},
            },
          },
        };
        assert.equal(Client.Client.Interface.is(obj), false);
      });

      it("returns true when all required fields are present", () => {
        const obj = {
          uid: "clientUID",
          rating: "5",
        };
        assert.equal(Client.Client.Interface.is(obj), true);
      });

      it("returns true if all possible fields are present and valid", () => {
        const obj = {
          uid: "clientUID",
          rating: "5",
          cards: {
            card_id: {
              id: "card_id",
              pagarme_customer_id: 12345,
              billing_address: {
                country: "country",
                state: "state",
                city: "city",
                street: "street",
                street_number: "street_number",
                zipcode: "zipcode",
              },
            },
          },
        };
        assert.equal(Client.Client.Interface.is(obj), true);
      });
    });

    describe("fromObj", () => {
      it("returns undefined if obj is null", () => {
        assert.equal(Client.Client.Interface.fromObj(null), undefined);
      });
      it("returns undefined if obj is undefined", () => {
        assert.equal(Client.Client.Interface.fromObj(undefined), undefined);
      });

      it("returns undefined if obj is not Client.Interface I", () => {
        const obj = {
          uid: "clientUID",
        };
        assert.equal(Client.Client.Interface.fromObj(obj), undefined);
      });

      it("returns undefined if obj is not Client.Interface II", () => {
        const obj = {
          rating: "5",
        };
        assert.equal(Client.Client.Interface.fromObj(obj), undefined);
      });

      it("returns undefined if obj is not Client.Interface II", () => {
        const obj = {
          uid: "clientUID",
          rating: "5",
          cards: {
            card_id: {
              id: "card_id",
            },
          },
        };
        assert.equal(Client.Client.Interface.fromObj(obj), undefined);
      });

      it("returns Client.Interface if obj is Client.Interface I", () => {
        const obj = {
          uid: "clientUID",
          rating: "5",
        };

        const response = Client.Client.Interface.fromObj(obj);
        assert.isDefined(response);
        assert.equal(response.uid, "clientUID");
        assert.equal(response.rating, "5");
      });

      it("returns Client.Interface if obj is Client.Interface II", () => {
        const obj = {
          uid: "clientUID",
          rating: "5",
        };

        const response = Client.Client.Interface.fromObj(obj);
        assert.isDefined(response);
        assert.equal(response.uid, "clientUID");
        assert.equal(response.rating, "5");
        assert.isDefined(response.cards);
        assert.equal(response.cards.length, 0);
      });

      it("returns Client.Interface if obj is Client.Interface II", () => {
        const obj = {
          uid: "clientUID",
          rating: "5",
          cards: {
            card_id: {
              id: "card_id",
              pagarme_customer_id: 12345,
              billing_address: {
                country: "country",
                state: "state",
                city: "city",
                street: "street",
                street_number: "street_number",
                zipcode: "zipcode",
              },
            },
          },
        };

        const response = Client.Client.Interface.fromObj(obj);
        assert.isDefined(response);
        assert.equal(response.uid, "clientUID");
        assert.equal(response.rating, "5");
        assert.isDefined(response.cards);
        assert.equal(response.cards.length, 1);
        assert.equal(response.cards[0].id, "card_id");
      });
    });

    describe("Card", () => {
      describe("is", () => {
        it("returns false when object is undefined", () => {
          assert.equal(Client.Client.Interface.Card.is(undefined), false);
        });
        it("returns false when object is null", () => {
          assert.equal(Client.Client.Interface.Card.is(null), false);
        });
        it("returns false if 'billing_address' is incorrect", () => {
          const obj = {
            id: "card_id",
            pagarme_customer_id: 12345,
            billing_address: {},
          };
          assert.equal(Client.Client.Interface.Card.is(obj), false);
        });
        it("returns true if all fields are valid", () => {
          const obj = {
            id: "card_id",
            pagarme_customer_id: 12345,
            billing_address: {
              country: "country",
              state: "state",
              city: "city",
              street: "street",
              street_number: "street_number",
              zipcode: "zipcode",
            },
          };
          assert.equal(Client.Client.Interface.Card.is(obj), true);
        });
      });
      describe("fromJson", () => {
        it("returns undefined if obj is null", () => {
          assert.equal(Client.Client.Interface.Card.fromObj(null), undefined);
        });
        it("returns undefined if obj is undefined", () => {
          assert.equal(
            Client.Client.Interface.Card.fromObj(undefined),
            undefined
          );
        });
        it("returns Card if obj is valid", () => {
          const obj = {
            id: "card_id",
            pagarme_customer_id: 12345,
            billing_address: {
              country: "country",
              state: "state",
              city: "city",
              street: "street",
              street_number: "street_number",
              zipcode: "zipcode",
            },
          };
          let card = Client.Client.Interface.Card.fromObj(obj);
          assert.isDefined(card);
          assert.equal(card.id, "card_id");
          assert.equal(card.pagarme_customer_id, 12345);
          assert.isDefined(card.billing_address);
        });
      });
    });

    describe("Address", () => {
      describe("is", () => {
        it("returns false when object is undefined", () => {
          assert.equal(Client.Client.Interface.Address.is(undefined), false);
        });
        it("returns false when object is null", () => {
          assert.equal(Client.Client.Interface.Address.is(null), false);
        });
        it("returns false if object is empty", () => {
          const obj = {};
          assert.equal(Client.Client.Interface.Address.is(obj), false);
        });
        it("returns true if all fields are valid", () => {
          const obj = {
            country: "country",
            state: "state",
            city: "city",
            street: "street",
            street_number: "street_number",
            zipcode: "zipcode",
          };
          assert.equal(Client.Client.Interface.Address.is(obj), true);
        });
      });
      describe("fromJson", () => {
        it("returns undefined if obj is null", () => {
          assert.equal(
            Client.Client.Interface.Address.fromObj(null),
            undefined
          );
        });
        it("returns undefined if obj is undefined", () => {
          assert.equal(
            Client.Client.Interface.Address.fromObj(undefined),
            undefined
          );
        });
        it("returns Address if obj is valid", () => {
          const obj = {
            country: "country",
            state: "state",
            city: "city",
            street: "street",
            street_number: "street_number",
            zipcode: "zipcode",
          };
          let address = Client.Client.Interface.Address.fromObj(obj);
          assert.isDefined(address);
          assert.equal(address.country, "country");
          assert.equal(address.state, "state");
          assert.equal(address.city, "city");
          assert.equal(address.street, "street");
          assert.equal(address.street_number, "street_number");
          assert.equal(address.zipcode, "zipcode");
        });
      });
    });
  });
});
