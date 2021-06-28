import * as functions from "firebase-functions";
import { Partner } from "./database/partner";
import { validateArgument } from "./utils";

const _connect = async (
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
    ["current_latitude", "current_longitude"],
    ["number", "number"],
    [true, true]
  );

  // partner's account_status must be valid
  const partnerID = context.auth.uid;
  const p = new Partner(partnerID);
  const partner = await p.getPartner();
  if (partner == undefined) {
    throw new functions.https.HttpsError(
      "not-found",
      "could not find partner with uid " + context.auth.uid
    );
  }
  if (partner.account_status != Partner.AccountStatus.approved) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "partner with uid " +
        context.auth.uid +
        " doesn't have an 'approved' account"
    );
  }

  // partner must be unavailable
  if (partner.status !== Partner.Status.unavailable) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "partner with uid " +
        context.auth.uid +
        " doesn't have 'unavailable' status"
    );
  }

  // if partner meets all criteria, connect them
  try {
    await p.connect(data.current_latitude, data.current_longitude);
  } catch (e) {
    throw new functions.https.HttpsError(
      "internal",
      "something went wrong. Try again later"
    );
  }
};

const _disconnect = async (
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

  // partner's account_status must be valid
  const partnerID = context.auth.uid;
  const p = new Partner(partnerID);
  const partner = await p.getPartner();
  if (partner == undefined) {
    throw new functions.https.HttpsError(
      "not-found",
      "could not find partner with uid " + context.auth.uid
    );
  }
  if (partner.account_status != Partner.AccountStatus.approved) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "partner with uid " +
        context.auth.uid +
        " doesn't have an 'approved' account"
    );
  }

  // partner must be 'available'
  if (partner.status !== Partner.Status.available) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "partner with uid " +
        context.auth.uid +
        " doesn't have 'available' status"
    );
  }

  // if partner meets all criteria, disconnect them
  try {
    await p.disconnect();
  } catch (e) {
    throw new functions.https.HttpsError(
      "internal",
      "something went wrong. Try again later"
    );
  }
};

export const connect = functions.https.onCall(_connect);
export const disconnect = functions.https.onCall(_disconnect);
