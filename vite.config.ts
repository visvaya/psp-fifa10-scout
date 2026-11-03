import react from "@vitejs/plugin-react";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    // Browser tests run under Playwright (pnpm test:e2e).
    exclude: [...configDefaults.exclude, "e2e/**"],
    coverage: {
      provider: "v8",
      include: ["src/logic/**", "src/data/**"],
      // Test builders are not product code; their fallbacks for impossible indexes stay unrun.
      exclude: ["**/test-support/**", "**/*.test.ts"],
      // Ratchet: the values measured on 2026-11-03. Raise them with tests, never lower them to pass.
      thresholds: {
        "src/data/**": { statements: 100, branches: 95, functions: 100, lines: 100 },
        "src/logic/**": { statements: 100, branches: 95, functions: 100, lines: 100 },
      },
    },
  },
});
