/**
 * sync-obsidian — DEMO_CATALOG + DKG → Obsidian 볼트 단방향 동기화.
 *
 * SSOT: DEMO_CATALOG + DEMO_DKG_CONFIG
 * 방향: 소스 → Obsidian (단방향, Obsidian 수정은 소스에 반영되지 않음)
 *
 * 사용: qa-sdk sync-obsidian [--vault <name>] [--dry-run]
 */

import { execaSync, type ExecaSyncError } from "execa";
import { DEMO_CATALOG, DEMO_DKG_CONFIG } from "demo-snapshot";
import type { Catalog, DimRef, PrefixDef, VersionedAxis } from "@qa-sdk/core";
import { bootstrapDkg } from "@qa-sdk/spec-core/analysis";

// ── DimRef 헬퍼 ──────────────────────────────────────

function dimRefId(d: DimRef): string {
  if (d.kind === "axis") return d.axisId;
  if (d.kind === "prefix_ref") return d.prefixId;
  return d.table;
}

function dimRefWikilink(d: DimRef): string {
  if (d.kind === "table_ref") return `"${d.table}"`;
  return `"[[${dimRefId(d)}]]"`;
}

function dimRefMarkdownLink(d: DimRef): string {
  if (d.kind === "table_ref") return d.table;
  return `[[${dimRefId(d)}]]`;
}

function isPrefixRef(d: DimRef, targetId: string): boolean {
  return d.kind === "prefix_ref" && d.prefixId === targetId;
}

function isAxisRef(d: DimRef, targetId: string): boolean {
  return d.kind === "axis" && d.axisId === targetId;
}

// ── DKG Config 타입 ──────────────────────────────────

interface DkgDomain {
  readonly id: string;
  readonly name: string;
  readonly prefixes: readonly string[];
  readonly sharedAxes: readonly string[];
  readonly boundary: { readonly exports: readonly string[]; readonly internal: readonly string[] };
  readonly rationale: string;
}

interface DkgDslBundle {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly memberPrefixes: readonly string[];
  readonly serviceBindingPrefix: string;
  readonly fixedDims: readonly string[];
  readonly invariants?: readonly string[];
}

const domains = DEMO_DKG_CONFIG.domains as readonly DkgDomain[];
const dslBundles = DEMO_DKG_CONFIG.dslBundles as readonly DkgDslBundle[];
const CATALOG: Catalog = DEMO_CATALOG;

function getPrefix(id: string): PrefixDef | undefined {
  return (CATALOG.prefixes as Record<string, PrefixDef>)[id];
}

function getAxis(id: string): VersionedAxis | undefined {
  return (CATALOG.axes as Record<string, VersionedAxis>)[id];
}

function execaErrorText(err: ExecaSyncError): string {
  return typeof err.stderr === "string" ? err.stderr.trim() : String(err.stderr ?? "").trim();
}

// ── Signal Role 매핑 ─────────────────────────────────

const SIGNAL_ROLE_MAP: Record<string, string> = {
  service: "context",
  tracking: "trigger",
  endpoint: "channel",
  flow_point: "state",
  permission: "guard",
  pipeline_point: "effect",
  order_event: "data",
};

// ── 카테고리 한국어 ──────────────────────────────────

const CATEGORY_KO: Record<string, string> = {
  entity: "엔티티",
  event: "이벤트",
  relation: "관계",
  state: "상태",
  policy: "정책",
  observation: "관측",
};

// ── Obsidian CLI 래퍼 ────────────────────────────────

function obsidianWrite(vault: string, path: string, content: string): void {
  try {
    execaSync("obsidian", ["create", `vault=${vault}`, `path=${path}`, `content=${content}`, "silent", "overwrite"], { timeout: 10_000 });
  } catch (err: unknown) {
    const e = err as ExecaSyncError;
    console.error(`  ✗ ${path}: ${execaErrorText(e) || e.message}`);
  }
}

// ── 노트 생성 함수 ──────────────────────────────────

interface SyncNote {
  path: string;
  content: string;
}

