import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    coverage: {
      provider: "v8",
      include: ["src/logic/**", "src/data/**"],
    },
  },
});
