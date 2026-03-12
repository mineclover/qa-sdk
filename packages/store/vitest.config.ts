import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.spec.ts"],
    exclude: ["dist/**"],
    fileParallelism: false,
    passWithNoTests: true,
  },
});
