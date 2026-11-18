import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["coverage/d13/vitest/signed-out-session.test.ts"],
    environment: "node",
    maxWorkers: 1,
    testTimeout: 30_000,
  },
});
