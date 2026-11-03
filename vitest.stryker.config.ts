import { defineConfig } from "vitest/config";

// Mutation testing runs every covering test once per mutant, so it takes only the data-layer tests.
//
// stryker.config.json points `tsconfigFile` at a file that does not exist on purpose: Stryker 10 rewrites
// tsconfig references through the TypeScript compiler API, which TypeScript 7 no longer exports, and a
// missing file skips that step. Vitest strips types itself, so nothing else needs the tsconfig.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/data/**/*.test.ts"],
    // Instrumented code runs several times slower than the plain suite.
    testTimeout: 60_000,
  },
});
