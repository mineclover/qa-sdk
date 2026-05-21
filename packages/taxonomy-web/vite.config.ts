import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { feedbackApiPlugin } from "./plugins/feedback-api.js";
import { gitLogApiPlugin } from "./plugins/git-log-api.js";
import { relatedDocsApiPlugin } from "./plugins/related-docs-api.js";
import { gitDiffApiPlugin } from "./plugins/git-diff-api.js";
import { decisionApiPlugin } from "./plugins/decision-api.js";
import { resolve } from "node:path";

const repoRoot = resolve(__dirname, "../..");

export default defineConfig({
  plugins: [
    react(),
    feedbackApiPlugin(resolve(repoRoot, "docs/taxonomies/.reviews.jsonl")),
    gitLogApiPlugin(repoRoot),
    relatedDocsApiPlugin(repoRoot),
    gitDiffApiPlugin(repoRoot),
    decisionApiPlugin(repoRoot),
  ],
  resolve: {
    alias: {
      // taxonomy-engine bundles Node's `crypto` for contentHash computation (parser/codegen).
      // parseRef (the only runtime usage in the browser) does not use crypto.
      // This stub prevents the browser build from failing.
      crypto: resolve(__dirname, "src/stubs/crypto.ts"),
      // validateLifecycle은 decisionLink path 검증에 fs/path를 사용. 브라우저에서는
      // validate를 호출하지 않으므로 no-op stub으로 충분.
      fs: resolve(__dirname, "src/stubs/fs.ts"),
      path: resolve(__dirname, "src/stubs/path.ts"),
    },
  },
});
