import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { feedbackApiPlugin } from "./plugins/feedback-api.js";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [
    react(),
    feedbackApiPlugin(resolve(__dirname, "../../docs/taxonomies/.reviews.jsonl")),
  ],
});
