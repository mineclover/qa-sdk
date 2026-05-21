import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { feedbackApiPlugin } from "./plugins/feedback-api.js";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [
    react(),
    feedbackApiPlugin(resolve(__dirname, "../../docs/taxonomies/.reviews.jsonl")),
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
