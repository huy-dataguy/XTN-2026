import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  retries: 0,
  use: {
    baseURL: "http://127.0.0.1:5174",
    headless: true,
    trace: "retain-on-failure",
  },
  reporter: [["list"], ["json", { outputFile: "test-results/results.json" }]],
  webServer: {
    command: "npm run preview -- --host 127.0.0.1 --port 5174",
    env: { API_PROXY_TARGET: "http://127.0.0.1:5001" },
    url: "http://127.0.0.1:5174",
    reuseExistingServer: false,
  },
});
