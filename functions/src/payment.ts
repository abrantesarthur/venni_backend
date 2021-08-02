import * as functions from "firebase-functions";
import { Client } from "./database/client";
import { validateArgument, phoneHasE164Format } from "./utils";
import { Pagarme } from "./vendors/pagarme";
import { Customer } from "pagarme-js-types/src/client/customers/responses";
import { Card } from "pagarme-js-types/src/client/cards/responses";
import { Transaction } from "pagarme-js-types/src/client/transactions/responses";
import { ClientPastTrips } from "./database/pastTrips";
import { Partner } from "./database/partner";
import { TripRequest } from "./database/tripRequest";
import { BankAccount } from "pagarme-js-types/src/client/bankAccounts/responses";
import { BankAccountCreateOptions } from "pagarme-js-types/src/client/bankAccounts/options";
import { BalanceResponse } from "pagarme-js-types/src/client/balance/responses";
import { Transfer } from "pagarme-js-types/src/client/transfers/responses";
import { BulkAnticipation } from "pagarme-js-types/src/client/bulkAnticipations/responses";

// validDigits makes sure 'digits' have expected length and all
// characters in it are numerical
const validDigits = (digits: string, length: number, exactLength = true) => {
  if (exactLength) {
    // digits must have exactly length
    if (digits.length != length) {
      return false;
    }
  } else {
    // digits must have at most length
    if (digits.length > length) {
      return false;
    }
  }

  // all characters in digits must be integers
  for (var i = 0; i < digits.length; i++) {
    if (isNaN(parseInt(digits[i], 10))) {
      return false;
    }
  }
  return true;
};

const validateCreateCardArguments = (args: any) => {
  validateArgument(
    args,
    [
      "card_number",
      "card_expiration_date",
      "card_holder_name",
      "card_hash",
      "cpf_number",
      "billing_address",
      "email",
      "phone_number",
    ],
    [
      "string",
      "string",
      "string",
      "string",
      "string",
      "object",
      "string",
      "string",
    ],
    [true, true, true, true, true, true, true, true]
  );

  // card_number must have 16 digits
  if (!validDigits(args.card_number, 16)) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "argument 'card_number' must have exactly 16 digits."
    );
  }

  // card_expiration_date must have 4 digits
  if (!validDigits(args.card_expiration_date, 4)) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "argument 'card_expiration_date' must have MMYY format."
    );
  }
  // card_expiration_date must have valid month value
  let expirationMonth = parseInt(
    args.card_expiration_date[0] + args.card_expiration_date[1],
    10
  );
  if (isNaN(expirationMonth) || expirationMonth > 12 || expirationMonth < 1) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "argument 'card_expiration_date' has invalid month."
    );
  }
  // card_expiration_date must have valid year value
  let expirationYear = parseInt(
    args.card_expiration_date[2] + args.card_expiration_date[3],
    10
  );
  let thisYear = parseInt(new Date().getFullYear().toString().substr(2), 10);
  if (isNaN(expirationYear) || expirationYear < thisYear) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "year in 'card_expiration_date' must not be before this year."
    );
  }

  // cpf_number must have right 11  digits
  if (!validDigits(args.cpf_number, 11)) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "argument 'cpf_number' must have exactly 11 digits."
    );
  }

  // billing_address must be valid
  if (!Client.Interface.Address.is(args.billing_address)) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "argument 'billing_address' is invalid."
    );
  }
};

const validateCreateBankAccountArguments = (args: any) => {
  validateArgument(
    args,
    [
      "bank_code",
      "agencia",
      "agencia_dv",
      "conta",
      "conta_dv",
      "type",
      "document_number",
      "legal_name",
    ],
    [
      "string",
      "string",
      "string",
      "string",
      "string",
      "string",
      "string",
      "string",
    ],
    [true, true, false, true, true, true, true, true]
  );

  // bank_code must have 3 digits
  if (!validDigits(args.bank_code, 3)) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "argument 'bank_code' must have 3 digits."
    );
  }

  // agencia must have at most 4 digits
  if (!validDigits(args.agencia, 4, false)) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "argument 'agencia' must have at most 4 digits."
    );
  }

  // conta must have at most 13 digits
  if (!validDigits(args.conta, 13, false)) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "argument 'conta' must have at most 13 digits."
    );
  }

  // conta_dv must have at most 2 digits
  if (!validDigits(args.conta_dv, 2, false)) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "argument 'conta_dv' must have at most 2 digits."
    );
  }

  // type must be valid
  if (
    args.type != "conta_corrente" &&
    args.type != "conta_poupanca" &&
    args.type != "conta_corrente_conjunta" &&
    args.type != "conta_poupanca_conjunta"
  ) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "argument 'type' must be one of 'conta_corrente', 'conta_poupanca', 'conta_corrente_conjunta', and 'conta_poupanca_conjunta'"
    );
  }
};

