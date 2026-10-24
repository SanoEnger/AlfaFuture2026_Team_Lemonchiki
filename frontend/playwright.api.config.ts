import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/integration",
  workers: 1,
  timeout: 90000,
  outputDir: "test-results-api",
  use: {
    baseURL: "http://127.0.0.1:5174",
    viewport: { width: 1440, height: 900 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: [
    {
      command: "python ../backend/scripts/ui_test_server.py",
      url: "http://127.0.0.1:8011/health",
      reuseExistingServer: false,
      timeout: 60000,
    },
    {
      command: "npm.cmd run dev -- --port 5174 --strictPort",
      url: "http://127.0.0.1:5174",
      reuseExistingServer: false,
      timeout: 30000,
      env: { VITE_API_BASE_URL: "http://127.0.0.1:8011/api/v1" },
    },
  ],
});
