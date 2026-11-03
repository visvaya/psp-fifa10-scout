import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    coverage: {
      provider: "v8",
      include: ["src/logic/**", "src/data/**"],
      // Ratchet: the values measured on 2026-11-03. Raise them with tests, never lower them to pass.
      thresholds: {
        "src/data/**": { statements: 100, branches: 95, functions: 100, lines: 100 },
        "src/logic/**": { statements: 100, branches: 95, functions: 100, lines: 100 },
      },
    },
  },
});