const createCard = async (
  data: any,
  context: functions.https.CallableContext
) => {
  // validations
  if (context.auth == null) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "Missing authentication credentials."
    );
  }
  validateCreateCardArguments(data);

  // create a pagarme customer
  const p = new Pagarme();
  await p.ensureInitialized();
  let customer: Customer;
  try {
    customer = await p.createCustomer({
      external_id: context.auth.uid,
      name: data.card_holder_name,
      type: "individual",
      country: "br",
      email: data.email,
      documents: [
        {
          type: "cpf",
          number: data.cpf_number,
        },
      ],
      phone_numbers: [data.phone_number],
    });
  } catch (e) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Falha ao criar cliente no pagarme.",
      e.response.errors[0]
    );
  }

  // user customer.id and card info to create card in pagarme
  let card: Card;
  try {
    card = await p.createCard({
      card_number: data.card_number,
      card_expiration_date: data.card_expiration_date,
      card_holder_name: data.card_holder_name,
      customer_id: customer.id,
      card_hash: data.card_hash,
    });
  } catch (e) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Falha ao criar cartão para o cliente.",
      e.response.errors[0]
    );
  }

  // do pre-authorization of R$1,00 to make sure credit card is valid
  let transaction: Transaction;
  try {
    transaction = await p.createTransaction(
      card.id,
      100,
      { id: customer.id, name: customer.name },
      data.billing_address
    );
  } catch (e) {
    throw new functions.https.HttpsError(
      "unknown",
      "Falha ao fazer pré-autorização do cartão."
    );
  }

  // throw error if pre-approval failed
  if (transaction.status != "authorized") {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "expected 'authorized' pre-approval, but got " +
        transaction.status +
        ": " +
        transaction.status_reason
    );
  }

  // add new Card to Client's cards
  let responseCard: Client.Interface.Card = {
    id: card.id,
    holder_name: card.holder_name,
    brand: card.brand,
    last_digits: card.last_digits,
    first_digits: card.first_digits,
    expiration_date: card.expiration_date,
    pagarme_customer_id: customer.id,
    billing_address: data.billing_address,
  };
  const c = new Client(context.auth.uid);

  try {
    await c.addCard(responseCard);
  } catch (e) {
    throw new functions.https.HttpsError("unknown", "Algo deu errado!");
  }

  // return added card
  return responseCard;
};

const deleteCard = async (
  data: any,
  context: functions.https.CallableContext
) => {
  // do validations
  if (context.auth == null) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "Missing authentication credentials."
    );
  }
  validateArgument(data, ["card_id"], ["string"], [true]);

  const c = new Client(context.auth.uid);
  const client = await c.getClient();

  // update payment method to 'cash' if the card is the default
  let setPaymentMethodPromise;
  if (
    client?.payment_method.default == "credit_card" &&
    client.payment_method.card_id == data.card_id
  ) {
    setPaymentMethodPromise = c.setPaymentMethod("cash");
  }

  let deleteCardPromise = c.removeCardByID(data.card_id);

  return await Promise.all([setPaymentMethodPromise, deleteCardPromise]);
};

const getCardHashKey = async (
  _: any,
  context: functions.https.CallableContext
) => {
  // validate authentication
  if (context.auth == null) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "Missing authentication credentials."
    );
  }

  const p = new Pagarme();
  await p.ensureInitialized();
  return await p.getCardHashKey();
};

const setDefaultPaymentMethod = async (
  data: any,
  context: functions.https.CallableContext
) => {
  // do validations
  if (context.auth == null) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "Missing authentication credentials."
    );
  }
  validateArgument(data, ["card_id"], ["string"], [false]);

  const c = new Client(context.auth.uid);
  return await c.setPaymentMethod(
    data.card_id == undefined ? "cash" : "credit_card",
    data.card_id
  );
};

