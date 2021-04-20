import * as firebaseAdmin from "firebase-admin";

// sleep returns a promise which resolves after ms milliseconds.
// call await sleep(ms) to pause execution for ms milliseconds.
export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// my own implementation of NodeJs.Timeout, setTimeout and clearTimeout
export class AsyncTimeout {
  private _timer: NodeJS.Timeout | null;
  private _wasCleared: boolean;
  private _functionWasExecuted: boolean;

  get timer(): NodeJS.Timeout | null {
    return this._timer;
  }

  get wasCleared(): boolean {
    return this._wasCleared;
  }

  constructor() {
    this._timer = null;
    this._wasCleared = false;
    this._functionWasExecuted = false;
  }

  clear() {
    if (this._timer != null) {
      clearTimeout(this._timer);
      this._timer = null;
      this._wasCleared = true;
    }
  }

  // set is similar to setTimeout. The difference is that, instead
  // of returning a timer that can be used to cancel calling the function,
  // it returns a promise which resolves with the function's result after ms
  // have passed or clear is called.
  set(f: Function, ms: number) {
    // reset state variables
    this._timer = null;
    this._wasCleared = false;
    this._functionWasExecuted = false;

    return new Promise(async (resolve) => {
      // where we store the result of calling f
      let result;

      // schedule 'f' to be called after ms interval and set _timer
      // so so client can cancel calling f
      this._timer = setTimeout(() => {
        result = f();
        // mark function as executed so we abort waiting ms
        this._functionWasExecuted = true;
      }, ms);

      // sleep as long as 'f' is not executed and timeout is not cleared
      do {
        await sleep(1);
      } while (!this._functionWasExecuted && this._wasCleared == false);

      // resolve promise with result from f
      resolve(result);
    });
  }
}

export interface LooseObject {
  [key: string]: any;
}

// transaction is an asynchronous a wrapper on firebase database's transaction
// It returns a promise which only resolves after onComplete finishes. Moreover,
// it catches any errors thrown by onComplete and re-throws them in the toplevel stack.
export const transaction = async (
  ref: firebaseAdmin.database.Reference,
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
