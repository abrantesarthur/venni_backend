import * as firebaseAdmin from "firebase-admin";
import { sleep } from "../utils";

export class Database {
  protected readonly DB: Database.Type;

  constructor() {
    this.DB = firebaseAdmin.database();
  }
}

// define Database namespace to be merged with Database class
export namespace Database {
  export type Type = firebaseAdmin.database.Database;
  export type Reference = firebaseAdmin.database.Reference;
  export type DataSnapshot = firebaseAdmin.database.DataSnapshot;
}

// transaction is an asynchronous a wrapper on firebase database's transaction
// It returns a promise which only resolves after onComplete finishes. Moreover,
// it catches any errors thrown by onComplete and re-throws them in the toplevel stack.
export const transaction = async (
  ref: Database.Reference,
  transactionUpdate: (a: any) => any,
  onComplete?: (
    a: Error | null,
    b: boolean,
    c: firebaseAdmin.database.DataSnapshot | null
  ) => any
) => {
  let onCompleteFinished = false;
  let transactionError;

  // onCompleteWrapper is just like onComplete, with the difference that it  sets
  // onCompleteFinished to true once if finishes.
  const onCompleteWrapper = async (
    e: Error | null,
    complete: boolean,
    snapshot: firebaseAdmin.database.DataSnapshot | null
  ) => {
    if (onComplete != undefined) {
      if (onComplete.constructor.name === "AsyncFunction") {
        try {
          await onComplete(e, complete, snapshot);
        } catch (e) {
          transactionError = e;
        }
      } else {
        try {
          onComplete(e, complete, snapshot);
        } catch (e) {
          transactionError = e;
        }
      }
      onCompleteFinished = true;
    } else {
      onCompleteFinished = true;
    }
  };
  // run a transaction on ref using transactionUpdate and a onCompleteWrapper as callback
  ref.transaction(transactionUpdate, onCompleteWrapper);

  // wait until onCompleteWrapper finishes executing before returning.
  do {
    await sleep(1);
  } while (onCompleteFinished == false);

  if (transactionError != undefined) {
    throw transactionError;
  }
};
