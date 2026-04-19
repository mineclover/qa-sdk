// @def.boundary dkg-system-root
// @def.doc dkg-system-root

/**
 * Doc Sync Marker — md 파일의 마커를 최신 값으로 자동 교체.
 *
 * 마커 형식: <!-- dkg:KEY -->VALUE<!-- /dkg -->
 * 예: <!-- dkg:axes_count -->39<!-- /dkg -->
 *
 * generateDocSyncReport()의 snippets에서 KEY에 해당하는 값을 가져와 교체.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { generateDocSyncReport, type DocSyncReport } from "./doc-sync.js";
import type { Catalog } from "@qa-sdk/core";
import type { GraphRegistry } from "./graph-registry.js";

const MARKER_REGEX = /<!-- dkg:(\w+) -->.*?<!-- \/dkg -->/gs;

export interface DocSyncCheckResult {
  readonly file: string;
  readonly markers: readonly {
    readonly key: string;
    readonly current: string;
    readonly expected: string;
    readonly match: boolean;
  }[];
  readonly allMatch: boolean;
}

/**
 * md 파일의 마커를 검사하여 최신 값과 비교한다.
 */
export function checkDocMarkers(
  filePath: string,
  report: DocSyncReport,
): DocSyncCheckResult {
  const content = readFileSync(filePath, "utf-8");
  const markers: DocSyncCheckResult["markers"][number][] = [];

  let match: RegExpExecArray | null;
  const regex = new RegExp(MARKER_REGEX.source, MARKER_REGEX.flags);

  while ((match = regex.exec(content)) !== null) {
    const key = match[1];
    const currentValue = match[0]
      .replace(`<!-- dkg:${key} -->`, "")
      .replace("<!-- /dkg -->", "")
      .trim();
    const expectedValue = report.snippets[key] ?? "";

    markers.push({
      key,
      current: currentValue,
      expected: expectedValue,
      match: currentValue === expectedValue,
    });
  }

  return {
    file: filePath,
    markers,
    allMatch: markers.every(m => m.match),
  };
}

/**
 * md 파일의 마커를 최신 값으로 교체한다.
 */
export function applyDocMarkers(
  filePath: string,
  report: DocSyncReport,
): { replaced: number } {
  let content = readFileSync(filePath, "utf-8");
  let replaced = 0;

  content = content.replace(MARKER_REGEX, (full, key: string) => {
    const value = report.snippets[key];
    if (value !== undefined) {
      replaced++;
      return `<!-- dkg:${key} -->${value}<!-- /dkg -->`;
    }
    return full;
  });

  writeFileSync(filePath, content, "utf-8");
  return { replaced };
}

/**
 * 여러 md 파일을 일괄 검사.
 */
export function checkAllDocs(
  filePaths: readonly string[],
  catalog: Catalog,
  graph: GraphRegistry,
): DocSyncCheckResult[] {
  const report = generateDocSyncReport(catalog, graph);
  return filePaths.map(f => checkDocMarkers(f, report));
}
