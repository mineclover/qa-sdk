/**
 * 문서 그래프 검증 (Validation)
 *
 * frontmatter에 선언된 링크의 정합성을 검증한다.
 * - 깨진 링크: target이 존재하지 않는 문서를 참조
 * - 순환 참조: A→B→A 또는 더 긴 순환
 * - 자기 참조: A→A
 * - 고아 문서: 어디에도 참조되지 않는 approved 문서
 */

import type { DefinitionEntry, DefinitionLink } from "./types.js";
import type { MemoryDefinitionRegistry } from "./registry.js";

/** 검증 이슈 1건 */
export interface ValidationIssue {
  readonly severity: "error" | "warning";
  readonly type: "broken-link" | "circular-ref" | "self-ref" | "orphan" | "missing-purpose" | "short-purpose";
  readonly docId: string;
  readonly message: string;
}

/** 검증 결과 */
export interface ValidationResult {
  readonly issues: readonly ValidationIssue[];
  readonly errors: number;
  readonly warnings: number;
  readonly passed: boolean;
}

/**
 * 문서 그래프 전체를 검증한다.
 */
export function validateGraph(registry: MemoryDefinitionRegistry): ValidationResult {
  const issues: ValidationIssue[] = [];
  const allEntries = registry.all();
  const allIds = new Set(allEntries.map(e => e.id));

  // 참조되는 ID 수집 (고아 판별용)
  const referenced = new Set<string>();

  for (const entry of allEntries) {
    if (entry.lifecycle === "deprecated") continue;

    const outgoing = registry.getLinks(entry.id, "outgoing");

    for (const link of outgoing) {
      referenced.add(link.targetId);

      // 깨진 링크
      if (!allIds.has(link.targetId)) {
        issues.push({
          severity: "error",
          type: "broken-link",
          docId: entry.id,
          message: `target "${link.targetId}" (${link.linkType})가 존재하지 않음`,
        });
      }

      // 자기 참조
      if (link.targetId === entry.id) {
        issues.push({
          severity: "error",
          type: "self-ref",
          docId: entry.id,
          message: `자기 자신을 ${link.linkType}로 참조`,
        });
      }
    }

    const incoming = registry.getLinks(entry.id, "incoming");
    for (const link of incoming) {
      referenced.add(entry.id);
    }
  }

  // 순환 참조 검출 (depends_on, implements, refines만 — contains/constrains/traces_to는 순환 허용 대상 아님)
  const cyclicTypes = new Set(["depends_on", "implements", "refines"]);
  for (const entry of allEntries) {
    if (entry.lifecycle === "deprecated") continue;
    const visited = new Set<string>();
    const stack = [entry.id];

    while (stack.length > 0) {
      const current = stack.pop()!;
      if (visited.has(current)) {
        if (current === entry.id && visited.size > 0) {
          issues.push({
            severity: "error",
            type: "circular-ref",
            docId: entry.id,
            message: `순환 참조 감지 (${[...visited].join(" → ")} → ${current})`,
          });
        }
        continue;
      }
      visited.add(current);

      const links = registry.getLinks(current, "outgoing");
      for (const link of links) {
        if (cyclicTypes.has(link.linkType)) {
          stack.push(link.targetId);
        }
      }
    }
  }

  // 고아 문서 (system-root 제외)
  for (const entry of allEntries) {
    if (entry.lifecycle === "deprecated") continue;
    if (entry.id === "system-root") continue;
    if (!referenced.has(entry.id)) {
      issues.push({
        severity: "warning",
        type: "orphan",
        docId: entry.id,
        message: "어디에서도 참조되지 않는 고아 문서",
      });
    }
  }

  const errors = issues.filter(i => i.severity === "error").length;
  const warnings = issues.filter(i => i.severity === "warning").length;

  return { issues, errors, warnings, passed: errors === 0 };
}
