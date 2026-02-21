import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: "browser.test.ts",
  use: {
    browserName: "chromium",
  },
  reporter: "list",
});
