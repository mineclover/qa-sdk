import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { feedbackApiPlugin } from "./plugins/feedback-api.js";
import { gitLogApiPlugin } from "./plugins/git-log-api.js";
import { relatedDocsApiPlugin } from "./plugins/related-docs-api.js";
import { resolve } from "node:path";

const repoRoot = resolve(__dirname, "../..");

export default defineConfig({
  plugins: [
    react(),
    feedbackApiPlugin(resolve(repoRoot, "docs/taxonomies/.reviews.jsonl")),
    gitLogApiPlugin(repoRoot),
    relatedDocsApiPlugin(repoRoot),
  ],
  resolve: {
    alias: {
      // taxonomy-engine bundles Node's `crypto` for contentHash computation (parser/codegen).
      // parseRef (the only runtime usage in the browser) does not use crypto.
      // This stub prevents the browser build from failing.
      crypto: resolve(__dirname, "src/stubs/crypto.ts"),
    },
  },
});
