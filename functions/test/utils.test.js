const at = require("../lib/utils");
const chai = require("chai");
const assert = chai.assert;

describe("AsyncTimeout.set", () => {
  it("waits before returning result", async () => {
    // instantiate AsyncTimeout
    let asyncTimeout = new at.AsyncTimeout();

    // define function to be called
    let f = () => {
      return "f result";
    };

    // save time
    let executingBeginTime = Date.now();

    // call f after 100 milliseconds
    const result = asyncTimeout.set(f, 100);

    // assert that result is correct
    assert.equal(await result, "f result");
    // assert that at least 100 ms have passed
    assert.isTrue(Date.now() - executingBeginTime >= 100);
  });

  it("set works with callbacks that return void", async () => {
    // instantiate AsyncTimeout
    let asyncTimeout = new at.AsyncTimeout();

    // define function to be called
    let f = () => {
      return;
    };

    // save time
    let executingBeginTime = Date.now();

    // call f after 100 milliseconds
    const result = asyncTimeout.set(f, 100);

    // assert that result is correct
    assert.equal(await result, undefined);
    // assert that at least 100 ms have passed
    assert.isTrue(Date.now() - executingBeginTime >= 100);
  });

  it("cancels timeout if clear is called", async () => {
    // instantiate AsyncTimeout
    let asyncTimeout = new at.AsyncTimeout();

    // define function to be called
    let f = () => {
      return "f result";
    };

    // save now
    let executingBeginTime = Date.now();

    // call f after 100 milliseconds
    const result = asyncTimeout.set(f, 100);

    // sleep for a bit
    await at.sleep(50);

    // cancel calling f
    let cancelTime = Date.now();
    asyncTimeout.clear();

    // assert that result is undefined, since it was never set in the first place
    assert.equal(await result, undefined);
    // assert that await result didn't take long to complet (we indeed cancelled timeout)
    assert.isTrue(Date.now() - cancelTime < 20);
    // assert that 100 ms have not passed since execution start
    assert.isTrue(Date.now() - executingBeginTime < 100);
  });
});
