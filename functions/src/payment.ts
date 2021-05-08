import * as functions from "firebase-functions";
import * as firebaseAdmin from "firebase-admin";
import { Client } from "./database/client";
import { validateArgument, phoneHasE164Format } from "./utils";
import { pagarme } from "./vendors/pagarme";
import { Customer } from "pagarme-js-types/src/client/customers/responses";
import { Card } from "pagarme-js-types/src/client/cards/responses";

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
    ],
    ["string", "string", "string", "string", "string", "object"],
    [true, true, true, true, true, true]
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
  // validate authentication
  if (context.auth == null) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "Missing authentication credentials."
    );
  }

  // validate arguments
  validateCreateCardArguments(data);

  // get client data
  const clientID = context.auth.uid;
  const userRecord = await firebaseAdmin.auth().getUser(clientID);
  if (userRecord.email == undefined) {
    // this should never happen
    throw new functions.https.HttpsError(
      "failed-precondition",
      "Client with id '" + userRecord.uid + "' has no registered email."
    );
  }
  if (userRecord.phoneNumber == undefined) {
    // this should never happen
    throw new functions.https.HttpsError(
      "failed-precondition",
      "Client with id '" + userRecord.uid + "' has no registered phone number."
    );
  }

  // create a pagarme customer
  const p = new pagarme();
  await p.ensureInitialized();
  let customer: Customer;
  try {
    customer = await p.createCustomer({
      external_id: context.auth.uid,
      name: data.card_holder_name,
      type: "individual",
      country: "br",
      email: userRecord.email,
      documents: [
        {
          type: "cpf",
          number: data.cpf_number,
        },
      ],
      phone_numbers: [userRecord.phoneNumber],
    });
  } catch (e) {
    throw new functions.https.HttpsError(
      "unknown",
      "Falha ao criar cliente no pagarme.",
      e
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
      "unknown",
      "Falha ao criar cartão para o cliente.",
      e.response.errors[0]
    );
  }

  // user customer.id, card.id and billing_address to add Card to Client
  let responseCard: Client.Interface.Card = {
    id: card.id,
    last_digits: card.last_digits,
    pagarme_customer_id: customer.id,
    billing_address: data.billing_address,
  };
  const c = new Client(clientID);
  await c.addCard(responseCard);

  return responseCard;
};

export const create_card = functions.https.onCall(createCard);
