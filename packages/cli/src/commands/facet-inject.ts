// @def.boundary docs-control-plane
// @def.doc docs-control-plane

/**
 * facet-inject — synced/ 복사본에 @facet export 기반 export 주입.
 *
 * 원본은 건드리지 않음. synced/ 디렉토리의 복사본에서만 동작.
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { parseFacetMarker } from "./facet-scan.js";

export function injectFacetExports(dir: string): number {
  let injected = 0;

  function walk(d: string): void {
    for (const entry of readdirSync(d)) {
      const full = join(d, entry);
      const st = statSync(full);
      if (st.isDirectory()) { walk(full); continue; }
      if (![".ts", ".tsx", ".js", ".jsx"].includes(extname(full))) continue;

      let content = readFileSync(full, "utf-8");
      const lines = content.split("\n");
      let changed = false;

      for (const line of lines) {
        const marker = parseFacetMarker(line);
        if (!marker || marker.exports.length === 0) continue;

        for (const fnName of marker.exports) {
          const patterns = [
            new RegExp(`^(\\s*)function\\s+${fnName}\\s*\\(`, "m"),
            new RegExp(`^(\\s*)async\\s+function\\s+${fnName}\\s*\\(`, "m"),
            new RegExp(`^(\\s*)const\\s+${fnName}\\s*=`, "m"),
          ];

          for (const re of patterns) {
            const newContent = content.replace(re, (match, indent) => {
              if (match.includes("export ")) return match;
              return `${indent}export ${match.trimStart()}`;
            });
            if (newContent !== content) { content = newContent; changed = true; injected++; }
          }
        }
      }

      if (changed) writeFileSync(full, content, "utf-8");
    }
  }

  walk(dir);
  return injected;
}