function buildPrefixNote(id: string, prefix: PrefixDef): SyncNote {
  const category = prefix.meta?.category ?? "entity";
  const signalRole = SIGNAL_ROLE_MAP[id];
  const dims = Object.entries(prefix.dims);
  // domain 찾기
  const prefixDomains = domains.filter(d => d.prefixes.includes(id));

  const frontmatter = [
    "---",
    `title: ${id}`,
    `kind: prefix`,
    `category: ${category}`,
    ...(prefixDomains.length > 0 ? [`domain: [${prefixDomains.map(d => `"[[${d.id}]]"`).join(", ")}]`] : []),
    ...(signalRole ? [`signal-role: ${signalRole}`] : []),
    `dims: [${dims.map(([, d]) => dimRefWikilink(d)).join(", ")}]`,
    `versions: ${prefix.versions?.length ?? 1}`,
    `source: DEMO_CATALOG.prefixes.${id}`,
    "---",
  ].join("\n");

  const dimTable = dims.map(([label, d]) =>
    `| ${label} | ${d.kind} | ${dimRefMarkdownLink(d)} |`
  ).join("\n");

  // 이 prefix를 참조하는 다른 prefix 찾기
  const referencedBy = Object.entries(CATALOG.prefixes)
    .filter(([, p]) => Object.values(p.dims).some(d => isPrefixRef(d, id)))
    .map(([refId, p]) => {
      const refLabel = Object.entries(p.dims).find(([, d]) => isPrefixRef(d, id))?.[0];
      return `- [[${refId}]] (${refLabel})`;
    });

  // domain 내 위치 (exports/internal)
  const domainPositions = prefixDomains.map(d => {
    const pos = d.boundary.exports.includes(id) ? "exports" : "internal";
    return `- [[${d.id}]] (${pos})`;
  });

  const body = [
    `# ${id} — ${prefix.name}`,
    "",
    prefix.description ?? `${prefix.labels.join(" × ")}을 교차하여 ${CATEGORY_KO[category] ?? category}을 정의한다.`,
    "",
    "## 차원",
    "",
    "| label | kind | ref |",
    "|-------|------|-----|",
    dimTable,
    ...(referencedBy.length > 0 ? [
      "",
      "## 참조하는 prefix",
      "",
      "이 prefix를 prefix_ref로 참조하는 prefix:",
      ...referencedBy,
    ] : []),
    ...(domainPositions.length > 0 ? [
      "",
      "## 소속",
      "",
      ...domainPositions,
    ] : []),
  ].join("\n");

  return { path: `prefix/${id}.md`, content: `${frontmatter}\n\n${body}` };
}

function buildAxisNote(id: string, axis: VersionedAxis): SyncNote {
  const versions = Object.keys(axis.versions);
  const latestKey = versions[versions.length - 1];
  const latest = axis.versions[latestKey];
  const entries = latest.entries ?? [];
  const capacity = latest.capacity ?? entries.length;

  // 이 axis를 사용하는 prefix 찾기
  const usedBy = Object.entries(CATALOG.prefixes)
    .filter(([, p]) => Object.values(p.dims).some(d => isAxisRef(d, id)))
    .map(([prefixId, p]) => {
      const label = Object.entries(p.dims).find(([, d]) => isAxisRef(d, id))?.[0];
      return `- [[${prefixId}]] (${label})`;
    });

  const frontmatter = [
    "---",
    `title: ${id}`,
    `kind: axis`,
    `name: ${axis.name}`,
    `entries: ${entries.length}`,
    `capacity: ${capacity}`,
    `versions: ${versions.length}`,
    `source: DEMO_CATALOG.axes.${id}`,
    "---",
  ].join("\n");

  const entryList = entries.length <= 20
    ? entries.map((e, i) => `| ${i + 1} | ${e} |`).join("\n")
    : [...entries.slice(0, 15).map((e, i) => `| ${i + 1} | ${e} |`), `| ... | (${entries.length - 15}개 생략) |`].join("\n");

  const body = [
    `# ${id} — ${axis.name}`,
    "",
    `entries ${entries.length} / capacity ${capacity} (headroom ${capacity - entries.length})`,
    "",
    "## entries",
    "",
    "| position | entry |",
    "|----------|-------|",
    entryList,
    ...(usedBy.length > 0 ? [
      "",
      "## 사용하는 prefix",
      "",
      ...usedBy,
    ] : []),
  ].join("\n");

  return { path: `axis/${id}.md`, content: `${frontmatter}\n\n${body}` };
}

