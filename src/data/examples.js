// Example program library. Each entry is real, runnable JavaScript — the
// AST analyzer and execution engine treat these exactly like user-typed code.

export const EXAMPLE_CATEGORIES = [
  "Basics",
  "Closures",
  "Scope",
  "Promises",
  "Async/Await",
  "Event Loop",
  "Timers",
  "References",
  "Recursion",
  "Performance",
];

export const EXAMPLES = [
  {
    id: "basics-hello",
    category: "Basics",
    title: "Hello, name",
    description:
      "A variable read inside a function call — the smallest possible trace.",
    code: `const name = "Ali";

function greet() {
  console.log(name);
}

greet();
`,
  },
  {
    id: "basics-functions",
    category: "Basics",
    title: "Function calls & returns",
    description: "Nested calls building up a call stack of three frames.",
    code: `function square(n) {
  return n * n;
}

function sumOfSquares(a, b) {
  return square(a) + square(b);
}

console.log(sumOfSquares(3, 4));
`,
  },
  {
    id: "closures-counter",
    category: "Closures",
    title: "Counter closure",
    description:
      "A returned function that keeps a private, persistent reference to count.",
    code: `function createCounter() {
  let count = 0;

  return function () {
    count++;
    return count;
  };
}

const counter = createCounter();
counter();
counter();
console.log(counter());
`,
  },
  {
    id: "closures-multiple",
    category: "Closures",
    title: "Independent closures",
    description:
      "Two calls to the same factory create two separate closure environments.",
    code: `function createCounter() {
  let count = 0;
  return () => ++count;
}

const a = createCounter();
const b = createCounter();

console.log(a());
console.log(a());
console.log(b());
`,
  },
  {
    id: "scope-block",
    category: "Scope",
    title: "Block scope vs function scope",
    description: "let is block-scoped; var leaks out of the if block.",
    code: `function demo() {
  if (true) {
    let blockScoped = "inside";
    var functionScoped = "leaks out";
  }
  console.log(functionScoped);
}

demo();
`,
  },
  {
    id: "scope-shadowing",
    category: "Scope",
    title: "Variable shadowing",
    description:
      "An inner scope declares a variable with the same name as an outer one.",
    code: `const value = "outer";

function reveal() {
  const value = "inner";
  console.log(value);
}

reveal();
console.log(value);
`,
  },
  {
    id: "promises-chain",
    category: "Promises",
    title: "Promise chain",
    description: "then() handlers run as microtasks, one after another.",
    code: `Promise.resolve(1)
  .then((n) => n + 1)
  .then((n) => n * 2)
  .then((n) => console.log("result:", n));

console.log("chain scheduled");
`,
  },
  {
    id: "promises-reject",
    category: "Promises",
    title: "Rejection & catch",
    description: "A rejected promise skips then() and is handled by catch().",
    code: `Promise.reject(new Error("boom"))
  .then(() => console.log("never runs"))
  .catch((err) => console.log("caught:", err.message));
`,
  },
  {
    id: "async-basic",
    category: "Async/Await",
    title: "Await pauses execution",
    description:
      'The function yields at await; "end" only logs after the promise settles.',
    code: `function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function load() {
  console.log("start");
  await wait(0);
  console.log("end");
}

load();
console.log("after load() call");
`,
  },
  {
    id: "eventloop-abcd",
    category: "Event Loop",
    title: "Microtasks vs macrotasks",
    description:
      "The classic ordering puzzle: sync code, then microtasks, then timers.",
    code: `console.log("A");

setTimeout(() => {
  console.log("B");
}, 0);

Promise.resolve().then(() => {
  console.log("C");
});

console.log("D");
`,
  },
  {
    id: "timers-order",
    category: "Timers",
    title: "Timer ordering",
    description:
      "Timers with different delays are not guaranteed to run in declaration order.",
    code: `setTimeout(() => console.log("100ms"), 100);
setTimeout(() => console.log("0ms"), 0);
setTimeout(() => console.log("50ms"), 50);
console.log("synchronous");
`,
  },
  {
    id: "timers-interval",
    category: "Timers",
    title: "setInterval with clear",
    description: "An interval that stops itself after a few ticks.",
    code: `let ticks = 0;

const id = setInterval(() => {
  ticks++;
  console.log("tick", ticks);
  if (ticks >= 3) {
    clearInterval(id);
  }
}, 10);
`,
  },
  {
    id: "references-object",
    category: "References",
    title: "Object aliasing",
    description:
      "Two variables pointing at the same object — mutating one affects the other.",
    code: `const user = { name: "Ali" };
const admin = user;

admin.name = "Zara";

console.log(user.name);
console.log(admin.name);
`,
  },
  {
    id: "references-copy",
    category: "References",
    title: "Shallow copy",
    description:
      "Spreading creates a new top-level object with an independent reference.",
    code: `const original = { count: 1 };
const copy = { ...original };

copy.count = 2;

console.log(original.count);
console.log(copy.count);
`,
  },
  {
    id: "recursion-factorial",
    category: "Recursion",
    title: "Factorial",
    description: "Each recursive call pushes a new frame onto the call stack.",
    code: `function factorial(n) {
  if (n <= 1) return 1;
  return n * factorial(n - 1);
}

console.log(factorial(5));
`,
  },
  {
    id: "recursion-fibonacci",
    category: "Recursion",
    title: "Fibonacci",
    description:
      "Branching recursion — watch the call stack depth grow and shrink.",
    code: `function fib(n) {
  if (n < 2) return n;
  return fib(n - 1) + fib(n - 2);
}

console.log(fib(6));
`,
  },
  {
    id: "performance-loop",
    category: "Performance",
    title: "Loop with function calls",
    description:
      "Repeated calls to a small function — useful for the performance panel.",
    code: `function double(n) {
  return n * 2;
}

let total = 0;
for (let i = 0; i < 1000; i++) {
  total += double(i);
}

console.log(total);
`,
  },
];

export function getExamplesByCategory() {
  return EXAMPLE_CATEGORIES.map((category) => ({
    category,
    examples: EXAMPLES.filter((example) => example.category === category),
  })).filter((group) => group.examples.length > 0);
}

export const DEFAULT_EXAMPLE = EXAMPLES[0];
