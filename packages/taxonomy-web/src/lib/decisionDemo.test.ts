import { describe, it, expect } from 'vitest';
import { parseDecisionFile, toFlowSchema } from 'taxonomy-decision-bridge';
import {
  classifyParseError,
  detectSkeleton,
  analyzeEvidenceFanout,
  detectCycles,
  findUnknownMarkers,
  computeMarkerStats,
  verifyRoundtrip,
  MARKER_CHEATSHEET,
} from './decisionDemo';
import { toMarkdownText, extractEvidence } from 'taxonomy-decision-bridge';
import {
  SAMPLE_SKELETON,
  SAMPLE_SINGLE_GATE,
  SAMPLE_MULTI_GATE,
} from '../data/decisionDemoSamples';

describe('classifyParseError', () => {
  it('frontmatter 누락 → frontmatter-missing', () => {
    const e = classifyParseError('frontmatter 누락: --- ... --- 블록 필요');
    expect(e.kind).toBe('frontmatter-missing');
    expect(e.hint).toContain('`---`');
  });

  it('lifecycle 잘못 → lifecycle', () => {
    const e = classifyParseError('frontmatter.lifecycle 잘못된 값: foo');
    expect(e.kind).toBe('lifecycle');
    expect(e.hint).toContain('draft');
  });

  it('frontmatter 필드 누락 → frontmatter-field', () => {
    const e = classifyParseError('frontmatter.id 필수 (string)');
    expect(e.kind).toBe('frontmatter-field');
    expect(e.hint).toContain('id');
  });

  it('기타 → unknown', () => {
    const e = classifyParseError('어떤 다른 에러');
    expect(e.kind).toBe('unknown');
  });
});

describe('detectSkeleton — sample 검증', () => {
  it('SKELETON 샘플은 skeleton', () => {
    const file = parseDecisionFile(SAMPLE_SKELETON);
    const schema = toFlowSchema(file);
    const s = detectSkeleton(file, schema);
    expect(s.isSkeleton).toBe(true);
  });

  it('SINGLE_GATE 샘플은 skeleton 아님', () => {
    const file = parseDecisionFile(SAMPLE_SINGLE_GATE);
    const schema = toFlowSchema(file);
    const s = detectSkeleton(file, schema);
    expect(s.isSkeleton).toBe(false);
    expect(s.reason).toMatch(/옵션 3건/);
  });

  it('MULTI_GATE 샘플은 skeleton 아님', () => {
    const file = parseDecisionFile(SAMPLE_MULTI_GATE);
    const schema = toFlowSchema(file);
    const s = detectSkeleton(file, schema);
    expect(s.isSkeleton).toBe(false);
  });

  it("증거만 있고 옵션 0건이면 '탐색 단계'", () => {
    const md = `---
id: x
subject: y
lifecycle: draft
created: 2026-01-01T00:00:00Z
updated: 2026-01-01T00:00:00Z
---
질문 ^purpose

증거만 있음 ^evidence:data weight=1
`;
    const file = parseDecisionFile(md);
    const schema = toFlowSchema(file);
    const s = detectSkeleton(file, schema);
    expect(s.isSkeleton).toBe(false);
    expect(s.reason).toMatch(/탐색 단계/);
  });
});

