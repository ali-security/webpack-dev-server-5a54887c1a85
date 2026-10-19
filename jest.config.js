"use strict";

module.exports = {
  testURL: "http://localhost/",
  collectCoverage: false,
  coveragePathIgnorePatterns: [
    "/node_modules/",
    "<rootDir>/test/",
    "<rootDir>/client/",
  ],
  testPathIgnorePatterns: [
    "<rootDir>/bin/this/process-arguments.js",
    // puppeteer 13 has no mac-arm64 Chromium; e2e hangs on Apple Silicon runners
    ...(process.platform === "darwin" ? ["<rootDir>/test/e2e/"] : []),
  ],
  snapshotResolver: "<rootDir>/test/helpers/snapshotResolver.js",
  setupFilesAfterEnv: ["<rootDir>/setupTest.js"],
  globalSetup: "<rootDir>/globalSetupTest.js",
};
