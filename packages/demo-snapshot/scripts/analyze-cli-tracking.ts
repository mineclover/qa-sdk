#!/usr/bin/env tsx
/**
 * cli_tracking 주소 공간 비교 분석.
 *
 * 현재 4D vs 차원 축소/필터 옵션들을 비교한다.
 */

import { DEMO_CATALOG } from "../src/index.js";

// ── 축 데이터 로드 ──────────────────────────────────────────────

function getAxisInfo(axisId: string) {
  const axis = (DEMO_CATALOG.axes as any)[axisId];
  const snap = Object.values(axis.versions).pop() as any;
  return { entries: snap.entries as string[], capacity: (snap.capacity ?? snap.entries.length) as number };
}

const cli_intent = getAxisInfo("cli_intent");
const cli_domain = getAxisInfo("cli_domain");
const cli_subject = getAxisInfo("cli_subject");
const skill_outcome = getAxisInfo("skill_outcome");

// ── 시뮬레이션 함수 ─────────────────────────────────────────────

interface Scenario {
  name: string;
  dims: Array<{ label: string; entries: string[]; capacity: number }>;
  note: string;
}

function simulate(sc: Scenario) {
  const { dims } = sc;

  // stride 계산
  const strides = new Array(dims.length).fill(1);
  for (let i = dims.length - 2; i >= 0; i--) {
    strides[i] = strides[i + 1] * dims[i + 1].capacity;
  }

  const totalSpace = dims[0].capacity * strides[0];
  const usedCombos = dims.reduce((p, d) => p * d.entries.length, 1);
  const maxAddr = dims.reduce((s, d, i) => s + (d.entries.length - 1) * strides[i], 0);
  const sumEvents = dims.reduce((s, d) => s + d.entries.length, 0);

  return { totalSpace, usedCombos, maxAddr, sumEvents, strides };
}

// ── 시나리오 정의 ───────────────────────────────────────────────

const scenarios: Scenario[] = [
  // A. 현재 — 4D 전체
  {
    name: "A. 현재 (4D 전체)",
    dims: [
      { label: "cli_intent", ...cli_intent },
      { label: "cli_domain", ...cli_domain },
      { label: "cli_subject", ...cli_subject },
      { label: "skill_outcome", ...skill_outcome },
    ],
    note: "cli_event와 subject 중복",
  },

  // B. subject 제거 — 3D
  {
    name: "B. subject 제거 (3D)",
    dims: [
      { label: "cli_intent", ...cli_intent },
      { label: "cli_domain", ...cli_domain },
      { label: "skill_outcome", ...skill_outcome },
    ],
    note: "subject는 cli_event가 이미 추적. 역할 분담: cli_event=행위, cli_tracking=결과",
  },

  // C. intent 축소 — 실행 관점만 (query/analyze → read, mutate/publish → write)
  {
    name: "C. intent 압축 + subject 제거 (3D)",
    dims: [
      { label: "cli_intent(압축)", entries: ["read", "write", "lifecycle"], capacity: 8 },
      { label: "cli_domain", ...cli_domain },
      { label: "skill_outcome", ...skill_outcome },
    ],
    note: "query+analyze→read, mutate+publish→write, lifecycle+init+backup→lifecycle",
  },

  // D. domain도 압축 — 큰 범주로
  {
    name: "D. intent+domain 압축 (3D)",
    dims: [
      { label: "cli_intent(압축)", entries: ["read", "write", "lifecycle"], capacity: 8 },
      { label: "cli_domain(압축)", entries: ["graph", "analysis", "coordinate", "system"], capacity: 8 },
      { label: "skill_outcome", ...skill_outcome },
    ],
    note: "dkg-graph+dkg-skill→graph, convergence+spec→analysis, coordinate+registry+catalog→coordinate, self-ref+system+ingest→system",
  },

  // E. 2D — 의도+결과만
  {
    name: "E. 최소 2D (intent × outcome)",
    dims: [
      { label: "cli_intent", ...cli_intent },
      { label: "skill_outcome", ...skill_outcome },
    ],
    note: "가장 핵심적인 두 축만. domain/subject 정보는 payload로",
  },

  // F. 2D — 압축 의도+결과
  {
    name: "F. 최소 2D 압축 (intent(3) × outcome)",
    dims: [
      { label: "cli_intent(압축)", entries: ["read", "write", "lifecycle"], capacity: 8 },
      { label: "skill_outcome", ...skill_outcome },
    ],
    note: "주소 공간 최소화. 상세는 payload",
  },

  // G. subject 제거 + label 순서 최적화 (큰 capacity를 뒤로)
  {
    name: "G. subject 제거 + 순서 최적화 (3D)",
    dims: [
      { label: "skill_outcome", ...skill_outcome },
      { label: "cli_intent", ...cli_intent },
      { label: "cli_domain", ...cli_domain },
    ],
    note: "B와 같은 축이지만 순서 뒤집음. max addr 변화 확인",
  },
];