const captureUnpaidTrip = async (
  data: any,
  context: functions.https.CallableContext
) => {
  // do validations
  if (context.auth == null) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "Missing authentication credentials."
    );
  }
  validateArgument(data, ["card_id"], ["string"], [true]);

  // get client
  const c = new Client(context.auth.uid);
  let client = await c.getClient();

  // make sure client exists
  if (client == undefined) {
    throw new functions.https.HttpsError(
      "not-found",
      "Could not fiend client with id '" + context.auth.uid + "'"
    );
  }

  // make sure client has unpaid past trip
  if (client.unpaid_past_trip_id == undefined) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "There is no pending payments for the client."
    );
  }

  // get unpaid trip
  const cpt = new ClientPastTrips(context.auth.uid);
  let unpaidTrip = await cpt.getPastTrip(client.unpaid_past_trip_id);

  // make sure unpaid trip exists
  if (unpaidTrip == undefined) {
    // this should never happen, but if it does, unset unpaid trip
    await c.unsetUnpaidTrip();
    return true;
  }

  // make sure card_id corresponds to existing card
  let creditCard = await c.getCardByID(data.card_id);
  if (creditCard == undefined) {
    throw new functions.https.HttpsError(
      "not-found",
      "Client has no card with id '" + data.card_id + "'"
    );
  }

  // if capture succeeded, remove unpaid trip from client and return
  let response = await captureTripPayment(unpaidTrip, creditCard);
  if (response.success == true) {
    await c.unsetUnpaidTrip();
  }

  return response;
};

export const captureTripPayment = async (
  trip: TripRequest.Interface,
  creditCard?: Client.Interface.Card
): Promise<TripRequest.Payment> => {
  // make sure trip has transaction_id and partner
  if (trip.partner_id == undefined || trip.transaction_id == undefined) {
    return { success: false };
  }

  // create response object
  let response: TripRequest.Payment = {
    success: false,
  };

  // get partner who completed the trip
  let p = new Partner(trip.partner_id);
  let partner = await p.getPartner();

  // variable that will hold how much to discount from partner's receivables
  let paidOwedCommission;

  let owedCommission = await p.getOwedCommission();
  let venniAmount;
  // if partner owes us money
  if (owedCommission != null && owedCommission > 0) {
    // decrease what partner receives by the rounded minimum between
    // 80% of fare price and what he owes us
    paidOwedCommission = Math.ceil(
      Math.min(0.8 * trip.fare_price, owedCommission)
    );

    // venni should receive 20% + whatever was discounted from the partner.
    // we calculate Math.min here just to guarantee that client won't pay more than
    // trip.fare_price
    venniAmount = Math.floor(
      Math.min(trip.fare_price, 0.2 * trip.fare_price + paidOwedCommission)
    );
  }

  // initialize pagarme
  const pagarme = new Pagarme();
  await pagarme.ensureInitialized();

  // calculate how many days ago the trip was requested
  let diffTime = Date.now() - Number(trip.request_time);
  let diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  // if creditCard is defined and differs from the one used in trip
  // or it's been over 5 days since trip was done (e.g., authorized transaction
  // was automatially closed in pagarme)
  if (
    (creditCard != undefined && creditCard.id != trip.credit_card?.id) ||
    diffDays >= 5
  ) {
    if (creditCard == undefined) {
      return { success: false };
    }
    let transaction;
    try {
      // create a whole new transaction
      transaction = await pagarme.createTransaction(
        creditCard.id,
        trip.fare_price,
        { id: creditCard.pagarme_customer_id, name: creditCard.holder_name },
        creditCard.billing_address
      );
      if (transaction.status != "authorized") {
        return { success: false };
      }
    } catch (e) {
      console.log(e);
      return { success: false };
    }
    try {
      // capture new transaction
      transaction = await pagarme.captureTransaction(
        transaction.tid,
        trip.fare_price,
        partner?.pagarme_recipient_id,
        venniAmount
      );
      if (transaction.status != "paid") {
        return { success: false };
      }
    } catch (e) {
      console.log(e);
      return { success: false };
    }
  } else {
    // otherwise, simply capture trip's transactions
    try {
      let transaction = await pagarme.captureTransaction(
        trip.transaction_id,
        trip.fare_price,
        partner?.pagarme_recipient_id,
        venniAmount
      );
      if (transaction.status != "paid") {
        return { success: false };
      }
    } catch (e) {
      console.log(e);
      return { success: false };
    }
  }

  // if capture succeeded and the partner paid some amount he owed us
  if (paidOwedCommission != undefined) {
    // decrease amount owed
    await p.decreaseAmountOwedBy(paidOwedCommission);

    // build response with information about the capture
    response.venni_commission = Math.round(0.2 * trip.fare_price);
    response.previous_owed_commission = owedCommission ?? 0;
    response.paid_owed_commission = paidOwedCommission;
    response.current_owed_commission =
      response.previous_owed_commission - paidOwedCommission;
    if (venniAmount != undefined) {
      response.partner_amount_received = trip.fare_price - venniAmount;
    }
  } else {
    response.previous_owed_commission = 0;
    response.venni_commission = Math.round(0.2 * trip.fare_price);
    response.paid_owed_commission = 0;
    response.current_owed_commission = 0;
    response.partner_amount_received =
      trip.fare_price - response.venni_commission;
  }

  // mark response as successfull
  response.success = true;

  return response;
};

