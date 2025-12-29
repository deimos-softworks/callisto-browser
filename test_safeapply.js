let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log("[PASS]", name);
    passed++;
  } catch (e) {
    console.log("[FAIL]", name, "-", e.message);
    failed++;
  }
}

function expect(condition, msg) {
  if (!condition) throw new Error(msg || "assertion failed");
}

function getStack() {
  return new Error().stack;
}

test("basic call", () => {
  let called = false;
  Callisto.safeApply(() => { called = true; }, null, []);
  expect(called, "function was not called");
});

test("return value passthrough", () => {
  const result = Callisto.safeApply((a, b) => a + b, null, [5, 3]);
  expect(result === 8, "expected 8, got " + result);
});

test("this binding", () => {
  const obj = { x: 42 };
  const result = Callisto.safeApply(function() { return this.x; }, obj, []);
  expect(result === 42, "expected 42, got " + result);
});

test("null this converts to undefined", () => {
  const result = Callisto.safeApply(function() { return this; }, null, []);
  expect(result === undefined || result === globalThis, "this was not undefined/global");
});

test("caller hidden from stack", () => {
  function caller() {
    Callisto.safeApply(function() {
      const stack = getStack();
      expect(!stack.includes("caller"), "caller visible in stack");
    }, null, []);
  }
  caller();
});

test("multiple arguments", () => {
  const result = Callisto.safeApply((a, b, c, d, e) => a + b + c + d + e, null, [1, 2, 3, 4, 5]);
  expect(result === 15, "expected 15, got " + result);
});

test("empty arguments", () => {
  const result = Callisto.safeApply(() => "ok", null, []);
  expect(result === "ok", "expected 'ok'");
});

test("undefined arguments array", () => {
  const result = Callisto.safeApply(() => "ok", null, undefined);
  expect(result === "ok", "expected 'ok'");
});

test("null arguments array", () => {
  const result = Callisto.safeApply(() => "ok", null, null);
  expect(result === "ok", "expected 'ok'");
});

test("exception propagation", () => {
  let caught = false;
  try {
    Callisto.safeApply(() => { throw new Error("test"); }, null, []);
  } catch (e) {
    caught = true;
    expect(e.message === "test", "wrong error message");
  }
  expect(caught, "exception not propagated");
});

test("caller hidden in exception stack", () => {
  function exceptionCaller() {
    try {
      Callisto.safeApply(() => { throw new Error("test"); }, null, []);
    } catch (e) {
      expect(!e.stack.includes("exceptionCaller"), "exceptionCaller visible in exception stack");
    }
  }
  exceptionCaller();
});

test("nested safeApply", () => {
  function outer() {
    Callisto.safeApply(function middle() {
      Callisto.safeApply(function inner() {
        const stack = getStack();
        expect(!stack.includes("outer"), "outer visible");
        expect(!stack.includes("middle"), "middle visible");
      }, null, []);
    }, null, []);
  }
  outer();
});

test("rapid sequential calls", () => {
  for (let i = 0; i < 1000; i++) {
    Callisto.safeApply((x) => x * 2, null, [i]);
  }
});

test("recursive safeApply", () => {
  let count = 0;
  function recurse(n) {
    count++;
    if (n > 0) Callisto.safeApply(recurse, null, [n - 1]);
  }
  Callisto.safeApply(recurse, null, [50]);
  expect(count === 51, "expected 51 calls, got " + count);
});

test("caller restored after call", () => {
  function a() {
    Callisto.safeApply(() => {}, null, []);
    const stack = getStack();
    expect(stack.includes("a"), "a should be visible after safeApply returns");
  }
  a();
});

test("invalid first argument - null", () => {
  let threw = false;
  try {
    Callisto.safeApply(null, null, []);
  } catch (e) {
    threw = true;
  }
  expect(threw, "should throw for null function");
});

test("invalid first argument - number", () => {
  let threw = false;
  try {
    Callisto.safeApply(42, null, []);
  } catch (e) {
    threw = true;
  }
  expect(threw, "should throw for number");
});

test("invalid first argument - string", () => {
  let threw = false;
  try {
    Callisto.safeApply("function", null, []);
  } catch (e) {
    threw = true;
  }
  expect(threw, "should throw for string");
});

test("invalid arguments - not array", () => {
  let threw = false;
  try {
    Callisto.safeApply(() => {}, null, "notarray");
  } catch (e) {
    threw = true;
  }
  expect(threw, "should throw for non-array arguments");
});

test("native function", () => {
  const arr = [3, 1, 2];
  Callisto.safeApply(arr.sort, arr, []);
  expect(arr[0] === 1 && arr[1] === 2 && arr[2] === 3, "sort failed");
});

test("bound function", () => {
  const obj = { x: 10 };
  const fn = function() { return this.x; }.bind(obj);
  const result = Callisto.safeApply(fn, { x: 20 }, []);
  expect(result === 10, "bound this should take precedence");
});

test("async function", async () => {
  const result = await Callisto.safeApply(async () => {
    return await Promise.resolve(42);
  }, null, []);
  expect(result === 42, "expected 42, got " + result);
});

test("generator function", () => {
  function* gen() { yield 1; yield 2; yield 3; }
  const iterator = Callisto.safeApply(gen, null, []);
  expect(iterator.next().value === 1, "first yield wrong");
  expect(iterator.next().value === 2, "second yield wrong");
  expect(iterator.next().value === 3, "third yield wrong");
});

test("large arguments array", () => {
  const args = Array(1000).fill(1);
  const result = Callisto.safeApply((...a) => a.reduce((x, y) => x + y, 0), null, args);
  expect(result === 1000, "expected 1000, got " + result);
});

test("concurrent callers hidden independently", () => {
  function callerA() {
    Callisto.safeApply(() => {
      function callerB() {
        Callisto.safeApply(() => {
          const stack = getStack();
          expect(!stack.includes("callerA"), "callerA visible");
          expect(!stack.includes("callerB"), "callerB visible");
        }, null, []);
      }
      callerB();
    }, null, []);
  }
  callerA();
});

console.log("\n========================================");
console.log("PASSED:", passed);
console.log("FAILED:", failed);
console.log("========================================");
