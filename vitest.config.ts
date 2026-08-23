import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["server/**/*.test.ts", "app/**/*.test.ts"],
    testTimeout: 15_000,
    // Miniflare embeds workerd; keeping a single Vitest worker prevents several
    // runtimes from exhausting memory on Windows CI and local development.
    maxWorkers: 1,
  },
});
