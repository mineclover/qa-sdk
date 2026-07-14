/**
 * DecisionDemo 페이지 전용 순수 helper.
 * UI 외부에서 격리 테스트 가능 — React 미사용.
 */

import type { DecisionFile } from 'taxonomy-decision-bridge';
import type { FlowSchema } from 'decision-flow';

// ─── parse error 분류 ─────────────────────────────────────

export type ParseErrorKind = 'frontmatter-missing' | 'frontmatter-field' | 'lifecycle' | 'unknown';

export type ClassifiedError = {
  kind: ParseErrorKind;
  message: string;
  hint: string;
};

/**
 * parseDecisionFile / toFlowSchema의 throw 메시지를 사용자 친화 카테고리로 분류.
 * 메시지 패턴 매칭이므로 bridge가 메시지를 바꾸면 함께 갱신 필요.
 */
export function classifyParseError(message: string): ClassifiedError {
  if (message.includes('frontmatter 누락')) {
    return {
      kind: 'frontmatter-missing',
      message,
      hint: '파일 최상단에 `---` 로 감싼 YAML 블록이 필요합니다.',
    };
  }
  if (message.includes('frontmatter.lifecycle')) {
    return {
      kind: 'lifecycle',
      message,
      hint: 'lifecycle은 draft/review/approved/deprecated/archived/tbd 중 하나여야 합니다.',
    };
  }
  if (message.includes('frontmatter.')) {
    return {
      kind: 'frontmatter-field',
      message,
      hint: '필수 필드: id, subject, lifecycle, created, updated.',
    };
  }
  return {
    kind: 'unknown',
    message,
    hint: '마커 문법 또는 본문 구조 확인이 필요합니다.',
  };
}

// ─── skeleton 판정 ────────────────────────────────────────

export type SkeletonStatus = {
  isSkeleton: boolean;
  reason: string;
};

/**
 * skeleton = 의미있는 컨텐츠가 0건. 분기(option) 0건 + 증거(evidence) 0건.
 * single-gate / multi-gate 모두 일관 기준 적용.
 */
export function detectSkeleton(file: DecisionFile, schema: FlowSchema): SkeletonStatus {
  const totalBranches = schema.gates.reduce((sum, g) => sum + (g.branches?.length ?? 0), 0);
  const isMulti = file.markers.gates.length > 0;
  const totalEvidence = isMulti
    ? file.markers.gates.reduce((sum, g) => sum + g.evidence.length, 0)
    : file.markers.evidence.length;

  if (totalBranches === 0 && totalEvidence === 0) {
    return {
      isSkeleton: true,
      reason: '옵션·증거 모두 0건',
    };
  }
  if (totalBranches === 0) {
    return {
      isSkeleton: false,
      reason: `옵션 0건이지만 증거 ${totalEvidence}건 — 탐색 단계`,
    };
  }
  return {
    isSkeleton: false,
    reason: `옵션 ${totalBranches}건 · 증거 ${totalEvidence}건`,
  };
}

// ─── evidence fanout 경고 ─────────────────────────────────

export type EvidenceFanout = {
  /** round-trip 시 evidence가 중복될 위험 여부. multi-gate에서 같은 kind를 여러 gate가 요구하면 발생. */
  hasDuplicationRisk: boolean;
  /** 위험을 야기하는 kind → 그 kind를 요구하는 gate id 목록. */
  duplicatedKinds: { kind: string; gates: string[] }[];
};

/**
 * multi-gate decision에서 toMarkdown round-trip 시 evidence 복제 위험 분석.
 * from-flow-schema.ts:154-156은 requiredEvidence kind 매칭으로 evidence를 분배 →
 * 같은 kind를 여러 gate가 요구하면 동일 evidence가 여러 gate body에 복제 출력됨.
 */
export function analyzeEvidenceFanout(schema: FlowSchema): EvidenceFanout {
  if (schema.gates.length <= 1) {
    return { hasDuplicationRisk: false, duplicatedKinds: [] };
  }
  const kindToGates: Map<string, string[]> = new Map();
  for (const g of schema.gates) {
    for (const k of g.requiredEvidence ?? []) {
      const list = kindToGates.get(k) ?? [];
      list.push(g.id);
      kindToGates.set(k, list);
    }
  }
  const duplicatedKinds = Array.from(kindToGates.entries())
    .filter(([, gates]) => gates.length > 1)
    .map(([kind, gates]) => ({ kind, gates }));
  return {
    hasDuplicationRisk: duplicatedKinds.length > 0,
    duplicatedKinds,
  };
}

// ─── 사이클 검증 ──────────────────────────────────────────

export type GateCycle = {
  /** cycle을 구성하는 gate id 순서 — 첫 노드가 마지막에 다시 등장하지 않음. */
  nodes: string[];
};

