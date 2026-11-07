import { defineConfig } from "oxlint";

// Written in TypeScript rather than JSON so the layer rules share their lists instead of repeating
// them in every override.

const FRAMEWORK = ["react", "react-dom", "react-dom/*"];

const NO_UI_IN_LOGIC = {
  group: ["**/ui/**", ...FRAMEWORK],
  message:
    "Logic and data layers stay free of UI and framework code: keep it in src/ui and pass the result in as a parameter.",
};

const NO_LOGIC_OR_UI_IN_DATA = {
  group: ["**/ui/**", "**/logic/**", ...FRAMEWORK],
  message:
    "The data layer does not import logic or UI: move the shared code into src/data or pass the result in as a parameter.",
};

const NO_NODE_MODULES = {
  group: [
    "node:*",
    "assert",
    "buffer",
    "child_process",
    "crypto",
    "events",
    "fs",
    "fs/*",
    "http",
    "https",
    "module",
    "net",
    "os",
    "path",
    "path/*",
    "perf_hooks",
    "process",
    "stream",
    "stream/*",
    "timers",
    "timers/*",
    "url",
    "util",
    "worker_threads",
    "zlib",
  ],
  message:
    "Logic and data layers run in the browser: pass Node I/O in as a parameter from scripts/ or a test.",
};

const restrictedGlobals = (names: readonly string[], message: string) =>
  names.map((name) => ({ name, message }));

// Every restricted global except the clock, which the self-timing tests below may read.
const BROWSER_AND_IO_GLOBALS = [
  ...restrictedGlobals(
    ["window", "document", "navigator", "self", "globalThis", "postMessage"],
    "Logic and data layers must not depend on the browser: pass the value in as a parameter.",
  ),
  ...restrictedGlobals(
    ["localStorage", "sessionStorage", "indexedDB"],
    "Persistence goes through the storage adapter: pass load and save in as parameters.",
  ),
  ...restrictedGlobals(
    ["fetch", "XMLHttpRequest"],
    "I/O stays outside logic and data: pass it in as a parameter (a function such as (url) => Promise<Response>).",
  ),
  ...restrictedGlobals(
    ["setTimeout", "setInterval"],
    "Timers are effects: schedule in the UI or pass a scheduler in as a parameter.",
  ),
];

// Rules switched on with no options, one name per line of `names`. A template string rather than an
// array, so the long lists do not read as copies of each other to the duplication check.
const errors = (prefix: string, names: string) =>
  Object.fromEntries(
    names
      .trim()
      .split(/\s+/)
      .map((name) => [`${prefix}${name}`, "error" as const]),
  );

type ImportPattern = typeof NO_NODE_MODULES;

const importPatterns = (...patterns: ImportPattern[]): ["error", { patterns: ImportPattern[] }] => [
  "error",
  { patterns },
];

