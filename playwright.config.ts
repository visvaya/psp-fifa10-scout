import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;
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
    command: `node scripts/write-synthetic-db.ts && vite build && vite preview --port ${String(PORT)} --strictPort`,
    port: PORT,
    reuseExistingServer: !CI,
  },
});