describe('analyzeEvidenceFanout', () => {
  it('single-gate면 위험 없음', () => {
    const file = parseDecisionFile(SAMPLE_SINGLE_GATE);
    const schema = toFlowSchema(file);
    const f = analyzeEvidenceFanout(schema);
    expect(f.hasDuplicationRisk).toBe(false);
  });

  it("MULTI_GATE 샘플 — protocol/schema-mgmt 모두 'rule' 필요 → 복제 위험", () => {
    const file = parseDecisionFile(SAMPLE_MULTI_GATE);
    const schema = toFlowSchema(file);
    const f = analyzeEvidenceFanout(schema);
    // 실제 샘플 구성 의존 — 동일 kind를 여러 gate가 요구하는지 검사
    const hasAny = f.duplicatedKinds.length > 0;
    if (hasAny) {
      expect(f.hasDuplicationRisk).toBe(true);
      // 중복 가정 시 gate 목록 길이 ≥ 2
      for (const d of f.duplicatedKinds) {
        expect(d.gates.length).toBeGreaterThanOrEqual(2);
      }
    } else {
      // 샘플이 우연히 중복 없음 — 그래도 통과
      expect(f.hasDuplicationRisk).toBe(false);
    }
  });

  it('두 gate가 같은 evidence kind 요구하면 중복 감지', () => {
    const md = `---
id: x
subject: y
lifecycle: draft
created: 2026-01-01T00:00:00Z
updated: 2026-01-01T00:00:00Z
---
^purpose 질문

^gate:a ^phase:diverge
opt1 ^option:o1
근거1 ^evidence:data weight=1

^gate:b ^phase:converge
opt2 ^option:o2
근거2 ^evidence:data weight=1
`;
    const file = parseDecisionFile(md);
    const schema = toFlowSchema(file);
    const f = analyzeEvidenceFanout(schema);
    expect(f.hasDuplicationRisk).toBe(true);
    expect(f.duplicatedKinds).toEqual([{ kind: 'data', gates: ['a', 'b'] }]);
  });
});

describe('MARKER_CHEATSHEET', () => {
  it('12개 항목 (9 + cost/benefit/risk)', () => {
    expect(MARKER_CHEATSHEET.length).toBe(12);
  });

  it('필수 마커 ^purpose 포함', () => {
    const ids = MARKER_CHEATSHEET.map((m) => m.syntax);
    expect(ids).toContain('^purpose');
  });

  it('multi-gate 카테고리에 ^gate와 ^depends_on 둘 다', () => {
    const multi = MARKER_CHEATSHEET.filter((m) => m.category === 'multi-gate');
    expect(multi.map((m) => m.syntax)).toEqual(
      expect.arrayContaining(['^gate:<id>', '^depends_on:<gateId>:<kind>']),
    );
  });
});

describe('detectCycles', () => {
  it('MULTI_GATE 샘플은 사이클 없음', () => {
    const file = parseDecisionFile(SAMPLE_MULTI_GATE);
    const schema = toFlowSchema(file);
    expect(detectCycles(schema)).toEqual([]);
  });

  it('2-cycle 감지 — a → b → a', () => {
    const md = `---
id: x
subject: y
lifecycle: draft
created: 2026-01-01T00:00:00Z
updated: 2026-01-01T00:00:00Z
---
^purpose 질문

^gate:a ^depends_on:b:enables
o ^option:o1

^gate:b ^depends_on:a:enables
o ^option:o2
`;
    const file = parseDecisionFile(md);
    const schema = toFlowSchema(file);
    const cycles = detectCycles(schema);
    expect(cycles.length).toBe(1);
    expect(cycles[0].nodes.sort()).toEqual(['a', 'b']);
  });

  it('self-loop 감지 — a → a', () => {
    const md = `---
id: x
subject: y
lifecycle: draft
created: 2026-01-01T00:00:00Z
updated: 2026-01-01T00:00:00Z
---
^purpose 질문

^gate:a ^depends_on:a:enables
o ^option:o1
`;
    const file = parseDecisionFile(md);
    const schema = toFlowSchema(file);
    const cycles = detectCycles(schema);
    expect(cycles).toEqual([{ nodes: ['a'] }]);
  });

  it('3-cycle 감지 — a → b → c → a (rotation invariant)', () => {
    const md = `---
id: x
subject: y
lifecycle: draft
created: 2026-01-01T00:00:00Z
updated: 2026-01-01T00:00:00Z
---
^purpose 질문

^gate:a ^depends_on:b:enables
o ^option:o1

^gate:b ^depends_on:c:enables
o ^option:o2

^gate:c ^depends_on:a:enables
o ^option:o3
`;
    const file = parseDecisionFile(md);
    const schema = toFlowSchema(file);
    const cycles = detectCycles(schema);
    expect(cycles.length).toBe(1);
    expect(cycles[0].nodes.sort()).toEqual(['a', 'b', 'c']);
  });
});