export default defineConfig({
  options: {
    typeAware: true,
    denyWarnings: true,
    reportUnusedDisableDirectives: "error",
  },
  plugins: ["eslint", "typescript", "oxc", "unicorn", "react", "jsx-a11y", "import", "vitest"],
  categories: {
    correctness: "error",
    suspicious: "error",
    perf: "error",
  },
  rules: {
    ...errors(
      "",
      `
      prefer-const
      no-var
      eqeqeq
      no-console
      no-alert
      no-eval
      no-new-func
      no-script-url
    `,
    ),
    ...errors(
      "unicorn/",
      `
      no-array-reverse
      no-array-sort
      throw-new-error
    `,
    ),
    ...errors(
      "typescript/",
      `
      no-floating-promises
      no-misused-promises
      await-thenable
      require-await
      return-await
      no-implied-eval
      no-unnecessary-type-assertion
      no-unnecessary-condition
      no-non-null-assertion
      no-explicit-any
      no-unsafe-argument
      no-unsafe-assignment
      no-unsafe-call
      no-unsafe-member-access
      no-unsafe-return
      prefer-nullish-coalescing
      prefer-readonly
      restrict-template-expressions
      strict-boolean-expressions
      switch-exhaustiveness-check
      consistent-type-imports
      no-deprecated
      only-throw-error
      prefer-promise-reject-errors
      use-unknown-in-catch-callback-variable
    `,
    ),
    ...errors(
      "import/",
      `
      no-cycle
      no-default-export
      no-duplicates
      no-namespace
      no-self-import
    `,
    ),
    ...errors(
      "react/",
      `
      rules-of-hooks
      exhaustive-deps
      no-danger
      jsx-no-script-url
      jsx-no-useless-fragment
      no-array-index-key
      jsx-no-literals
    `,
    ),
    ...errors(
      "vitest/",
      `
      no-focused-tests
      no-disabled-tests
      no-conditional-expect
      no-identical-title
    `,
    ),

    "no-param-reassign": ["error", { props: true }],
    "unicorn/filename-case": ["error", { case: "kebabCase" }],

    "max-depth": ["error", 3],
    "max-lines": ["error", { max: 400, skipBlankLines: true, skipComments: true }],
    "max-lines-per-function": ["error", { max: 60, skipBlankLines: true, skipComments: true }],
    "max-nested-callbacks": ["error", 3],
    complexity: ["error", 15],
    "max-params": ["error", 4],

    // Catches `export *` and `export * as ns` barrels only; a barrel of named re-exports
    // (`export { a } from`) passes, and no oxlint rule covers it.
    "oxc/no-barrel-file": ["error", { threshold: 0 }],
    "import/no-unassigned-import": ["error", { allow: ["**/*.css"] }],
    "react/react-in-jsx-scope": "off",
  },
  overrides: [
    {
      files: ["src/logic/**", "src/data/**"],
      rules: {
        "no-restricted-imports": importPatterns(NO_UI_IN_LOGIC, NO_NODE_MODULES),
        "no-restricted-globals": [
          "error",
          ...BROWSER_AND_IO_GLOBALS,
          {
            name: "performance",
            message: "The clock is an input: pass the time in as a parameter.",
          },
        ],
        "no-restricted-properties": [
          "error",
          { object: "Math", property: "random", message: "Use the seeded RNG." },
          {
            object: "Date",
            property: "now",
            message: "The clock is an input: pass the time in as a parameter.",
          },
          {
            object: "crypto",
            property: "getRandomValues",
            message:
              "Randomness is an input: use the seeded RNG or pass the bytes in as a parameter.",
          },
          {
            property: "arrayBuffer",
            message:
              "Reading a File, Blob or Response is I/O: read it in the UI and pass the bytes in as a parameter.",
          },
        ],
      },
    },
    {
      files: ["src/data/**"],
      rules: {
        "no-restricted-imports": importPatterns(NO_LOGIC_OR_UI_IN_DATA, NO_NODE_MODULES),
      },
    },
    // The two tests that time themselves with performance.now() may read the clock; every other
    // restricted global stays forbidden in them.
    {
      files: ["src/logic/players.test.ts", "src/data/iso9660.test.ts"],
      rules: {
        "no-restricted-globals": ["error", ...BROWSER_AND_IO_GLOBALS],
      },
    },
    // Tests under logic/ and data/ read fixtures from disk (node:fs, node:path, node:crypto), so their
    // import rules leave out the Node group; the UI and layer groups stay.
    {
      files: ["src/logic/**/*.test.ts"],
      rules: {
        "no-restricted-imports": importPatterns(NO_UI_IN_LOGIC),
      },
    },
    {
      files: ["src/data/**/*.test.ts"],
      rules: {
        "no-restricted-imports": importPatterns(NO_LOGIC_OR_UI_IN_DATA),
      },
    },
    {
      files: ["**/*.test.ts", "**/*.test.tsx"],
      rules: {
        "max-lines-per-function": "off",
        "max-nested-callbacks": "off",
      },
    },
    {
      files: ["e2e/**/*.spec.ts"],
      rules: {
        "no-restricted-imports": [
          "error",
          {
            paths: [
              {
                name: "@playwright/test",
                importNames: ["test", "expect"],
                message:
                  "Import test and expect from ./support.ts: its test carries the security policy guard.",
              },
            ],
          },
        ],
      },
    },
    {
      files: ["scripts/service-worker-template.js"],
      rules: {
        "no-await-in-loop": "off",
        "typescript/no-unsafe-argument": "off",
        "typescript/no-unsafe-assignment": "off",
        "typescript/no-unsafe-call": "off",
        "typescript/no-unsafe-member-access": "off",
        "typescript/no-unsafe-return": "off",
        "typescript/strict-boolean-expressions": "off",
      },
    },
    {
      files: ["scripts/**"],
      rules: {
        "no-console": "off",
      },
    },
    {
      files: ["*.config.ts", "*.config.mjs"],
      rules: {
        "import/no-default-export": "off",
      },
    },
  ],
  ignorePatterns: ["dist", "coverage", "node_modules", ".scratch"],
});
