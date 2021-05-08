import * as functions from "firebase-functions";

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

export const validateArgument = (
  obj: any,
  validKeys: string[],
  expectedTypes: string[],
  mustBePresent: boolean[]
) => {
  if (obj == undefined || obj == null) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "missing expected argument."
    );
  }

  if (
    validKeys.length != expectedTypes.length ||
    validKeys.length != mustBePresent.length ||
    expectedTypes.length != mustBePresent.length
  ) {
    // TODO: should probably throw internal error
    return;
  }

  // make sure that all mandatory keys are present in object
  mustBePresent.forEach((value, index) => {
    if (value == true) {
      let mandatoryKey = validKeys[index];
      let hasMandatoryKey = false;

      Object.keys(obj).forEach((key) => {
        if (key == mandatoryKey) {
          hasMandatoryKey = true;
        }
      });

      if (!hasMandatoryKey) {
        throw new functions.https.HttpsError(
          "invalid-argument",
          "missing expected argument '" + mandatoryKey + "'."
        );
      }
    }
  });

  // make sure taht all keys in object are valid and have the expected type
  Object.keys(obj).forEach((key) => {
    let isValidKey = false;
    let hasValidType = false;
    let expectedType = "";

    // iterate over valid keys
    for (var i = 0; i < validKeys.length; i++) {
      // if object key is valid
      if (key == validKeys[i]) {
        isValidKey = true;

        // check whether type of value is what we expected
        if (typeof obj[key] == expectedTypes[i]) {
          hasValidType = true;
        }
        expectedType = expectedTypes[i];
        break;
      }
    }

    if (!isValidKey) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "argument " + key + " shouldn't be present"
      );
    }

    if (!hasValidType) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "argument '" +
          key +
          "' has invalid type. Expected '" +
          expectedType +
          "'. Received '" +
          typeof obj[key] +
          "'."
      );
    }
  });
};

export function phoneHasE164Format(phoneNumber: string) {
  const regEx = /^\+[1-9]\d{10,14}$/;

  return regEx.test(phoneNumber);
}
