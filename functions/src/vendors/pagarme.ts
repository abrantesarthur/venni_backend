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
import { BankAccountCreateOptions } from "pagarme-js-types/src/client/bankAccounts/options";
import { RecipientCreateOptions } from "pagarme-js-types/src/client/recipients/options";
import { BalanceFindOptions } from "pagarme-js-types/src/client/balance/options";
import { BalanceResponse } from "pagarme-js-types/src/client/balance/responses";
import { TransferCreateOptions } from "pagarme-js-types/src/client/transfers/options";
import { Transfer } from "pagarme-js-types/src/client/transfers/responses";
import { BulkAnticipationsCreateOptions } from "pagarme-js-types/src/client/bulkAnticipations/options";
import { BulkAnticipation } from "pagarme-js-types/src/client/bulkAnticipations/responses";

export class Pagarme {
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

  // createTransaction creates a transaction to be captured later
  createTransaction = async (
    cardID: string,
    amount: number,
    customer: { id: number; name: string },
    billingAddress: Address
  ): Promise<Transaction> => {
    return await this._client.transactions.create({
      payment_method: "credit_card",
      card_id: cardID,
      amount: amount,
      capture: false,
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
    });
  };

  captureTransaction = async (
    transactionID: string,
    amount: number,
    recipientID?: string,
    venniAmount?: number
  ): Promise<Transaction> => {
    let splitRules: SplitRuleArg[] = [
      // if venniAmount is specified and there is no other recipient, venni receives amount (100%)
      // if venniAmount is specified and there is another recipient, venni receives venniAmount
      // if venniAmount is not specified and there is no other recipient, venni receives 100%
      // if venniAmount is not specified and there is another recipient, venni receives 20%
      // if there is no other recipient, venni is liable to chargebacks
      {
        liable: recipientID == undefined,
        charge_processing_fee: true,
        percentage:
          venniAmount == undefined
            ? recipientID == undefined
              ? 100
              : 20
            : undefined,
        amount: recipientID == undefined ? amount : venniAmount,
        recipient_id: functions.config().pagarmeapi.recipient_id,
      },
    ];

    if (recipientID != undefined) {
      // if venniAmount is specified, collaborator receives amount minus venniAmount.
      // if venniAmount is not specified, collaborator receives 80%
      // collaborator is liable to chargebacks
      splitRules.push({
        liable: true,
        charge_processing_fee: false,
        percentage: venniAmount == undefined ? 80 : undefined,
        amount: venniAmount == undefined ? undefined : amount - venniAmount,
        recipient_id: recipientID,
      });
    }

    return await this._client.transactions.capture({
      id: transactionID,
      amount: amount,
      split_rules: splitRules,
    });
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

  // BANK ACCOUNT

  createBankAccount = async (opts: BankAccountCreateOptions) => {
    return await this._client.bankAccounts.create(opts);
  };

  // RECIPIENTS
  createRecipient = async (opts: RecipientCreateOptions) => {
    return await this._client.recipients.create(opts);
  };

  // BALANCE
  getBalance = async (opts: BalanceFindOptions): Promise<BalanceResponse> => {
    return await this._client.balance.find(opts);
  };

  // TRANSFERS
  createTransfer = async (opts: TransferCreateOptions): Promise<Transfer> => {
    return await this._client.transfers.create(opts);
  };

  // ANTICIPATION
  createAnticipation = async (opts: BulkAnticipationsCreateOptions): Promise<BulkAnticipation> => {
    return await this._client.bulkAnticipations.create(opts);
  }

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
