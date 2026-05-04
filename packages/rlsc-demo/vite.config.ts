import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const packageDir = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@qa-sdk/rlsc-perspective": resolve(packageDir, "../rlsc-perspective/src/index.ts"),
      "@qa-sdk/rlsc-analysis": resolve(packageDir, "../rlsc-analysis/src/index.ts"),
    },
  },
});
