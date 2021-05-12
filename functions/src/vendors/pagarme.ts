import { client } from "pagarme";
import * as functions from "firebase-functions";
import {
  CardAllOptions,
  CardCreateOptions,
  CardFindOptions,
} from "pagarme-js-types/src/client/cards/options";
import { Card } from "pagarme-js-types/src/client/cards/responses";
import { CustomerCreateOptions } from "pagarme-js-types/src/client/customers/options";
import { Customer } from "pagarme-js-types/src/client/customers/responses";
import {
  CardHashKey,
  Transaction,
} from "pagarme-js-types/src/client/transactions/responses";
import { Address } from "pagarme-js-types/src/common";
import { SplitRuleArg } from "pagarme-js-types/src/client/transactions/options";

export class pagarme {
  private _clientPromise: Promise<typeof client>;
  protected _client: typeof client;

  constructor() {
    this._clientPromise = client.connect({
      api_key: functions.config().pagarmeapi.key,
    });
  }

  ensureInitialized = async () => {
    this._client = await this._clientPromise;
  };

  // TRANSACTIONS

  // use customer's document_number '11111111111' to simulate antifraud failure
  // use cardID of card with cvv starting with a 6 to simulate refused transactions

  createTransactionByCardID = async (
    cardID: string,
    amount: number,
    customer: { id: number; name: string },
    billingAddress: Address,
    recipientID?: string
  ): Promise<Transaction> => {
    let splitRules: SplitRuleArg[] = [
      // venni receives 20% - fees and is liable to chargebacks if there is no other recipient
      {
        liable: recipientID == undefined,
        charge_processing_fee: true,
        percentage: recipientID == undefined ? 100 : 20,
        recipient_id: functions.config().pagarmeapi.recipient_id,
      },
    ];

    if (recipientID != undefined) {
      // collaborator receives 80% and is liable to chargebacks
      splitRules.push({
        liable: true,
        charge_processing_fee: false,
        percentage: 80,
        recipient_id: recipientID,
      });
    }

    return await this._client.transactions.create({
      amount: amount,
      payment_method: "credit_card",
      card_id: cardID,
      customer: {
        // mandatory (because of documents) for antifraud
        id: customer.id,
      },
      billing: {
        name: customer.name,
        address: billingAddress, // mandatory for antifraud
      },
      items: [
        // mandatory for antifraud
        {
          id: "corrida-moto-taxi",
          title: "corrida de moto-taxi",
          unit_price: amount,
          quantity: 1,
          tangible: false,
        },
      ],
      split_rules: splitRules,
    });
  };

  refund = async (trasactionID: number): Promise<Transaction> => {
    return await this._client.transactions.refund({ id: trasactionID });
  };

  getCardHashKey = async (): Promise<CardHashKey> => {
    return await this._client.transactions.cardHashKey({});
  };

  // CARDS

  createCard = async (opts: CardCreateOptions): Promise<Card> => {
    return await this._client.cards.create(opts);
  };

  getCard = async (opts: CardFindOptions): Promise<Card> => {
    return await this._client.cards.find(opts);
  };

  getAllCards = async (pagination: CardAllOptions): Promise<Card[]> => {
    return await this._client.cards.all(pagination);
  };

  // CUSTOMERS

  createCustomer = async (opts: CustomerCreateOptions): Promise<Customer> => {
    return await this._client.customers.create(opts);
  };

  // SECURITY

  encrypt = async (card: {
    card_holder_name: string;
    card_expiration_date: string;
    card_number: string;
    card_cvv: string;
  }): Promise<string> => {
    return await this._client.security.encrypt(card);
  };
}

/**
 * TODO
 *      encript card data in the client instead of backend using a public encription_key.
 *      this way, the data can be safely from client to backend!
 *          client requests backend for new public key. Backend requests pagarme for public key
 *          client uses public key and card info to create a hash
 *          client sends card_hash and card info without cvv to backend
 *          backend requests pagarme to create card info
 *          backend sends success of failure response back to client
 */