/**
 * gate.affects[]를 directed edge로 보고 사이클 탐지.
 * affects = outgoing edges (이 gate가 영향을 주는 다른 gate).
 * Tarjan SCC 대신 단순 DFS 백트래킹 — gate 수가 적어 충분.
 */
export function detectCycles(schema: FlowSchema): GateCycle[] {
  const adj: Map<string, string[]> = new Map();
  for (const g of schema.gates) {
    adj.set(
      g.id,
      (g.affects ?? []).map((d) => d.gateId).filter((id) => id !== g.id),
    );
  }
  // self-loop은 분리 처리
  const selfLoops: GateCycle[] = schema.gates
    .filter((g) => (g.affects ?? []).some((d) => d.gateId === g.id))
    .map((g) => ({ nodes: [g.id] }));

  const cycles: GateCycle[] = [...selfLoops];
  const seen: Set<string> = new Set(); // normalized 사이클 키
  const visiting: Set<string> = new Set();
  const stack: string[] = [];

  function dfs(node: string): void {
    if (visiting.has(node)) {
      const idx = stack.indexOf(node);
      if (idx >= 0) {
        const cycle = stack.slice(idx);
        const key = normalizeCycleKey(cycle);
        if (!seen.has(key)) {
          seen.add(key);
          cycles.push({ nodes: cycle });
        }
      }
      return;
    }
    visiting.add(node);
    stack.push(node);
    for (const next of adj.get(node) ?? []) {
      dfs(next);
    }
    stack.pop();
    visiting.delete(node);
  }

  for (const g of schema.gates) {
    dfs(g.id);
  }
  return cycles;
}

/** 사이클 회전 순서 무관 비교 키 — 최소 회전 형태로 정규화. */
function normalizeCycleKey(cycle: string[]): string {
  if (cycle.length === 0) return '';
  let min = 0;
  for (let i = 1; i < cycle.length; i++) {
    if (cycle[i] < cycle[min]) min = i;
  }
  const rotated = [...cycle.slice(min), ...cycle.slice(0, min)];
  return rotated.join('>');
}

// ─── 잘못된 마커 감지 ─────────────────────────────────────

const KNOWN_MARKER_NAMES = new Set([
  'purpose',
  'context',
  'outcome',
  'option',
  'evidence',
  'phase',
  'weight',
  'depends_on',
  'gate',
  'cost',
  'benefit',
  'risk',
]);

export type UnknownMarker = {
  raw: string;
  name: string;
  line: number;
};

/**
 * `^word` 패턴 중 KNOWN_MARKER_NAMES에 없는 것을 수집.
 * 예: `^foo`, `^Purpose` (대소문자 구분), `^option_bad` (없는 이름).
 */
export function findUnknownMarkers(body: string): UnknownMarker[] {
  const out: UnknownMarker[] = [];
  const lines = body.split('\n');
  // 마커 패턴: ^ + 이름 (영문 시작, 이후 word). 콜론 이하는 매개변수.
  const scanner = /\^([a-zA-Z_][\w]*)/g;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const m of line.matchAll(scanner)) {
      const name = m[1];
      if (!KNOWN_MARKER_NAMES.has(name)) {
        out.push({ raw: m[0], name, line: i + 1 });
      }
    }
  }
  return out;
}

// ─── 마커 통계 ────────────────────────────────────────────

export type MarkerStats = {
  totalOptions: number;
  totalEvidence: number;
  evidenceByKind: Record<string, number>;
  phasesUsed: string[];
  gateCount: number;
  hasOutcome: boolean;
};

/**
 * 페이지 표시용 마커 집계. single-gate / multi-gate 모두 합산.
 */
export function computeMarkerStats(file: DecisionFile): MarkerStats {
  const m = file.markers;
  const isMulti = m.gates.length > 0;
  const allOptions = isMulti ? m.gates.flatMap((g) => g.options) : m.options;
  const allEvidence = isMulti ? m.gates.flatMap((g) => g.evidence) : m.evidence;
  const evidenceByKind: Record<string, number> = {};
  for (const e of allEvidence) {
    evidenceByKind[e.kind] = (evidenceByKind[e.kind] ?? 0) + 1;
  }
  const phaseSet: Set<string> = new Set();
  if (m.phase) phaseSet.add(m.phase);
  for (const g of m.gates) if (g.phase) phaseSet.add(g.phase);
  return {
    totalOptions: allOptions.length,
    totalEvidence: allEvidence.length,
    evidenceByKind,
    phasesUsed: [...phaseSet].sort(),
    gateCount: isMulti ? m.gates.length : 1,
    hasOutcome: !!m.outcome,
  };
}

