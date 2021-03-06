import { LooseObject } from "../utils";
import { Database, transaction } from "./index";
import { ClientPastTrips } from "./pastTrips";
import { TripRequest } from "./tripRequest";

export class Client extends Database {
  readonly ref: Database.Reference;
  readonly id: string;

  constructor(clientID: string) {
    super();
    this.id = clientID;
    this.ref = this.DB.ref("clients").child(clientID);
  }

  getClient = async (): Promise<Client.Interface | undefined> => {
    const snapshot = await this.ref.once("value");
    return Client.Interface.fromObj(snapshot.val());
  };

  addClient = async (client: Client.Interface) => {
    await this.ref.set(client);
  };

  remove = async (): Promise<any> => {
    return await this.ref.remove();
  };

  update = async (values: Object) => {
    return await this.ref.update(values);
  };

  // rateByID sets client's as average of last 100 ratings
  private rate = async () => {
    let client = await this.getClient();
    if (client == undefined) {
      return;
    }

    // get client past 100 trips
    let cpt = new ClientPastTrips(this.id);
    let last100Trips = await cpt.getPastTrips(100);

    // calculate rating
    if (last100Trips != undefined) {
      let last100TotalRating = 0;
      let last100NumberOfRatings = 0;
      last100Trips.forEach((trip) => {
        if (trip.client_rating != undefined) {
          last100TotalRating += Number(trip.client_rating);
          last100NumberOfRatings += 1;
        }
      });

      // rating is 5 until client has done at least 5 trips. Then it's an average of
      // the ratings of the last 100 trips.
      let rating =
        last100Trips.length < 5
          ? 5
          : last100TotalRating / last100NumberOfRatings;
      await this.ref
        .child("rating")
        .set(((rating * 100) / 100).toFixed(2).toString());
    }
  };

  private pushPastTrip = async (
    trip: TripRequest.Interface
  ): Promise<string | null> => {
    let cpt = new ClientPastTrips(this.id);
    return await cpt.pushPastTrip(trip);
  };

  // pushPastTripAndRate saves the trip to the client's list of past_trips with
  // client_rating field set to rating. Then, it rates the client. As a consequence of
  // pushing and then rating, rate will take into accoutn the just-pushed trip.
  // it returns the reference key to the past-trip entry.
  pushPastTripAndRate = async (
    trip: TripRequest.Interface,
    rating: number
  ): Promise<string | null> => {
    trip.client_rating = ((rating * 100) / 100).toFixed(2).toString();
    let pastTripRefKey = await this.pushPastTrip(trip);
    await this.rate();
    return pastTripRefKey;
  };

  addCard = async (card: Client.Interface.Card) => {
    return await this.ref.child("cards").child(card.id).set(card);
  };

  removeCardByID = async (cardID: string) => {
    return await this.ref.child("cards").child(cardID).remove();
  };

  getCardByID = async (
    cardID: string
  ): Promise<Client.Interface.Card | undefined> => {
    if (cardID == undefined) {
      return undefined;
    }
    let snapshot = await this.ref.child("cards").child(cardID).once("value");
    return Client.Interface.Card.fromObj(snapshot.val());
  };

  getCards = async (): Promise<Client.Interface.Card[]> => {
    let snapshot = await this.ref.child("cards").once("value");
    let cards: Client.Interface.Card[] = [];
    if (snapshot.val() != null) {
      let cardIDs = Object.keys(snapshot.val());
      cardIDs.forEach((cardID: string) => {
        let card = Client.Interface.Card.fromObj(snapshot.val()[cardID]);
        if (card != undefined) {
          cards.push(card);
        }
      });
    }
    return cards;
  };

  setPaymentMethod = async (
    defaultMethod: "cash" | "credit_card",
    cardID?: string
  ) => {
    let paymentMethod: LooseObject = {
      default: defaultMethod,
    };
    if (cardID != undefined) {
      paymentMethod["card_id"] = cardID;
    }
    return await this.ref.child("payment_method").set(paymentMethod);
  };