function buildDslNote(bundle: DkgDslBundle): SyncNote {
  const memberLinks = bundle.memberPrefixes.map(p => `"[[${p}]]"`).join(", ");
  const invariants = bundle.invariants;

  const frontmatter = [
    "---",
    `title: ${bundle.id}`,
    `kind: dsl`,
    `name: ${bundle.name}`,
    `members: [${memberLinks}]`,
    `service-binding: "[[${bundle.serviceBindingPrefix}]]"`,
    `fixed-dims: [${bundle.fixedDims.map(d => `"[[${d}]]"`).join(", ")}]`,
    `source: DEMO_DKG_CONFIG.dslBundles.${bundle.id}`,
    "---",
  ].join("\n");

  const memberTable = bundle.memberPrefixes.map(p => {
    const prefix = getPrefix(p);
    const cat = prefix?.meta?.category ?? "?";
    return `| [[${p}]] | ${cat} | ${prefix?.name ?? p} |`;
  }).join("\n");

  const body = [
    `# ${bundle.id} — ${bundle.name}`,
    "",
    bundle.description,
    "",
    "## 구성 prefix",
    "",
    "| prefix | category | 설명 |",
    "|--------|----------|------|",
    memberTable,
    "",
    `## service binding`,
    "",
    `[[${bundle.serviceBindingPrefix}]]의 고정 차원 (${bundle.fixedDims.join(", ")})으로 서비스 컨텍스트를 바인딩.`,
    ...(invariants && invariants.length > 0 ? [
      "",
      "## invariants",
      "",
      ...invariants.map(inv => `- ${inv}`),
    ] : []),
  ].join("\n");

  return { path: `dsl/${bundle.id}.md`, content: `${frontmatter}\n\n${body}` };
}

function buildDomainNote(domain: DkgDomain): SyncNote {
  const prefixLinks = domain.prefixes.map((p: string) => `"[[${p}]]"`).join(", ");
  const exportLinks = domain.boundary.exports.map((p: string) => `"[[${p}]]"`).join(", ");
  const internalLinks = domain.boundary.internal.map((p: string) => `"[[${p}]]"`).join(", ");

  const frontmatter = [
    "---",
    `title: ${domain.id}`,
    `kind: domain`,
    `prefixes: [${prefixLinks}]`,
    ...(domain.sharedAxes.length > 0 ? [`shared-axes: [${domain.sharedAxes.map((a: string) => `"[[${a}]]"`).join(", ")}]`] : []),
    `exports: [${exportLinks}]`,
    ...(domain.boundary.internal.length > 0 ? [`internal: [${internalLinks}]`] : []),
    `source: DEMO_DKG_CONFIG.domains.${domain.id}`,
    "---",
  ].join("\n");

  const prefixTable = domain.prefixes.map((p: string) => {
    const prefix = getPrefix(p);
    if (!prefix) return `| [[${p}]] | ? | - |`;
    const cat = prefix.meta?.category ?? "entity";
    const pos = domain.boundary.exports.includes(p) ? "exports" : "internal";
    return `| [[${p}]] | ${cat} | ${pos} |`;
  }).join("\n");

  const body = [
    `# ${domain.id} — ${domain.name}`,
    "",
    domain.rationale,
    "",
    "## 구조",
    "",
    "| prefix | category | boundary |",
    "|--------|----------|----------|",
    prefixTable,
    ...(domain.sharedAxes.length > 0 ? [
      "",
      `## 공유 축`,
      "",
      domain.sharedAxes.join(", "),
    ] : []),
  ].join("\n");

  return { path: `domain/${domain.id}.md`, content: `${frontmatter}\n\n${body}` };
}