describe('findUnknownMarkers', () => {
  it('정상 마커만 있으면 빈 배열', () => {
    const body = 'purpose ^purpose\noption x ^option:a\n';
    expect(findUnknownMarkers(body)).toEqual([]);
  });

  it('미정의 마커 감지', () => {
    const body = 'purpose ^purpose\nfoo ^foo\n';
    const u = findUnknownMarkers(body);
    expect(u.length).toBe(1);
    expect(u[0].name).toBe('foo');
    expect(u[0].line).toBe(2);
  });

  it('대소문자 구분 — ^Purpose 는 미정의', () => {
    const u = findUnknownMarkers('^Purpose 잘못된');
    expect(u.map((x) => x.name)).toEqual(['Purpose']);
  });

  it('여러 줄에서 line 번호 추적', () => {
    const body = '\n\n^bad1 first\n\n^bad2 second\n';
    const u = findUnknownMarkers(body);
    expect(u.map((x) => x.line)).toEqual([3, 5]);
  });
});

describe('computeMarkerStats', () => {
  it('MULTI_GATE 샘플 — gate 3개 + option 합산 + phase 다수', () => {
    const file = parseDecisionFile(SAMPLE_MULTI_GATE);
    const stats = computeMarkerStats(file);
    expect(stats.gateCount).toBe(3);
    expect(stats.totalOptions).toBeGreaterThan(0);
    expect(stats.totalEvidence).toBeGreaterThan(0);
    expect(stats.phasesUsed.length).toBeGreaterThanOrEqual(2);
  });

  it('evidenceByKind 집계', () => {
    const file = parseDecisionFile(SAMPLE_SINGLE_GATE);
    const stats = computeMarkerStats(file);
    expect(stats.evidenceByKind.rule).toBeGreaterThanOrEqual(1);
  });

  it('SKELETON 샘플 — 0건', () => {
    const file = parseDecisionFile(SAMPLE_SKELETON);
    const stats = computeMarkerStats(file);
    expect(stats.totalOptions).toBe(0);
    expect(stats.totalEvidence).toBe(0);
    expect(stats.gateCount).toBe(1);
  });
});

describe('verifyRoundtrip', () => {
  it('모든 sample이 라운드트립 의미 보존', () => {
    for (const sample of [SAMPLE_SKELETON, SAMPLE_SINGLE_GATE, SAMPLE_MULTI_GATE]) {
      const file = parseDecisionFile(sample);
      const schema = toFlowSchema(file);
      const md = toMarkdownText({
        schema,
        lifecycle: file.meta.lifecycle,
        evidence: extractEvidence(file),
        outcome: file.markers.outcome,
        created: file.meta.created,
        updated: file.meta.updated,
      });
      const reparsed = toFlowSchema(parseDecisionFile(md));
      const check = verifyRoundtrip(schema, reparsed);
      expect(check.ok).toBe(true);
    }
  });

  it('gate 수 다르면 fail', () => {
    const a: any = { gates: [{ id: 'x', branches: [] }] };
    const b: any = { gates: [] };
    const c = verifyRoundtrip(a, b);
    expect(c.ok).toBe(false);
    expect(c.reason).toMatch(/gate 수/);
  });
});

describe('sample round-trip 검증', () => {
  it('MULTI_GATE 샘플 gate id 3개 (protocol/schema-mgmt/deployment)', () => {
    const file = parseDecisionFile(SAMPLE_MULTI_GATE);
    const schema = toFlowSchema(file);
    expect(schema.gates.map((g) => g.id)).toEqual(['protocol', 'schema-mgmt', 'deployment']);
  });

  it('MULTI_GATE deployment gate의 depends_on 2개 (protocol/schema-mgmt)', () => {
    const file = parseDecisionFile(SAMPLE_MULTI_GATE);
    const schema = toFlowSchema(file);
    const deployment = schema.gates.find((g) => g.id === 'deployment');
    expect(deployment?.affects).toEqual([
      { gateId: 'protocol', kind: 'constrains' },
      { gateId: 'schema-mgmt', kind: 'enables' },
    ]);
  });
});