  setUnpaidTrip = async (tripRefKey: string) => {
    await transaction(this.ref, (client: Client.Interface) => {
      if (client == null) {
        return null;
      }
      // important; we must enforce a variant that a client can only request a new trip if
      // unpaid_past_trip_id is undefined or empty. Otherwise, this will override a previous amount owed.
      client.unpaid_past_trip_id = tripRefKey;
      return client;
    });
  };

  // TODO: test
  unsetUnpaidTrip = async () => {
    await transaction(this.ref, (client: Client.Interface) => {
      if (client == null) {
        return null;
      }
      delete client["unpaid_past_trip_id"];
      return client;
    });
  };
}

export namespace Client {
  export interface Interface {
    uid: string;
    rating: string; // average of the ratings of the last 100 trips
    payment_method: {
      default: "cash" | "credit_card";
      card_id?: string;
    };
    fcm_token?: string; // firebase cloud messaging token is updated when the user inits the app
    cards?: Client.Interface.Card[]; // is empty if customer has no cards
    unpaid_past_trip_id?: string; // reference key to the unpaid past trip
    name?: string; // added by event listener
    last_name?: string; // added by event listener
    full_name?: string; // added by event listener
    email?: string; // added by event listener
    phone_number?: string; // added by event listener
  }

  export namespace Interface {
    export const is = (obj: any): boolean => {
      if (obj == null || obj == undefined) {
        return false;
      }

      // if cards are present, make sure they are correctly typed
      if (obj.cards != undefined) {
        let cardIDs = Object.keys(obj.cards);
        for (var j = 0; j < cardIDs.length; j++) {
          if (!Client.Interface.Card.is(obj.cards[cardIDs[j]])) {
            return false;
          }
        }
      }

      // type check optional fields
      const typeCheckOptionalField = (field: string, expectedType: string) => {
        if (obj[field] != undefined && typeof obj[field] != expectedType) {
          return false;
        }
        return true;
      };
      if (
        !typeCheckOptionalField("unpaid_past_trip_id", "string") ||
        !typeCheckOptionalField("fcm_token", "string") ||
        !typeCheckOptionalField("payment_method", "object") ||
        !typeCheckOptionalField("name", "string") ||
        !typeCheckOptionalField("last_name", "string") ||
        !typeCheckOptionalField("full_name", "string") ||
        !typeCheckOptionalField("email", "string") ||
        !typeCheckOptionalField("phone_number", "string")
      ) {
        return false;
      }

      // type check obj.payment_method
      if (obj.payment_method != undefined) {
        if (
          obj.payment_method.default == undefined ||
          (obj.payment_method.default != "cash" &&
            obj.payment_method.default != "credit_card")
        ) {
          return false;
        }
        if (
          obj.payment_method.default == "credit_card" &&
          obj.payment_method.card_id == undefined
        ) {
          return false;
        }
      }

      return (
        "uid" in obj &&
        "rating" in obj &&
        typeof obj.uid == "string" &&
        typeof obj.rating == "string"
      );
    };

    export const fromObj = (obj: any): Client.Interface | undefined => {
      if (is(obj)) {
        let cards: Client.Interface.Card[] = [];
        if (obj.cards != undefined) {
          let cardIDs = Object.keys(obj.cards);
          for (var j = 0; j < cardIDs.length; j++) {
            let card = Client.Interface.Card.fromObj(obj.cards[cardIDs[j]]);
            if (card != undefined) {
              cards.push(card);
            }
          }
        }

        return {
          uid: obj.uid,
          name: obj.name,
          last_name: obj.last_name,
          full_name: obj.full_name,
          email: obj.email,
          phone_number: obj.phone_number,
          rating: obj.rating,
          payment_method: obj.payment_method,
          cards: cards,
          unpaid_past_trip_id: obj.unpaid_past_trip_id,
          fcm_token: obj.fcm_token,
        };
      }
      return;
    };