function buildLayerNotes(): SyncNote[] {
  return [
    {
      path: "layer/indexing-layer.md",
      content: `---
title: Indexing Layer
kind: layer
position: 0
source: qa-sdk/docs/specs/spec-engine/README.md
---

# Indexing Layer — 수학/인코딩

> 작은 세계 하나를 수학적으로 정의하고 운용하는 원시 도구.

## 패키지

- **weighted-index** — 다차원 → 1D 정수 변환 (stride 기반)
- **bit-index** — 차원별 비트 패킹 (O(1) 차원 추출)
- **permission-engine** — 비트마스크 기반 권한 엔진
- **index-meta** — 주소 프로토콜 관리 (DecodeMap, AddressConfig)
- **demo-snapshot** — DEMO_CATALOG (SSOT)

## 주소 체계 이중 축

- **문자열**: 외우기 쉽고 설명하기 쉬운 식별자 ("admin")
- **인덱스**: 계산하기 쉬운 정수 (1)

두 표현은 동일한 것의 양면. 다차원 축 자체가 다시 1차원 축이 될 수 있다 → 재귀적 합성.

## 관련

- [[spec-engine-layer]] — 이 레이어를 소비
- [[identity]] — 차원 압축이 시스템의 핵심 능력`,
    },
    {
      path: "layer/spec-engine-layer.md",
      content: `---
title: Spec Engine Layer
kind: layer
position: 1
source: qa-sdk/docs/specs/spec-engine/README.md
---

# Spec Engine Layer — 설계 근거

> 그 세계를 왜 이렇게 구성했고, 밖에서 어떻게 보이는지 정의하는 도구.

## 3가지 정의

1. **Export Surface** — prefix가 외부에 노출하는 제목 패턴
2. **Schema** — 구조 검증 (6종 카테고리: entity, event, relation, state, policy, observation)
3. **Spec Document** — prefix의 존재 이유, 차원 선택 근거

## 관련

- [[indexing-layer]] — 소비 대상 (역방향 의존 금지)
- [[dkg-layer]] — 이 레이어를 소비`,
    },
    {
      path: "layer/dkg-layer.md",
      content: `---
title: Design Knowledge Graph
kind: layer
position: 2
source: qa-sdk/docs/specs/spec-engine/design-knowledge-graph.md
---

# DKG Layer — 설계 지식 그래프

> 좌표 시스템이 "주소를 부여"하듯, 이 그래프는 "주소 체계의 설계 결정에 추적성을 부여"한다.

## 노드 12종

| 출처 | 노드 |
|------|------|
| 카탈로그 승계 | Axis, Prefix, Spec, Schema |
| DKG 고유 (설계) | Decision, VersionEvent, Constraint, Observation |
| DKG 고유 (구조) | Domain, Consumer, IntentLink, DslBundle |

## 엣지 18종

설계 순방향 5 + spec-engine 승계 5 + 도메인/소비/연결 4 + 운영 역방향 2 + 진화 추적 2 = 18종.

## 성장 나선

고정 축 정의 → 운용 → 기능 발견 → 새 고정 축 → ...

## 관련

- [[spec-engine-layer]] — 소비 대상
- [[convergence-layer]] — DKG + 관측 데이터로 수렴 기회 발견`,
    },
    {
      path: "layer/convergence-layer.md",
      content: `---
title: Convergence Layer
kind: layer
position: 3
source: qa-sdk/docs/specs/spec-engine/convergence-layer.md
---

# Convergence Layer — 수렴 분석

> 좌표 시스템의 심볼들이 점차 수렴하도록 돕는 분석 계층.

14개 도구: usage-aggregator, deployment-skew, category-filter, entry-coverage, symbol-comparator, decision-comparator, causal-discovery, simplification-advisor, boundary-recommender, capacity-optimizer, headroom-advisor, scoped-aggregator, temporal-analysis, separation-record.

## 입출력

- **입력**: [[dkg-layer]] GraphRegistry (구조) + UsageData (관측 집계)
- **출력**: Observation 노드 → Decision scaffold → propagation

## 관련

- [[dkg-layer]] — 그래프 구조 제공
- [[identity]] — "관측을 유지하여 관측 밖의 상황을 탐색한다"`,
    },
  ];
}

