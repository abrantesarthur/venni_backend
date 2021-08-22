import * as functions from "firebase-functions";
import { Partner } from "./database/partner";
import { Partners } from "./database/partners";
import { LooseObject, validateArgument } from "./utils";

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

const getByID = async (
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
  validateArgument(data, ["partner_id"], ["string"], [true]);

  const p = new Partner(data.partner_id);
  const partner = await p.getPartner();
  if (partner == undefined) {
    throw new functions.https.HttpsError(
      "not-found",
      "could not find partner with uid " + data.partner_id
    );
  }

  return partner;
};


const getApproved = async (
  _: any,
  context: functions.https.CallableContext
) => {
  // do validations
  if (context.auth == null) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "Missing authentication credentials."
    );
  }
  const ps = new Partners();
  const partners = await ps.findAllApproved();

  let response: any[] = []

  partners.forEach((partner) => {
    response.push({
      partner_status: partner.status,
      partner_latitude: partner.current_latitude,
      partner_longitude: partner.current_longitude,
    })
  });

  return response;

}


export const connect = functions.https.onCall(_connect);
export const disconnect = functions.https.onCall(_disconnect);
export const get_by_id = functions.https.onCall(getByID);
export const get_stats = functions.https.onCall(getApproved);
