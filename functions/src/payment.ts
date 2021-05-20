import * as functions from "firebase-functions";
import { Client } from "./database/client";
import { validateArgument, phoneHasE164Format } from "./utils";
import { Pagarme } from "./vendors/pagarme";
import { Customer } from "pagarme-js-types/src/client/customers/responses";
import { Card } from "pagarme-js-types/src/client/cards/responses";
import { Transaction } from "pagarme-js-types/src/client/transactions/responses";
import { ClientPastTrips } from "./database/pastTrips";
import { Pilot } from "./database/pilot";
import { TripRequest } from "./database/tripRequest";

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

  const validDigits = (digits: string, expectedLength: number) => {
    // digits must have expected length
    if (digits.length != expectedLength) {
      return false;
    }

    // all characters in digits must be integers
    for (var i = 0; i < digits.length; i++) {
      if (isNaN(parseInt(digits[i], 10))) {
        return false;
      }
    }
    return true;
  };

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
  let captureSucceeded = await captureTripPayment(unpaidTrip, creditCard);
  if (captureSucceeded) {
    await c.unsetUnpaidTrip();
  }

  return captureSucceeded;
};

export const captureTripPayment = async (
  trip: TripRequest.Interface,
  creditCard?: Client.Interface.Card
): Promise<boolean> => {
  // make sure trip has transaction_id and pilot
  if (trip.pilot_id == undefined || trip.transaction_id == undefined) {
    return false;
  }
  // get pilot who completed the trip
  let p = new Pilot(trip.pilot_id);
  let pilot = await p.getPilot();

  // variable that will hold how much to discount from pilot's receivables
  let pilotReceivableDiscount;

  let amountOwed = await p.getAmountOwed();
  let venniAmount;
  // if pilot owes us money
  if (amountOwed != null && amountOwed > 0) {
    // decrease what pilot receives by the rounded minimum between
    // 80% of fare price and what he owes us
    pilotReceivableDiscount = Math.ceil(
      Math.min(0.8 * trip.fare_price, amountOwed)
    );

    // venni should receive 20% + whatever was discounted from the pilot.
    // we calculate Math.min here just to guarantee that client won't pay more than
    // trip.fare_price
    venniAmount = Math.floor(
      Math.min(trip.fare_price, 0.2 * trip.fare_price + pilotReceivableDiscount)
    );
  }

  // initialize pagarme
  const pagarme = new Pagarme();
  await pagarme.ensureInitialized();

  // if creditCard is defined and differs from the one used in trip
  if (creditCard != undefined && creditCard.id != trip.credit_card?.id) {
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
        return false;
      }
    } catch (e) {
      return false;
    }
    try {
      // capture new transaction
      transaction = await pagarme.captureTransaction(
        transaction.tid,
        trip.fare_price,
        pilot?.pagarme_receiver_id,
        venniAmount
      );
      if (transaction.status != "paid") {
        return false;
      }
    } catch (e) {
      return false;
    }
  } else {
    // otherwise, simply capture trip's transactions
    try {
      let transaction = await pagarme.captureTransaction(
        trip.transaction_id,
        trip.fare_price,
        pilot?.pagarme_receiver_id,
        venniAmount
      );
      if (transaction.status != "paid") {
        return false;
      }
    } catch (e) {
      return false;
    }
  }
  // if capture succeeded and the pilot paid some amount he owed us
  if (pilotReceivableDiscount != undefined) {
    // decrease amount owed
    await p.decreaseAmountOwedBy(pilotReceivableDiscount);
  }
  return true;
};

export const create_card = functions.https.onCall(createCard);
export const delete_card = functions.https.onCall(deleteCard);
export const get_card_hash_key = functions.https.onCall(getCardHashKey);
export const set_default_payment_method = functions.https.onCall(
  setDefaultPaymentMethod
);
export const capture_unpaid_trip = functions.https.onCall(captureUnpaidTrip);
