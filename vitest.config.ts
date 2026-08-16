import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["server/**/*.test.ts", "app/**/*.test.ts"],
    testTimeout: 15_000,
  },
});