function buildArchitectureNotes(): SyncNote[] {
  return [
    {
      path: "arch/observation-loop.md",
      content: `---
title: Observation Loop
kind: architecture
source: CLAUDE.md (Observation Loop)
related-layers: ["[[convergence-layer]]", "[[dkg-layer]]"]
---

# Observation Loop — 관측 루프

런타임 이벤트 → 자동 분석 → DKG 기록 → 활성화 게이트의 폐루프 아키텍처.

## 파이프라인 흐름

\`\`\`
ingest-server Phase 2 완료
  → ConvergencePipelineRunner.notifyCompletion(traceIds)
  → 버퍼 축적 (threshold 100건 or timer 60초)
  → recordStore.findByTraceId() → AddressContextRecord[]
  → aggregateUsageData(catalog, records)
  → collectMetrics(catalog, graph, usageData)
  → metricsToObservations(metrics)
  → DkgSqliteStore.saveUsageSnapshotWithObservations()
\`\`\`

## 구성 요소

| 모듈 | 패키지 | 역할 |
|------|--------|------|
| convergence-pipeline | ingest-server | Window-based 배치 처리, Phase 2 후단 |
| convergence-graph-provider | ingest-server | Lazy DKG graph/catalog 초기화 |
| convergence-scheduler | ingest-server | 주기적 강제 flush (저트래픽 대응) |
| activation-gate | spec-core/propagation | checkActivationReadiness() 순수 함수 |
| activation-gate-adapter | registry-service | ActivationGatePort 어댑터 (fail-open) |
| post-activation-hook | registry-service | 활성화 후 VersionEvent 자동 기록 |

## 설계 원칙

- spec-core는 라이브러리 — ingest-server/registry-service에 정적 의존 없음
- 서비스는 동적 import (ENABLED=true일 때만) + optional peer dependency
- 에러 격리: convergence 실패가 Phase 2 verdict/활성화를 절대 차단하지 않음
- Fail-open: gate check 실패 → 허용 + warning diagnostic

## 관련

- [[convergence-layer]] — 14개 수렴 도구
- [[dkg-layer]] — Observation/Decision 기록
- [[msa-topology]] — 서비스 간 연결`,
    },
    {
      path: "arch/msa-topology.md",
      content: `---
title: MSA 서비스 토폴로지
kind: architecture
source: docs/msa-architecture.md
---

# MSA 서비스 토폴로지

## 서비스 구성 (7개)

| 서비스 | 포트 | 저장소 | 역할 |
|--------|------|--------|------|
| ingest-server | 3200 | PostgreSQL + Redis | 이벤트 수집, address_context 검증, 실시간 스트림 |
| worker | — | PostgreSQL + Redis | Phase-2 비동기 처리, DLQ |
| registry-service | 3300 | SQLite/Mem | prefix 등록, 카탈로그 CRUD, 이벤트 스키마 검증 |
| decode-service | 3600 | In-memory cache | mixed-radix decode, TTL 캐시 |
| gate-service | 3400 | SQLite (file) | 주소 상태 관리, cascade 전파 |
| query-service | 3500 | SQLite (file) | 정책 규칙 기반 질의 |

## 데이터 흐름

\`\`\`
Client → ingest-server (Phase 1) → Redis Queue → worker (Phase 2)
                                                       ↓
                                            convergence pipeline
                                                       ↓
                                              DKG Observation
\`\`\`

## prefix와의 관계

모든 서비스가 [[service]] prefix의 좌표 공간에서 식별된다. 각 서비스는 자기가 필요한 prefix의 DecodeMap만 받아서 독립적으로 decode.

## 관련

- [[observation-loop]] — 폐루프 아키텍처
- [[identity]] — 서비스 분할도 좌표계의 설계 결정`,
    },
    {
      path: "arch/catalog-registry.md",
      content: `---
title: CatalogRegistry
kind: architecture
source: packages/core/src/catalog/catalog-registry.ts
---

# CatalogRegistry — 멀티 카탈로그 런타임

인메모리 Map<id, Catalog>으로 멀티 카탈로그를 런타임에 관리.

## 핵심

- 기본 카탈로그: DEMO_CATALOG (id: "demo")
- 주소 형식 확장: 3파트 \`perm:v1:42\` + 4파트 \`catalogId:perm:v1:42\`
- DkgSqliteStore: catalog_id 컬럼으로 카탈로그별 DKG 격리
- registry-service: POST/GET/PUT/DELETE \`/catalogs\` CRUD

## CLI

- \`qa-sdk --catalog <path>\` — 글로벌 옵션
- 우선순위: --catalog → CWD qa-sdk.config.ts → DEMO_CATALOG
- \`qa-sdk init --from demo\` — 새 카탈로그 프로젝트 스캐폴딩

## 관련

- [[_index]] — 현재 볼트는 DEMO_CATALOG 기준
- [[identity]] — 카탈로그가 유일한 입력이면 나머지는 전부 파생`,
    },
  ];
}

