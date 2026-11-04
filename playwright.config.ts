import { defineConfig, devices } from "@playwright/test";

// E2E_PORT lets two checkouts test side by side; each always starts its own preview, because a server
// already on the port may be another checkout's build.
const PORT = Number(process.env["E2E_PORT"] ?? "4173");
const CI = (process.env["CI"] ?? "") !== "";

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: CI,
  retries: 0,
  reporter: "list",
  use: { baseURL: `http://localhost:${String(PORT)}` },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
  webServer: {
    command: `node scripts/write-synthetic-db.ts && vite build && node scripts/write-service-worker.ts && vite preview --port ${String(PORT)} --strictPort`,
    port: PORT,
    reuseExistingServer: false,
  },
});
