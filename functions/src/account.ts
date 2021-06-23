import * as functions from "firebase-functions";
import * as firebaseAdmin from "firebase-admin";

import { Client } from "./database/client";
import { Partner } from "./database/partner";

const deletePartner = async (
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

  // delete partner entry in database
  const uid = context.auth.uid;
  try {
    const p = new Partner(uid);
    await p.remove();
  } catch (e) {
    throw new functions.https.HttpsError(
      "internal",
      "failed to remove partner"
    );
  }

  // delete partner's storage data
  try {
    const getFilesResponse = await firebaseAdmin
      .storage()
      .bucket()
      .getFiles({
        prefix: "partner-documents/" + uid,
      });
    getFilesResponse[0].forEach(async (file) => {
      await file.delete();
    });
  } catch (e) {}

  // check whether user also has a client account
  const c = new Client(uid);
  const client = await c.getClient();

  // if they don't, delete authentication credentials
  if (client == undefined) {
    try {
      await firebaseAdmin.auth().deleteUser(uid);
    } catch (e) {
      throw new functions.https.HttpsError(
        "internal",
        "failed to remove partner"
      );
    }
  }
};

const deleteClient = async (
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

  // delete client entry in database
  const uid = context.auth.uid;
  try {
    const c = new Client(uid);
    await c.remove();
  } catch (e) {
    throw new functions.https.HttpsError("internal", "failed to remove client");
  }

  // delete client's storage data
  try {
    const getFilesResponse = await firebaseAdmin
      .storage()
      .bucket()
      .getFiles({
        prefix: "user-photos/" + uid,
      });
    getFilesResponse[0].forEach(async (file) => {
      await file.delete();
    });
  } catch (_) {}

  // check whether user also has a partner account
  const p = new Partner(uid);
  const partner = await p.getPartner();

  // if they don't, delete authentication credentials
  if (partner == undefined) {
    try {
      await firebaseAdmin.auth().deleteUser(uid);
    } catch (e) {
      throw new functions.https.HttpsError(
        "internal",
        "failed to remove client"
      );
    }
  }
};

export const delete_partner = functions.https.onCall(deletePartner);
export const delete_client = functions.https.onCall(deleteClient);