function buildConceptNotes(): SyncNote[] {
  return [
    {
      path: "concepts/coordinate-axis.md",
      content: `---
title: 좌표 축 정의
kind: concept
related: ["[[finite-state]]", "[[observability]]", "[[identity]]"]
---

# 좌표 축 정의 — 무엇을 차원으로 닫는가

비즈니스 도메인에서 **유한하고, 의사결정에 관여하며, 여러 prefix가 공유하는 안정적인 값의 집합**을 축(axis)으로 정의한다.

축에 등록되지 않은 값은 존재하지 않는 것으로 취급된다 (닫힌 세계).

## 5Q Checklist

| 질문 | YES → axis | NO → table_ref |
|------|------------|----------------|
| 유한한가? | 경우의 수가 정해져 있다 | 무제한 증가 |
| 의사결정에 쓰이는가? | 분기/필터/권한 판단 | 단순 데이터 |
| 여러 prefix가 공유하는가? | 2개 이상 prefix에서 사용 | 1개 prefix 전용 |
| 안정적인가? | 변경 빈도 낮음 | 자주 바뀜 |
| capacity 산정 가능한가? | 상한 예측 가능 | 불가 |

## 관련

- [[finite-state]] — 축의 교차가 만드는 유한 상태 공간
- [[observability]] — 축이 정의되면 관측이 가능해진다`,
    },
    {
      path: "concepts/finite-state.md",
      content: `---
title: 유한 상태 정의
kind: concept
related: ["[[coordinate-axis]]", "[[observability]]", "[[identity]]"]
---

# 유한 상태 정의 — 축의 교차가 모든 경우의 수를 만든다

축들을 교차하면 **prefix** — 의사결정의 결과 단위 — 가 된다.

## 차원 압축

\\\`{ role: "admin", action: "write", resource: "dashboard" } → 정수 42\\\`

모든 경우의 수가 정수 하나로 압축된다. 이 정수가 다시 다른 prefix의 차원이 될 수 있다 → 재귀 합성.

## 불변 성질

- **문자열 영구 고정** — 한번 등록된 "admin"은 영원히 "admin"
- **마이그레이션 = decode → re-encode** — 문자열이 고정이므로 항상 자동
- **capacity 내 추가 → shape 불변** — 기존 주소 전부 유효

## 관련

- [[coordinate-axis]] — 축이 유한 상태의 재료
- [[observability]] — 유한 상태는 관측 가능한 상태`,
    },
    {
      path: "concepts/observability.md",
      content: `---
title: 서비스의 관측성 부여
kind: concept
related: ["[[coordinate-axis]]", "[[finite-state]]", "[[signal-model]]", "[[identity]]"]
---

# 서비스의 관측성 부여 — 좌표가 있으면 관측할 수 있다

서비스의 모든 행위에 좌표 주소를 부여하면, 그 행위는 자동으로 관측 가능해진다.

## 7 SignalRole

| Role | prefix | 질문 |
|------|--------|------|
| context | [[service]] | 어디서 |
| trigger | [[tracking]] | 무엇을 |
| channel | [[endpoint]] | 어떤 경로로 |
| state | [[flow_point]] | 흐름의 어디에서 |
| guard | [[permission]] | 어떤 조건으로 |
| effect | [[pipeline_point]] | 어떤 결과가 |
| data | [[order_event]] | 어떤 데이터에 |

## 좌표 부여의 효과

- **bitmask 집합 연산** — 누가 어떤 권한을 가졌는가
- **1D 정수 DB 저장** — BETWEEN 연속 구간 질의
- **DKG 설계 추적** — 왜 이 관측 포인트를 만들었는가
- **자동 수렴 분석** — 미관측 entry, 배포 스큐, 축 중복

## 폐루프

정의(axis/prefix) → 관측(self-check/converge) → 발견(Observation) → 판단(Decision) → 정의 갱신 → ...

## 관련

- [[coordinate-axis]] — 관측의 기반이 되는 축
- [[finite-state]] — 관측 대상인 유한 상태 공간
- [[signal-model]] — 7 SignalRole 상세
- [[observation-loop]] — 런타임 관측 루프`,
    },
  ];
}

function buildSignalNote(): SyncNote {
  const roles = Object.entries(SIGNAL_ROLE_MAP);
  const roleTable = roles
    .map(([prefix, role]) => `| ${role} | [[${prefix}]] |`)
    .join("\n");

  return {
    path: "signal-model.md",
    content: `---
title: Signal Model
kind: signal
source: qa-sdk/packages/viz-3d/src/core/signal-model.ts
---

# Signal Model — 7 SignalRole

Signal = 1회 qaTrack() 호출 = 하나의 의미 있는 순간.

## 7 SignalRole

| Role | prefix |
|------|--------|
${roleTable}

## Signal chain

requires 관계로 의존 표현. 예: trigger는 context를 require.

## 관련

- [[identity]] — 시스템 정체성
- [[_index]] — 전체 인덱스`,
  };
}

