import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    fileParallelism: false,
    include: [
      "packages/db-drizzle/src/integration.test.ts",
      "tests/integration/**/*.test.ts",
    ],
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