// ─── round-trip 검증 ──────────────────────────────────────

export type RoundtripCheck = {
  /** schema gate ids 동일 + branch count 동일 + outcomes 동일이면 ok. */
  ok: boolean;
  /** mismatch 사유 (ok=false일 때만). */
  reason?: string;
};

/**
 * file → toFlowSchema → toMarkdown → parse → toFlowSchema 결과를 비교.
 * 의미 보존 여부만 검사 (frontmatter timestamp 등은 무시).
 */
export function verifyRoundtrip(
  originalSchema: FlowSchema,
  reparsedSchema: FlowSchema,
): RoundtripCheck {
  if (originalSchema.gates.length !== reparsedSchema.gates.length) {
    return {
      ok: false,
      reason: `gate 수 불일치 (${originalSchema.gates.length} → ${reparsedSchema.gates.length})`,
    };
  }
  const origIds = originalSchema.gates.map((g) => g.id).sort();
  const reIds = reparsedSchema.gates.map((g) => g.id).sort();
  for (let i = 0; i < origIds.length; i++) {
    if (origIds[i] !== reIds[i]) {
      return { ok: false, reason: `gate id 불일치: ${origIds[i]} vs ${reIds[i]}` };
    }
  }
  // branch count per gate
  for (const orig of originalSchema.gates) {
    const re = reparsedSchema.gates.find((g) => g.id === orig.id);
    if (!re) return { ok: false, reason: `reparsed에서 gate ${orig.id} 누락` };
    const oc = orig.branches?.length ?? 0;
    const rc = re.branches?.length ?? 0;
    if (oc !== rc) {
      return {
        ok: false,
        reason: `gate ${orig.id}: branch 수 불일치 (${oc} → ${rc})`,
      };
    }
  }
  // outcomes presence
  const oOut = originalSchema.outcomes?.length ?? 0;
  const rOut = reparsedSchema.outcomes?.length ?? 0;
  if (oOut !== rOut) {
    return { ok: false, reason: `outcomes 수 불일치 (${oOut} → ${rOut})` };
  }
  return { ok: true };
}

// ─── 마커 치트시트 데이터 ──────────────────────────────────

export type MarkerSpec = {
  syntax: string;
  desc: string;
  example: string;
  category: 'core' | 'evidence' | 'flow' | 'multi-gate' | 'annotation';
};

export const MARKER_CHEATSHEET: readonly MarkerSpec[] = [
  {
    syntax: '^purpose',
    desc: '결정의 질문/목적 (필수)',
    example: 'OAuth 통합 방식 ^purpose',
    category: 'core',
  },
  {
    syntax: '^context',
    desc: '배경 정보',
    example: '보안 위험 검토 ^context',
    category: 'core',
  },
  {
    syntax: '^option:<id>',
    desc: '선택지',
    example: 'JWT 토큰 ^option:jwt',
    category: 'core',
  },
  {
    syntax: '^outcome',
    desc: '최종 결정 (lifecycle=approved 시 schema에 반영)',
    example: 'JWT 채택 ^outcome',
    category: 'core',
  },
  {
    syntax: '^evidence:<kind> weight=N',
    desc: '근거. kind: data/rule/precedent/intuition/external',
    example: '벤치마크 결과 ^evidence:data weight=3',
    category: 'evidence',
  },
  {
    syntax: '^phase:<phase>',
    desc: '인지 단계. perceive/interpret/evaluate/decide/plan/execute/reflect',
    example: '^phase:evaluate',
    category: 'flow',
  },
  {
    syntax: '^weight:<weight>',
    desc: '게이트 가중치. core/structural/tactical',
    example: '^weight:core',
    category: 'flow',
  },
  {
    syntax: '^gate:<id>',
    desc: 'multi-gate 분기점 시작 (이후 ^option/^evidence는 이 gate 소속)',
    example: '^gate:protocol',
    category: 'multi-gate',
  },
  {
    syntax: '^depends_on:<gateId>:<kind>',
    desc: '게이트 의존. kind: constrains/enables/invalidates',
    example: '^depends_on:protocol:enables',
    category: 'multi-gate',
  },
  {
    syntax: '^cost:<optionId>',
    desc: '옵션 비용 평가 — 같은 id의 ^option에 attach',
    example: '초기 셋업 1주 ^cost:jwt',
    category: 'annotation',
  },
  {
    syntax: '^benefit:<optionId>',
    desc: '옵션 이점 평가',
    example: 'stateless 인증 ^benefit:jwt',
    category: 'annotation',
  },
  {
    syntax: '^risk:<optionId>',
    desc: '옵션 위험 평가',
    example: '탈취 시 회수 어려움 ^risk:jwt',
    category: 'annotation',
  },
];