    type Brand =
      | "mastercard"
      | "visa"
      | "elo"
      | "amex"
      | "discover"
      | "aura"
      | "jcb"
      | "hipercard"
      | "diners";
    export interface Card {
      /** id do cart??o no pagar.me */
      id: string;
      /** Nome do portador do cart??o. */
      holder_name: string;
      /** 6 primeiros d??gitos do cart??o. */
      first_digits: String;
      /** 4 primeiros d??gitos do cart??o. */
      last_digits: string;
      /** Data de expira????o do cart??o. */
      expiration_date: string;
      /** Emissor do cart??o. */
      brand: Brand;
      /** id do customer no pagar.me. */
      pagarme_customer_id: number;
      /** endere??o de cobran??a do cart??o. */
      billing_address: Client.Interface.Address;
    }

    export namespace Card {
      export const is = (obj: any): obj is Client.Interface.Card => {
        if (obj == null || obj == undefined) {
          return false;
        }

        const typeCheckNumericField = (
          fieldName: string,
          fieldLength: number
        ): boolean => {
          if (
            obj[fieldName] == undefined ||
            typeof obj[fieldName] != "string" ||
            obj[fieldName].length != fieldLength
          ) {
            return false;
          }
          for (var i = 0; i < fieldLength; i++) {
            if (isNaN(Number.parseInt(obj[fieldName][i], 10))) {
              return false;
            }
          }
          return true;
        };

        // type check 'last_digits' field
        if (!typeCheckNumericField("last_digits", 4)) {
          return false;
        }
        // type check 'first_digits' field
        if (!typeCheckNumericField("first_digits", 6)) {
          return false;
        }
        // type check 'expiration_date' field
        if (!typeCheckNumericField("expiration_date", 4)) {
          return false;
        }

        return (
          "id" in obj &&
          "holder_name" in obj &&
          "brand" in obj &&
          "pagarme_customer_id" in obj &&
          "billing_address" in obj &&
          typeof obj.id == "string" &&
          typeof obj.holder_name == "string" &&
          typeof obj.pagarme_customer_id == "number" &&
          Client.Interface.Address.is(obj.billing_address)
        );
      };

      export const fromObj = (obj: any): Client.Interface.Card | undefined => {
        if (is(obj)) {
          let address = Client.Interface.Address.fromObj(obj.billing_address);
          if (address != undefined) {
            return {
              id: obj.id,
              holder_name: obj.holder_name,
              first_digits: obj.first_digits,
              last_digits: obj.last_digits,
              expiration_date: obj.expiration_date,
              brand: obj.brand,
              pagarme_customer_id: obj.pagarme_customer_id,
              billing_address: address,
            };
          }
        }
        return;
      };
    }

    export interface Address {
      /** Pa??s. Duas letras min??sculas. Deve seguir o padr??o `ISO 3166-1 alpha-2` */
      country: string;
      state: string;
      city: string;
      street: string;
      street_number: string;
      zipcode: string;
      neighborhood?: string;
      /** Complemento. **N??o pode ser uma string vazia** nem null */
      complementary?: string;
    }

    export namespace Address {
      export const is = (obj: any): obj is Client.Interface.Address => {
        if (obj == null || obj == undefined) {
          return false;
        }
        return (
          "country" in obj &&
          "state" in obj &&
          "city" in obj &&
          "street" in obj &&
          "street_number" in obj &&
          "zipcode" in obj &&
          typeof obj.country == "string" &&
          typeof obj.state == "string" &&
          typeof obj.city == "string" &&
          typeof obj.street == "string" &&
          typeof obj.street_number == "string" &&
          typeof obj.zipcode == "string"
        );
      };

      export const fromObj = (
        obj: any
      ): Client.Interface.Address | undefined => {
        if (is(obj)) {
          return obj as Address;
        }
        return;
      };
    }
  }
}
