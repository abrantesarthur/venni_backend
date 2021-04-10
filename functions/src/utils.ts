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

  // setTimeout is similar to setTimeout. The difference is that, instead
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
      this._wasCleared = false;
      this._timer = setTimeout(() => {
        result = f();
        // mark function as executed
        this._functionWasExecuted = true;
      }, ms);

      // sleep as long as result is undefined and timeout is not cleared
      do {
        await sleep(1);
      } while (!this._functionWasExecuted && this._wasCleared == false);

      // resolve promise with result from f
      resolve(result);
    });
  }
}