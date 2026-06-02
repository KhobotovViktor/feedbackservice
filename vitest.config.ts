import { defineConfig } from "vitest/config";

// Unit tests for pure modules (no DB / network). Kept deliberately light so
// `npm test` stays fast and runnable in CI without a database.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
