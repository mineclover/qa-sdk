/**
 * 테스트 추적 (Test Trace)
 *
 * 문서 변경 시 영향받는 테스트를 식별한다.
 * traces_to 링크를 역추적하여 depth=validation 문서를 찾고,
 * 해당 문서의 frontmatter에서 테스트 참조를 추출한다.
 *
 * impact 분석과의 차이:
 *   impact: depends_on/implements/refines/constrains 경로 → "무엇이 깨지는가"
 *   test-trace: traces_to 역추적 → "어떤 테스트가 검증하는가"
 */

import type { DefinitionEntry, DefinitionLink } from "./types.js";
import { analyzeImpact } from "./impact.js";

/** 테스트 참조 1건 */
export interface TestRef {
  /** traces_to로 연결된 validation 문서 ID */
  readonly validationDocId: string;
  /** 검증 대상 문서 ID (traces_to의 target) */
  readonly verifiedDocId: string;
  /** validation 문서의 scope */
  readonly scope: string;
  /** validation 문서의 layer */
  readonly layer?: string;
}

/** 테스트 추적 결과 */
export interface TestTraceResult {
  /** 변경된 문서 ID */
  readonly changedDocId: string;
  /** 직접 연결된 테스트 참조 (changedDocId를 traces_to로 가리키는 validation 문서) */
  readonly directTests: readonly TestRef[];
  /** 영향 전파 경로로 도달한 테스트 참조 (blast radius 내 문서의 traces_to) */
  readonly impactedTests: readonly TestRef[];
  /** 전체 유니크 테스트 참조 수 */
  readonly totalTests: number;
}

/**
 * 문서 변경 시 관련 테스트를 추적한다.
 *
 * 1. changedDocId를 traces_to로 가리키는 validation 문서 수집 (직접)
 * 2. impact 분석으로 영향받는 문서 각각에 대해 traces_to 역추적
 */
export function traceTests(
  changedDocId: string,
  getEntry: (id: string) => DefinitionEntry | undefined,
  getLinks: (id: string, direction: "outgoing" | "incoming") => readonly DefinitionLink[],
): TestTraceResult {
  // 직접 traces_to 역추적: 이 문서를 traces_to로 가리키는 validation 문서
  const directTests = findTracesToValidation(changedDocId, getEntry, getLinks);

  // impact 분석
  const impact = analyzeImpact(changedDocId, getEntry, getLinks);

  // 영향받는 각 문서에서도 traces_to 역추적
  const impactedTests: TestRef[] = [];
  const seen = new Set(directTests.map(t => t.validationDocId));

  for (const impacted of impact.impacted) {
    const tests = findTracesToValidation(impacted.id, getEntry, getLinks);
    for (const t of tests) {
      if (!seen.has(t.validationDocId)) {
        seen.add(t.validationDocId);
        impactedTests.push(t);
      }
    }
  }

  return {
    changedDocId,
    directTests,
    impactedTests,
    totalTests: directTests.length + impactedTests.length,
  };
}

/** docId를 traces_to로 가리키는 validation depth 문서를 찾는다 */
function findTracesToValidation(
  docId: string,
  getEntry: (id: string) => DefinitionEntry | undefined,
  getLinks: (id: string, direction: "outgoing" | "incoming") => readonly DefinitionLink[],
): TestRef[] {
  const incoming = getLinks(docId, "incoming");
  const result: TestRef[] = [];

  for (const link of incoming) {
    if (link.linkType !== "traces_to") continue;
    const source = getEntry(link.sourceId);
    if (!source) continue;
    // validation depth 문서만 (테스트/검증 문서)
    if (source.depth === "validation") {
      result.push({
        validationDocId: source.id,
        verifiedDocId: docId,
        scope: source.scope,
        layer: source.layer,
      });
    }
  }

  return result;
}
