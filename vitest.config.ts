import { defineConfig } from "vitest/config";
import path from "path";

// Unit tests for pure modules (no DB / network). Kept deliberately light so
// `npm test` stays fast and runnable in CI without a database.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
