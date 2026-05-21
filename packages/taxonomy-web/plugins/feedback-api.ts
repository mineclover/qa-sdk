import type { Plugin } from "vite";

export function feedbackApiPlugin(_jsonlPath: string): Plugin {
  return { name: "taxonomy-web:feedback-api" };
}
