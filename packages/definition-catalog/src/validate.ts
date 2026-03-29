/**
 * 문서 그래프 검증 (Validation)
 *
 * frontmatter에 선언된 링크의 정합성을 검증한다.
 * - 깨진 링크: target이 존재하지 않는 문서를 참조
 * - 순환 참조: A→B→A 또는 더 긴 순환
 * - 자기 참조: A→A
 * - 고아 문서: 어디에도 참조되지 않는 approved 문서
 */

import type { MemoryDefinitionRegistry } from "./registry.js";

/** 검증 이슈 1건 */
export interface ValidationIssue {
  readonly severity: "error" | "warning";
  readonly type:
    | "broken-link" | "circular-ref" | "self-ref" | "orphan"
    | "missing-purpose" | "short-purpose"
    | "multi-parent" | "contains-depth-violation"
    | "level-violation";
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
    for (const _link of incoming) {
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
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- loop guard ensures stack is non-empty
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

  // contains 다중 부모 감지
  // - cross-scope 태그가 있는 문서는 의도적 공유 소속 → 허용 (info만)
  // - 태그 없이 다중 소속이면 비의도적 중복 가능 → warning
  const containsParentCount = new Map<string, string[]>();
  for (const entry of allEntries) {
    const outgoing = registry.getLinks(entry.id, "outgoing");
    for (const link of outgoing) {
      if (link.linkType === "contains") {
        const parents = containsParentCount.get(link.targetId) ?? [];
        parents.push(entry.id);
        containsParentCount.set(link.targetId, parents);
      }
    }
  }
  for (const [childId, parents] of containsParentCount) {
    if (parents.length > 1) {
      const child = allEntries.find(e => e.id === childId);
      const hasCrossScope = child?.tags?.includes("cross-scope") ?? false;
      if (!hasCrossScope) {
        issues.push({
          severity: "warning",
          type: "multi-parent",
          docId: childId,
          message: `contains 다중 부모: [${parents.join(", ")}] — 의도적이면 cross-scope 태그 추가, 아니면 하나를 depends_on으로 전환`,
        });
      }
    }
  }

  // contains 깊이 제한 — 4단계 이상 중첩이면 경고 (과도한 계층)
  function containsDepth(id: string, visited: Set<string>): number {
    if (visited.has(id)) return 0;
    visited.add(id);
    const outgoing = registry.getLinks(id, "outgoing");
    let maxChild = 0;
    for (const link of outgoing) {
      if (link.linkType === "contains" && allIds.has(link.targetId)) {
        maxChild = Math.max(maxChild, containsDepth(link.targetId, visited));
      }
    }
    return 1 + maxChild;
  }
  for (const entry of allEntries) {
    if (entry.lifecycle === "deprecated") continue;
    if (entry.depth !== "overview") continue;
    const depth = containsDepth(entry.id, new Set());
    if (depth > 4) {
      issues.push({
        severity: "warning",
        type: "contains-depth-violation",
        docId: entry.id,
        message: `contains 계층 ${depth}단계 — 4단계 이하 권장`,
      });
    }
  }

  // level 행동 검증 (group/module/leaf)
  for (const entry of allEntries) {
    if (entry.lifecycle === "deprecated") continue;
    const level = entry.level ?? "leaf";
    const containsChildren = registry.getLinks(entry.id, "outgoing")
      .filter(l => l.linkType === "contains");

    if (level === "group" && containsChildren.length === 0) {
      issues.push({
        severity: "warning",
        type: "level-violation" as ValidationIssue["type"],
        docId: entry.id,
        message: `level=group인데 contains 자식이 없음 — 묶임의 이유를 설명하려면 자식이 필요`,
      });
    }
    if (level === "module" && containsChildren.length === 0) {
      issues.push({
        severity: "warning",
        type: "level-violation" as ValidationIssue["type"],
        docId: entry.id,
        message: `level=module인데 contains 자식이 없음 — 개념 정의에는 구성 요소(leaf)가 필요`,
      });
    }
    if (level === "leaf" && containsChildren.length > 0) {
      issues.push({
        severity: "warning",
        type: "level-violation" as ValidationIssue["type"],
        docId: entry.id,
        message: `level=leaf인데 contains 자식 ${containsChildren.length}건 — module 또는 group으로 변경 필요`,
      });
    }
  }

  // 고아 문서 (system-root, draft/review 제외)
  for (const entry of allEntries) {
    if (entry.lifecycle === "deprecated") continue;
    if (entry.lifecycle === "draft" || entry.lifecycle === "review") continue;
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
