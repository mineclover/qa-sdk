// @def.doc definition-catalog-spec
// @def.boundary definition-catalog-spec

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
import {
  allowsSemanticMultiParent,
  semanticContainsDepthLimit,
} from "./semantic-lint.js";
import { deriveAllDomainRoots, detectOwnerRootMismatch } from "./domain-root.js";

/** 검증 이슈 1건 */
export interface ValidationIssue {
  readonly severity: "error" | "warning" | "info";
  readonly type:
    | "broken-link" | "circular-ref" | "self-ref" | "orphan"
    | "missing-purpose" | "short-purpose"
    | "multi-parent" | "contains-depth-violation"
    | "level-violation"
    | "broken-code-reference"
    | "invalid-code-boundary"
    | "ambiguous-code-boundary"
    | "inconsistent-code-boundary"
    | "duplicate-coordinate"
    | "system-contains-system"
    | "invalid-lifecycle-ref"
    | "invalid-type-classification"
    | "missing-owner-system"
    | "invalid-hierarchy-classification"
    | "owner-root-mismatch";
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

const CONTAINS_DEPTH_EXEMPT = new Set([
  "system-design-tools",
  "system-infra",
  "system-root",
  "system-support",
]);

/**
 * 문서 그래프 전체를 검증한다.
 */
export function validateGraph(registry: MemoryDefinitionRegistry): ValidationResult {
  const issues: ValidationIssue[] = [];
  const allEntries = registry.all();
  const allIds = new Set(allEntries.map(e => e.id));
  const semanticSignalCache = new Map<string, readonly string[]>();

  // domain_root 파생: 중복 좌표 판정 확장 및 owner-root-mismatch 진단에 사용
  // fail-open — 파생 실패 시 빈 Map으로 대체하고 기존 키로 fallback
  let domainRoots: Map<string, string>;
  try {
    domainRoots = deriveAllDomainRoots(registry);
  } catch {
    domainRoots = new Map();
  }

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
      if (!allowsSemanticMultiParent(childId, parents, registry, semanticSignalCache)) {
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
    if (CONTAINS_DEPTH_EXEMPT.has(entry.id)) continue;
    const depth = containsDepth(entry.id, new Set());
    const limit = semanticContainsDepthLimit(entry.id, registry, semanticSignalCache);
    if (depth > limit) {
      issues.push({
        severity: "warning",
        type: "contains-depth-violation",
        docId: entry.id,
        message: `contains 계층 ${depth}단계 — ${limit}단계 이하 권장`,
      });
    }
  }

  // level 및 tier 기반 구조 검증
  for (const entry of allEntries) {
    if (entry.lifecycle === "deprecated") continue;
    
    // STC 티어가 있으면 레거시 level 검증 생략
    if (entry.tier) {
      const outgoingLinks = registry.getLinks(entry.id, "outgoing");
      const containsChildren = outgoingLinks.filter(l => l.linkType === "contains");
      const refsChildren = outgoingLinks.filter(l => l.linkType === "refs");

      if (entry.tier === "layout") {
        // Layout은 refs를 주력으로 써야 함 — contains 사용 금지
        if (containsChildren.length > 0) {
          issues.push({
            severity: "error",
            type: "level-violation" as ValidationIssue["type"],
            docId: entry.id,
            message: `tier: layout은 contains 대신 refs 사용이 강제됩니다 (${containsChildren.length}건 감지)`,
          });
        }
        if (refsChildren.length === 0 && containsChildren.length === 0) {
          issues.push({
            severity: "error",
            type: "level-violation" as ValidationIssue["type"],
            docId: entry.id,
            message: `tier: layout인데 배치된 시스템(refs)이 없음`,
          });
        }
      } else if (entry.tier === "system") {
        // System이 다른 System을 contains하면 독립성 위반
        // (System→Component/Entry/non-tier contains는 허용)
        const systemContainsSystem = containsChildren.filter(link => {
          const target = registry.get(link.targetId);
          return target?.tier === "system";
        });
        if (systemContainsSystem.length > 0) {
          issues.push({
            severity: "error",
            type: "system-contains-system" as ValidationIssue["type"],
            docId: entry.id,
            message: `System이 다른 System을 contains할 수 없음 (${systemContainsSystem.map(l => l.targetId).join(", ")}) — depends_on 전환 필요`,
          });
        }
      } else if (entry.tier === "component") {
        // Component는 수동적(링크 대상) — contains 자식을 가지면 구조 이상
        if (containsChildren.length > 0) {
          issues.push({
            severity: "warning",
            type: "level-violation" as ValidationIssue["type"],
            docId: entry.id,
            message: `tier: component는 링크 대상이며 contains 자식을 권장하지 않음 (${containsChildren.length}건) — data-shape 분리 권장`,
          });
        }
      }
      continue;
    }

    const level = entry.level ?? "leaf";
    const containsChildren = registry.getLinks(entry.id, "outgoing")
      .filter(l => l.linkType === "contains");

    if (level === "group" && containsChildren.length === 0) {
      issues.push({
        severity: "error",
        type: "level-violation" as ValidationIssue["type"],
        docId: entry.id,
        message: `level=group인데 contains 자식이 없음 — 묶임의 이유를 설명하려면 자식이 필요`,
      });
    }
    if (level === "module" && containsChildren.length === 0) {
      issues.push({
        severity: "error",
        type: "level-violation" as ValidationIssue["type"],
        docId: entry.id,
        message: `level=module인데 contains 자식이 없음 — 개념 정의에는 구성 요소(leaf)가 필요`,
      });
    }
    if (level === "leaf" && containsChildren.length > 0) {
      issues.push({
        severity: "error",
        type: "level-violation" as ValidationIssue["type"],
        docId: entry.id,
        message: `level=leaf인데 contains 자식 ${containsChildren.length}건 — module 또는 group으로 변경 필요`,
      });
    }
  }

  // 고아 문서 (system-root, draft/review/archived 제외)
  // 설계상 고아 허용 케이스:
  //   - orphan-expected 태그 (명시적 opt-out)
  //   - .cases.md (소비자 기대 시나리오, 외부 참조 없이 독립)
  //   - .test.md (테스트 문서, 대상 스펙을 verify하지만 incoming link 불필요)
  for (const entry of allEntries) {
    if (entry.lifecycle === "deprecated") continue;
    if (entry.lifecycle === "draft" || entry.lifecycle === "review") continue;
    if (entry.lifecycle === "archived") continue;
    if (entry.id === "system-root") continue;
    if (entry.tags?.includes("orphan-expected")) continue;
    if (entry.ref?.endsWith(".cases.md")) continue;
    if (entry.ref?.endsWith(".test.md")) continue;
    if (!referenced.has(entry.id)) {
      issues.push({
        severity: "warning",
        type: "orphan",
        docId: entry.id,
        message: "어디에서도 참조되지 않는 고아 문서",
      });
    }
  }

  // D-19 최상위 분류 및 확장자 검증
  const DESIGN_EXTS = new Set([".spec.md", ".rule.md", ".test.md", ".plan.md", ".cases.md"]);
  const KNOWLEDGE_EXTS = new Set([".md", ".memo.md", ".todo.md"]);

  for (const entry of allEntries) {
    if (entry.lifecycle === "deprecated") continue;

    const ref = entry.ref || "";
    let ext = ".md";
    const extMatch = ref.match(/\.[a-z]+\.md$/);
    if (extMatch) {
      ext = extMatch[0];
    }

    if (entry.type === "design" || entry.type === "spec") {
      // 베어 .md, .todo.md, .memo.md는 레거시/혼용 확장자 — 타입 불일치 경고 제외
      const LEGACY_SAFE_EXTS = new Set([".md", ".todo.md", ".memo.md"]);
      if (!DESIGN_EXTS.has(ext) && !LEGACY_SAFE_EXTS.has(ext)) {
        issues.push({
          severity: "warning",
          type: "invalid-type-classification",
          docId: entry.id,
          message: `Design/Spec 문서(type: ${entry.type})는 설계 확장자(${[...DESIGN_EXTS].join(", ")})를 가져야 합니다. 현재: ${ext}`,
        });
      }
    } else if (entry.type === "knowledge") {
      if (!KNOWLEDGE_EXTS.has(ext)) {
        issues.push({
          severity: "warning",
          type: "invalid-type-classification",
          docId: entry.id,
          message: `Knowledge 문서(type: ${entry.type})는 지식 확장자(${[...KNOWLEDGE_EXTS].join(", ")})를 가져야 합니다. 현재: ${ext}`,
        });
      }
    }
  }

  // 중복 좌표 감지 (tier, scope, layer, aspect, domain_root)
  // Phase 2: domain_root를 키에 포함해 서로 다른 도메인의 같은 좌표는 중복으로 보지 않는다
  // Phase 5d: knowledge_kind=proposal|adr|convention 문서는 의도적 co-location(제안/결정/컨벤션 묶음)이므로 검사 제외
  // Phase 5f: cross-scope 태그가 그룹 전원에 부여된 경우 의도적 공유 좌표로 보고 검사 제외
  //   근거: cross-scope = "다중 scope에 의도적으로 걸친다"는 명시적 opt-out 선언.
  //   multi-parent (line 148-169) 와 동일한 opt-out 메커니즘을 dup-coord에도 적용.
  //   그룹 전원에 태그가 있어야 함 — 일부만 태그시 의도성이 불명확하므로 경고 유지.
  const DUP_COORD_EXEMPT_KNOWLEDGE_KINDS = new Set(["proposal", "adr", "convention"]);
  const coords = new Map<string, string[]>();
  for (const entry of allEntries) {
    if (entry.lifecycle === "deprecated") continue;
    if (entry.tier === "component") continue; // component는 수동 참조 대상으로 좌표 유일성 불필요
    if (entry.knowledgeKind && DUP_COORD_EXEMPT_KNOWLEDGE_KINDS.has(entry.knowledgeKind)) continue;
    const domainRoot = domainRoots.get(entry.id) ?? entry.id;
    const key = `${entry.tier || "none"}:${entry.scope}:${entry.layer || "none"}:${entry.aspect}:${domainRoot}`;
    const docs = coords.get(key) ?? [];
    docs.push(entry.id);
    coords.set(key, docs);
  }
  for (const [key, docs] of coords.entries()) {
    if (docs.length > 1) {
      // cross-scope 태그가 그룹 전원에 있으면 의도적 공유로 보고 skip
      const allCrossScope = docs.every(id => {
        const entry = registry.get(id);
        return entry?.tags?.includes("cross-scope") ?? false;
      });
      if (allCrossScope) continue;

      // key 포맷: tier:scope:layer:aspect:domain_root — 마지막 콜론 이후가 domain_root
      const lastColon = key.lastIndexOf(":");
      const coordPart = key.slice(0, lastColon);
      const rootPart = key.slice(lastColon + 1);
      issues.push({
        severity: "warning",
        type: "duplicate-coordinate",
        docId: docs[0], // Arbitrary
        message: `중복 좌표 (tier:scope:layer:aspect = ${coordPart}) + 도메인 루트 ${rootPart}: [${docs.join(", ")}]`,
      });
    }
  }

  // owner_system과 파생 domain_root 사이의 정합성 진단 (info)
  // 의도적 cross-domain 소비는 info로만 기록, 차단하지 않음
  for (const entry of allEntries) {
    if (entry.lifecycle === "deprecated") continue;
    const derivedRoot = domainRoots.get(entry.id);
    if (!derivedRoot) continue;
    const verdict = detectOwnerRootMismatch(entry, derivedRoot, registry);
    if (verdict === "mismatch") {
      issues.push({
        severity: "info",
        type: "owner-root-mismatch",
        docId: entry.id,
        message: `owner_system=${entry.owner_system} 과 파생 domain_root=${derivedRoot} 불일치 — 링크 보완 또는 owner_system 재정의 검토`,
      });
    }
  }

  // System-contains-System (module -> module contains)
  // STC 도입으로 tier: system 기반으로도 체크
  for (const entry of allEntries) {
    if (entry.lifecycle === "deprecated") continue;
    const isSystem = entry.tier === "system" || entry.level === "module";
    if (!isSystem) continue;

    const containsLinks = registry.getLinks(entry.id, "outgoing").filter(l => l.linkType === "contains");
    for (const link of containsLinks) {
      const target = registry.get(link.targetId);
      if (target && (target.tier === "system" || target.level === "module")) {
        issues.push({
          severity: "warning", // Phase 4B에서 error로 승격 예정
          type: "system-contains-system",
          docId: entry.id,
          message: `System이 System을 contains: ${entry.id} -> ${target.id}. depends_on이나 refs로 전환하세요.`,
        });
      }
    }
  }

  // lifecycle_ref 유효성 검증
  for (const entry of allEntries) {
    if (entry.lifecycle === "deprecated") continue;
    if (!entry.lifecycleRef) continue;

    const lr = entry.lifecycleRef;
    if (lr.stateComponent) {
      const stateComp = registry.get(lr.stateComponent);
      if (!stateComp) {
        issues.push({
          severity: "warning", // 나중에 error로 승격
          type: "invalid-lifecycle-ref",
          docId: entry.id,
          message: `lifecycle_ref.state_component 타겟 "${lr.stateComponent}"이(가) 존재하지 않습니다.`,
        });
      }
    }
  }

  // D-20 소유권 및 추적 체계 검증
  for (const entry of allEntries) {
    if (entry.lifecycle === "deprecated") continue;

    // type: design인데 owner_system 누락 (Warning 후 Error 승격)
    if (entry.type === "design" && !entry.owner_system) {
      issues.push({
        severity: "error", // Phase 4B: Error 승격
        type: "missing-owner-system",
        docId: entry.id,
        message: `Design 문서("${entry.id}")는 소유권 체인 구축을 위한 owner_system 필드가 필수입니다.`,
      });
    }

    // auxiliary인 경우 core와 분리되어 관찰 가능한지 (간단한 정합성 체크)
    if (entry.intent_hierarchy === "auxiliary" && entry.projection_plane === "intent") {
      // 보조 의도인데 코어 시스템 문서에 직접 inline 되어있는지 등 체크 (추후 정교화)
    }
  }

  const errors = issues.filter(i => i.severity === "error").length;
  const warnings = issues.filter(i => i.severity === "warning").length;

  return { issues, errors, warnings, passed: errors === 0 };
}
