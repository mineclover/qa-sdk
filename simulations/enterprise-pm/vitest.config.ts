import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["seed/**/*.test.ts", "test/**/*.test.ts"],
    exclude: ["dist/**", "node_modules/**", "services/**", "scenarios/**"],
    passWithNoTests: true,
  },
});