function buildIdentityNote(): SyncNote {
  return {
    path: "identity.md",
    content: `---
title: 시스템 정체성
kind: identity
source: qa-sdk/docs/specs/spec-engine/README.md
---

# 시스템 정체성 — 차원 압축 기반 DSL DB

## 정체성

enum, 이벤트 유형, 권한 유형 같은 고정 조합을 전문으로 다루는 시스템. 비즈니스 로직의 경우의 수를 차원 교차로 제어하고, 그 경우의 수의 스펙 메타데이터를 전문적으로 관리한다.

## 핵심 능력: 차원 압축

\`{ role: "admin", action: "write", resource: "dashboard" } → 정수 42\`

정수 42가 다른 prefix의 차원이 된다 → 재귀 합성.

## prefix = 의사결정의 결과 단위

의사결정이 DSL(prefix)을 결정한다. 각 prefix는 "이 차원들의 교차를 추적하기로 결정했다"의 산출물.

## 네 가지 원칙

1. 스펙이 추적되고 의사결정도 추적된다
2. 같은 의미가 수렴하고 타입이 공유된다
3. 이미 있는 것이 닫힌 조합의 숫자가 된다
4. 관측을 유지하여 관측 밖의 상황을 탐색한다

## 계층 구조

\`\`\`
[[convergence-layer]]  수렴 분석
[[dkg-layer]]          설계 지식 그래프
[[spec-engine-layer]]  설계 근거
[[indexing-layer]]     수학/인코딩
\`\`\`

의존 방향: 위 → 아래 (역방향 금지)`,
  };
}

function buildIndexNote(prefixes: string[], domainIds: string[], axes: string[]): SyncNote {
  const byCategory = new Map<string, string[]>();
  for (const id of prefixes) {
    const cat = getPrefix(id)?.meta?.category ?? "entity";
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- .has() 직후 .get()
    byCategory.get(cat)!.push(id);
  }

  const categoryOrder = ["entity", "policy", "relation", "event", "observation"];
  const prefixSections = categoryOrder
    .filter(c => byCategory.has(c))
    .map(cat => {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- .filter(has) → .get() 존재 보장
      const items = byCategory.get(cat)!;
      const links = items.map(id => {
        const p = getPrefix(id);
        if (!p) return `- [[${id}]]`;
        return `- [[${id}]] — ${p.name} (${p.labels.join(" × ")})`;
      }).join("\n");
      return `### ${cat}\n${links}`;
    }).join("\n\n");

  const domainLinks = domainIds.map(id => {
    const d = domains.find(dd => dd.id === id);
    const prefixNames = d?.prefixes?.join(", ") ?? "";
    return `- [[${id}]] — ${d?.name ?? id} (${prefixNames})`;
  }).join("\n");

  return {
    path: "_index.md",
    content: `---
title: qa-sdk 좌표 시스템
kind: index
source: DEMO_CATALOG + DEMO_DKG_CONFIG
---

# qa-sdk 좌표 시스템

> 차원 압축 기반 DSL DB — 비즈니스 로직의 경우의 수를 차원 교차로 제어하고, 그 경우의 수의 설계 메타데이터를 전문적으로 관리한다.

## 시스템 정체성

- [[identity]] — 설계 철학과 핵심 원리

## Axis (${axes.length})

1차원 축. prefix의 차원이 되는 기본 단위.

${axes.map(id => {
      const a = getAxis(id);
      if (!a) return `- [[${id}]]`;
      return `- [[${id}]] — ${a.name}`;
    }).join("\n")}

## Prefix (${prefixes.length})

의사결정의 결과 단위. 각 prefix는 "이 차원들의 교차를 추적하기로 결정했다"의 산출물.

${prefixSections}

## DSL (${dslBundles.length})

prefix를 서비스 단위로 묶은 운용 번들. domain이 구조적 바운더리라면, DSL은 기능적 묶음.

${dslBundles.map(b => `- [[${b.id}]] — ${b.name} (${b.memberPrefixes.join(", ")})`).join("\n")}

## Domain (${domains.length})

prefix 그룹의 바운더리/컨텍스트.

${domainLinks}

## Layer (4)

- [[indexing-layer]] — 수학/인코딩 (encode/decode, stride, shape)
- [[spec-engine-layer]] — 설계 근거 (export surface, schema, spec)
- [[dkg-layer]] — 설계 지식 그래프 (노드 12종, 엣지 18종, 성장 나선)
- [[convergence-layer]] — 수렴 분석 (심볼 비교, 인과 발견, 경계 추천)

## Concepts

- [[coordinate-axis]] — 좌표 축 정의: 무엇을 차원으로 닫는가
- [[finite-state]] — 유한 상태 정의: 축의 교차가 모든 경우의 수를 만든다
- [[observability]] — 서비스의 관측성 부여: 좌표가 있으면 관측할 수 있다

## Architecture

- [[observation-loop]] — 관측 루프 (런타임 → 분석 → DKG → 활성화 게이트)
- [[msa-topology]] — MSA 서비스 토폴로지 (7개 서비스)
- [[catalog-registry]] — 멀티 카탈로그 런타임

## Signal

- [[signal-model]] — 7 SignalRole + prefix 매핑

## 동기화

이 볼트의 원본은 DEMO_CATALOG + DEMO_DKG_CONFIG 입니다.
\`qa-sdk sync-obsidian\` 으로 동기화합니다.`,
  };
}

