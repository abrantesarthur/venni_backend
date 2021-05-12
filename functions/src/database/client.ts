import { namespace } from "firebase-functions/lib/providers/firestore";
import { Database } from "./index";
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
    await this.ref.child("cards").child(card.id).set(card);
  };

  getCardByID = async (
    cardID: string
  ): Promise<Client.Interface.Card | undefined> => {
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
}

export namespace Client {
  export interface Interface {
    uid: string;
    rating: string; // average of the ratings of the last 100 trips
    payment_method: {
      default: "cash" | "credit_card";
      card_id?: string;
    };
    cards?: Client.Interface.Card[]; // is empty if customer has no cards
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

      // type check obj.payment_method
      if (
        obj.payment_method == undefined ||
        typeof obj.payment_method != "object"
      ) {
        return false;
      }
      if (
        obj.payment_method.default == undefined ||
        (obj.payment_method.default != "cash" &&
          obj.payment_method.default != "credit_card")
      ) {
        return false;
      }
      if (
        obj.payment_method.deafult == "credit_card" &&
        obj.payment_method.card_id == undefined
      ) {
        return false;
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
          rating: obj.rating,
          payment_method: obj.payment_method,
          cards: cards,
        };
      }
      return;
    };

    type Brand = "mastercard" | "visa" | "elo" | "amex" | "discover" | "aura" | "jcb" | "hipercard" | "diners";
    export interface Card {
      id: string;
      last_digits: string,
      brand: Brand,
      pagarme_customer_id: number;
      billing_address: Client.Interface.Address;
    }

    export namespace Card {
      export const is = (obj: any): obj is Client.Interface.Card => {
        if (obj == null || obj == undefined) {
          return false;
        }
        
        // type check 'last_digits' field
        if(obj.last_digits == undefined) {
          return false;
        }
        if(typeof obj.last_digits != "string") {
          return false;
        }
        if(obj.last_digits.length != 4) {
          return false;
        }
        for(var i = 0; i < 4; i++) {
          if(isNaN(Number.parseInt(obj.last_digits[i], 10))) {
            return false;
          }
        }
    

        return (
          "id" in obj &&
          "brand" in obj &&
          "pagarme_customer_id" in obj &&
          "billing_address" in obj &&
          typeof obj.id == "string" &&
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
              last_digits: obj.last_digits,
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
      /** País. Duas letras minúsculas. Deve seguir o padrão `ISO 3166-1 alpha-2` */
      country: string;
      state: string;
      city: string;
      street: string;
      street_number: string;
      zipcode: string;
      neighborhood?: string;
      /** Complemento. **Não pode ser uma string vazia** nem null */
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