// ── 출력 ────────────────────────────────────────────────────────

console.log("══ cli_tracking 주소 공간 비교 ══\n");

// 축 현황
console.log("── 현재 축 구성 ──\n");
for (const ax of [
  { id: "cli_intent", ...cli_intent },
  { id: "cli_domain", ...cli_domain },
  { id: "cli_subject", ...cli_subject },
  { id: "skill_outcome", ...skill_outcome },
]) {
  console.log(`  ${ax.id} (${ax.entries.length}/${ax.capacity})`);
  // 의미 그룹핑 표시
  const groups: Record<string, string[]> = {};
  for (const e of ax.entries) {
    let g = "기타";
    if (ax.id === "cli_intent") {
      if (["query", "analyze"].includes(e)) g = "읽기";
      else if (["mutate", "publish"].includes(e)) g = "쓰기";
      else g = "관리";
    } else if (ax.id === "cli_domain") {
      if (["dkg-graph", "dkg-skill"].includes(e)) g = "그래프";
      else if (["convergence", "spec"].includes(e)) g = "분석";
      else if (["coordinate", "registry", "catalog"].includes(e)) g = "좌표";
      else g = "시스템";
    }
    if (!groups[g]) groups[g] = [];
    groups[g].push(e);
  }
  if (ax.id === "cli_intent" || ax.id === "cli_domain") {
    for (const [g, entries] of Object.entries(groups)) {
      console.log(`    ${g}: [${entries.join(", ")}]`);
    }
  } else {
    console.log(`    [${ax.entries.join(", ")}]`);
  }
}

console.log("\n── 시나리오 비교 ──\n");
console.log("시나리오                              차원  주소공간     유효조합   활용률     최대주소    합전략");
console.log("────────────────────────────────────  ────  ─────────  ─────────  ────────  ──────────  ──────");

const results = scenarios.map(sc => {
  const r = simulate(sc);
  return { ...sc, ...r };
});

for (const r of results) {
  const dimStr = `${r.dims.length}D`;
  const pct = (r.usedCombos / r.totalSpace * 100).toFixed(1) + "%";
  console.log(
    `${r.name.padEnd(38)}${dimStr.padStart(4)}  ${r.totalSpace.toLocaleString().padStart(9)}  ${r.usedCombos.toLocaleString().padStart(9)}  ${pct.padStart(8)}  ${r.maxAddr.toLocaleString().padStart(10)}  ${String(r.sumEvents).padStart(6)}`
  );
}

// 대비 비교
console.log("\n── A 대비 축소율 ──\n");
const base = results[0];
for (const r of results.slice(1)) {
  const spaceRatio = (base.totalSpace / r.totalSpace).toFixed(0);
  const addrRatio = (base.maxAddr / r.maxAddr).toFixed(1);
  console.log(`  ${r.name}`);
  console.log(`    주소공간 ${spaceRatio}배 축소, 최대주소 ${addrRatio}배 축소`);
  console.log(`    ${r.note}`);
}