const createBankAccount = async (
  data: any,
  context: functions.https.CallableContext
) => {
  // do validations
  if (context.auth == null) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "Missing authentication credentials."
    );
  }
  validateCreateBankAccountArguments(data);

  // add a pagarme bank account to the partner
  const p = new Pagarme();
  await p.ensureInitialized();
  let bankAccount: BankAccount;
  try {
    let opts: BankAccountCreateOptions = {
      agencia: data.agencia,
      bank_code: data.bank_code,
      conta: data.conta,
      conta_dv: data.conta_dv,
      document_number: data.document_number,
      legal_name: data.legal_name,
      type: data.type,
    };
    if (data.agencia_dv != undefined) {
      opts["agencia_dv"] = data.agencia_dv;
    }
    bankAccount = await p.createBankAccount(opts);
  } catch (e) {
    console.log(e.response.errors[0]);
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Falha ao criar conta bancária no pagarme.",
      e.response.errors[0]
    );
  }

  // add created bankAccount to partner
  const partner = new Partner(context.auth.uid);
  let appBankAccount: Partner.AppBankAccount;
  try {
    appBankAccount = {
      id: bankAccount.id,
      agencia: bankAccount.agencia,
      agencia_dv: bankAccount.agencia_dv,
      conta: bankAccount.conta,
      conta_dv: bankAccount.conta_dv,
      type: bankAccount.type,
      charge_transfer_fees: bankAccount.charge_transfer_fees,
      bank_code: bankAccount.bank_code,
      document_number: bankAccount.document_number,
      legal_name: bankAccount.legal_name,
    };
    await partner.createBankAccount(appBankAccount);
  } catch (e) {
    throw new functions.https.HttpsError("unknown", "Algo deu errado!");
  }

  // return added bank account
  return appBankAccount;
};

const getBalance = async (
  data: any,
  context: functions.https.CallableContext
) => {
  // do validations
  if (context.auth == null) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "Missing authentication credentials."
    );
  }
  validateArgument(data, ["pagarme_recipient_id"], ["string"], [true]);

  let balance: BalanceResponse;
  try {
    const pagarme = new Pagarme();
    await pagarme.ensureInitialized();
    balance = await pagarme.getBalance({
      recipientId: data.pagarme_recipient_id,
    });
  } catch (e) {
    console.log(e.response.errors[0]);
    throw new functions.https.HttpsError(
      "unknown",
      "Falha ao solicitar saldo do recipiente com id " +
        data.pagarme_recipient_id +
        ".",
      e.response.errors[0]
    );
  }
  return balance;
};

const getTransfers = async (
  data: any,
  context: functions.https.CallableContext
) => {
  // do validations
  if (context.auth == null) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "Missing authentication credentials."
    );
  }
  validateArgument(
    data,
    ["count", "page", "pagarme_recipient_id"],
    ["number", "number", "string"],
    [true, true, true]
  );

  let transfers: Transfer[];
  try {
    const pagarme = new Pagarme();
    await pagarme.ensureInitialized();
    transfers = await pagarme.getTransfers({
      count: data.count,
      page: data.page,
      recipient_id: data.pagarme_recipient_id,
    });
  } catch (e) {
    console.log(e.response.errors[0]);
    throw new functions.https.HttpsError(
      "unknown",
      "Falha ao solicitar trasnferências do recipiente com id " +
        data.pagarme_recipient_id +
        ".",
      e.response.errors[0]
    );
  }
  return transfers;
};

export const create_card = functions.https.onCall(createCard);
export const delete_card = functions.https.onCall(deleteCard);
export const get_card_hash_key = functions.https.onCall(getCardHashKey);
export const set_default_payment_method = functions.https.onCall(
  setDefaultPaymentMethod
);
export const capture_unpaid_trip = functions.https.onCall(captureUnpaidTrip);
export const create_bank_account = functions.https.onCall(createBankAccount);
export const get_balance = functions.https.onCall(getBalance);
export const get_transfers = functions.https.onCall(getTransfers);