// ── 메인 ─────────────────────────────────────────────

export interface SyncObsidianOptions {
  vault: string;
  dryRun: boolean;
}

export function syncObsidian(options: SyncObsidianOptions): void {
  const { vault, dryRun } = options;

  console.log(`\n📦 DEMO_CATALOG → Obsidian 볼트 "${vault}" 동기화`);
  console.log(`   mode: ${dryRun ? "dry-run (미리보기)" : "write"}\n`);

  // DKG 부트스트랩 (검증용)
  const graph = bootstrapDkg({ catalog: DEMO_CATALOG, config: DEMO_DKG_CONFIG });
  const axisCount = graph.getNodesByKind("axis").length;
  const prefixCount = graph.getNodesByKind("prefix").length;
  console.log(`   DKG: ${axisCount} axes, ${prefixCount} prefixes\n`);

  // 노트 수집
  const notes: SyncNote[] = [];

  // 0. axis 노트 (카탈로그에서 파생)
  const axisIds = Object.keys(CATALOG.axes);
  for (const id of axisIds) {
    const axis = getAxis(id);
    if (axis) notes.push(buildAxisNote(id, axis));
  }

  // 1. prefix 노트 (카탈로그에서 파생)
  const prefixIds = Object.keys(CATALOG.prefixes);
  for (const id of prefixIds) {
    const prefix = getPrefix(id);
    if (prefix) notes.push(buildPrefixNote(id, prefix));
  }

  // 2. domain 노트 (DKG config에서 파생)
  const domainIds: string[] = [];
  for (const domain of domains) {
    notes.push(buildDomainNote(domain));
    domainIds.push(domain.id);
  }

  // 3. DSL 번들 노트 (DKG config에서 파생)
  for (const bundle of dslBundles) {
    notes.push(buildDslNote(bundle));
  }

  // 4. layer 노트 (정적)
  notes.push(...buildLayerNotes());

  // 4. architecture 노트 (아키텍처 문서에서 파생)
  notes.push(...buildArchitectureNotes());

  // 5. concept 노트 (핵심 개념 정의)
  notes.push(...buildConceptNotes());

  // 6. signal-model 노트
  notes.push(buildSignalNote());

  // 6. identity 노트
  notes.push(buildIdentityNote());

  // 7. 인덱스 노트 (마지막 — axis/prefix/domain 수 반영)
  notes.push(buildIndexNote(prefixIds, domainIds, axisIds));

  // 출력
  if (dryRun) {
    console.log("── 생성할 노트 목록 ──\n");
    for (const note of notes) {
      console.log(`  ${note.path}`);
    }
    console.log(`\n합계: ${notes.length}개 노트`);
    return;
  }

  // 실제 쓰기
  let success = 0;
  let fail = 0;
  for (const note of notes) {
    try {
      obsidianWrite(vault, note.path, note.content);
      console.log(`  ✓ ${note.path}`);
      success++;
    } catch {
      fail++;
    }
  }

  console.log(`\n완료: ${success} 성공, ${fail} 실패 (총 ${notes.length})`);
}
