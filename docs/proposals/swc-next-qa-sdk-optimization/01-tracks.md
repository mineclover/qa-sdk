---
def:
  id: swc-next-qa-sdk-optimization-01-tracks
  type: knowledge
  knowledge_kind: proposal
  lifecycle: draft
  owner_system: apm-system
  projection_plane: intent
  scope: meta
  aspect: proposal_design
  tier: system
  depth: specification
  links:
    - target: swc-next-qa-sdk-optimization-readme
      type: depends_on
status: draft
date: 2026-10-28
part_of: swc-next-qa-sdk-optimization
role: tracks
---

# 작업 트랙 경계와 병렬 실행 규칙

## 목적 ^purpose

트랙마다 **배타적 쓰기 파일 집합**과 **소비·제공 인터페이스**를 고정해, 여러 세션이 동시에 작업해도 같은 파일을 두 곳에서 고치지 않게 한다.

## 1. 병렬 실행 규칙 ^defines

1. 트랙은 자기 소유 파일만 수정한다. 소유하지 않은 파일이 필요하면 소유 트랙에 요청하거나, 소유 트랙 머지 후 착수한다.
2. 공유 barrel(`packages/core/src/index.ts`, `packages/core/src/catalog/index.ts`)은 T0 머지 전에는 **T0만** 수정한다. 머지 후에는 각 트랙이 자기 export 줄을 **추가만** 할 수 있다(기존 줄 수정·재배치 금지). 충돌은 rebase로 해소한다.
3. 트랙별 브랜치는 `feat/swc-next-<track>-<slug>`이고 worktree에서 작업한다. 작업 트리에는 다른 에이전트의 미커밋 변경이 있으므로 `git restore`/`reset`/`clean`을 쓰지 않는다.
4. `dist/` export를 가진 패키지를 고치면 그 패키지를 rebuild한 뒤 소비자 테스트를 돌린다.
5. 각 트랙 PR은 `def validate` 경고 0을 유지한다.
6. 다른 트랙이 제공할 인터페이스가 아직 없으면 그 인터페이스를 임시로 복제하지 않는다. 의존 Task를 미루고 독립 Task부터 진행한다.

## 2. 트랙 요약

| 트랙 | 착수 조건 | 산출물 | 계획 |
|---|---|---|---|
| T0 계약 기반 | 즉시 | `CatalogSnapshot`/`PrefixLayout` 타입, `canonicalJson`, `computeCatalogDigest`, `buildCatalogSnapshot`, `classifyLayoutChange`, `resolveDecodeLayout`, `CodecContractError` 9종 | [plans/T0-contract-foundation.md](./plans/T0-contract-foundation.md) |
| A Codec 호환성 | T0 ✅ + D-1·D-8 확정 | 3-way parity 테스트, legacy-v1 golden corpus, DecodeMap shape 정합, strict 파서 | [plans/A-codec-compatibility.md](./plans/A-codec-compatibility.md) |
| B Envelope binding | T0 머지 + D-2 | envelope `catalog_snapshot` 필드, ingest 검증, registry snapshot manifest, readiness | [plans/B-envelope-snapshot-binding.md](./plans/B-envelope-snapshot-binding.md) |
| C Baseline benchmark | 즉시 | codec microbench, 결과 JSON 스키마, benchmark workflow | [plans/C-baseline-benchmark.md](./plans/C-baseline-benchmark.md) |
| D Codegen 결정론 | T0 머지 (Task 1은 즉시) | timestamp 제거, digest 헤더, generator version, browser catalog 생성기 통합, drift CI | [plans/D-codegen-determinism.md](./plans/D-codegen-determinism.md) |
| E Ingest 정리 | 즉시 + D-3/D-4/D-5 | dead code 제거, 배선 정리, queue/inline 동등성, metric 공백 보완 | [plans/E-ingest-pipeline-hygiene.md](./plans/E-ingest-pipeline-hygiene.md) |
| F 분석 결정론 | 즉시 | clock 주입, observation provenance 필드, 타입 사본 drift 테스트 | [plans/F-analysis-determinism.md](./plans/F-analysis-determinism.md) |

## 3. 파일 소유권 매트릭스

같은 경로가 두 트랙에 나타나지 않게 나눴다. 신규 파일은 `(신규)`로 표기한다.

| 트랙 | 배타적 쓰기 범위 |
|---|---|
| T0 | `packages/core/src/catalog/snapshot/**` (신규), `packages/core/src/catalog/index.ts`, `packages/core/src/index.ts`, `docs/architecture-decisions.md` (ADR-010 추가) |
| A | T0 머지 후 `packages/core/src/catalog/snapshot/**` 인계, `packages/core/src/catalog/catalog.types.ts` (D-8), `packages/core/src/catalog/runtime.ts` (+`runtime-boundary.test.ts`), `packages/demo-snapshot/src/demo-catalog.ts` (R-11 v1 labels), `packages/demo-tests/package.json`, `packages/core/src/lib/address-parser.ts`, `packages/core/src/coordinates/address-context-schema.ts`, `packages/browser-codec/src/browser-codec.ts`, `packages/browser-codec/src/smoke.test.ts`, `packages/registry-service/src/modules/catalog/decode-map.service.ts` (+test), `packages/decode-service/src/**`, `packages/index-meta/src/meta-codec.ts`, `packages/context/src/catalog-provider.ts`, `packages/dkg/src/resolve.ts`, `packages/demo-tests/src/codec-compat/**` (신규), `fixtures/coordinate-compatibility/**` (신규), `docs/specs/system/coordinate-storage.rule.md` |
| B | `packages/core/src/types/envelope.ts`, `packages/core/src/schema/envelope.schema.ts`, `packages/logger/src/logger.ts`, `packages/logger/src/config.ts`, `packages/browser-sdk/src/monitor.ts`, `packages/codec-proto/**`, `proto/transmission.proto`, `packages/ingest-server/src/routes/ingest.ts`, `packages/ingest-server/src/routes/health.ts`, `packages/ingest-server/src/lib/snapshot-gate.ts` (신규), `packages/ingest-server/src/lib/__fixtures__/**` (신규), `packages/registry-service/src/stores/catalog-store.ts`, `packages/registry-service/src/stores/catalog-snapshot-store.ts` (신규), `packages/registry-service/src/stores/__fixtures__/**` (신규), `packages/registry-service/src/health.controller.ts`, `packages/registry-service/src/modules/catalog/catalog.controller.ts` |
| C | `packages/bench/**`, `benchmarks/**`, `.github/workflows/bench.yml` (신규) |
| D | `packages/codegen-core/**`, `packages/cli/src/commands/codegen.ts`, `packages/core/src/catalog/browser-flatten.ts`, `packages/viz-3d/scripts/generate-browser-catalog.ts`, `packages/viz-3d/package.json`, `packages/browser-codec/src/demo-catalog-browser.ts` (생성물), `packages/demo-types/src/**` (생성물), `scripts/catalog-codegen-drift.mjs` (신규), `.github/workflows/codegen-drift.yml` (신규) |
| E | `packages/ingest-server/src/server.ts`, `packages/ingest-server/src/stores/store-factory.ts`, `packages/ingest-server/src/lib/phase-two-worker.ts`, `packages/ingest-server/src/lib/convergence-pipeline.ts`, `packages/ingest-server/src/lib/convergence-scheduler.ts`, `packages/ingest-server/src/lib/metrics-collector.ts`, `packages/ingest-server/src/routes/metrics.ts`, `packages/ingest-server/src/config/env.ts`, `packages/ingest-server/src/db/**`, `packages/ingest-server/src/stores/*-schema.sql.ts`, `packages/ingest-server/drizzle/**` |
| F | `packages/convergence/**`, `packages/dkg/src/dkg.types.ts`, `packages/dkg-store/src/**`, `packages/dkg-store/src/db/**`, `packages/dkg/src/skills/**`, `packages/dkg-enrichment/**` |

### 3.1 경계에서 조율이 필요한 지점

| 지점 | 소유 | 조율 방법 |
|---|---|---|
| ingest-server `routes/ingest.ts` decode 실패 counter | B (라우트) / E (collector) | E가 `metrics-collector.ts`에 `increment(name, labels)`를 먼저 제공하고, B는 호출만 추가 |
| `BrowserCatalog` 타입 3벌 통합 | D (core `browser-flatten.ts`) / A (`browser-codec.ts`) | D가 core 타입을 정본으로 확정·머지 → A가 browser-codec에서 import로 교체 |
| convergence API에 `now` 주입 | F (convergence) / E (`convergence-pipeline.ts`) | F는 optional 인자로 추가해 하위 호환 유지. E는 F 머지 후 주입 |
| registry `catalogHash` → digest | B (`health.controller.ts`) / D (SDK 쪽 `GENERATION`) | 둘 다 T0 `computeCatalogDigest`만 호출. 비교 로직(`context/src/qa-context.ts`)은 B 후속 Task에서 A와 합의 후 수정 |
| `packages/core/src/catalog/runtime.ts` 오류 타입 교체 | A | T0는 runtime.ts를 수정하지 않는다. A가 `CodecContractError`로 전환 |
| `IngestDeps` 필드 추가 (`routes/ingest.ts`) | B (파일) / E (transition·post-verdict deps) | E Task 3이 필요한 필드만 additive로 추가하고 B PR과 머지 순서를 맞춘다. 같은 주에 둘이 겹치면 E가 먼저 |
| ingest-server `config/env.ts` | E (파일) / B (키 2개) | B는 `SNAPSHOT_GATE_MODE`, `SNAPSHOT_REGISTRY_URL`만 additive로 추가 |
| core snapshot fixture | A (T0 인계 후) / D (`browser-flatten.test.ts`에서 import만) | D는 fixture를 수정하지 않는다 |

## 4. 인터페이스 계약 (트랙 간)

T0가 제공하고 A·B·D가 소비한다. 정확한 시그니처는 [T0 계획](./plans/T0-contract-foundation.md) "Interfaces"가 정본이다.

```ts
// @qa-sdk/core — T0 제공
type CodecVersion = 'legacy-v1';
interface CatalogSnapshotRef { catalogId: string; snapshotVersion: number; digest: string; codecVersion: CodecVersion }
interface CatalogSnapshot extends CatalogSnapshotRef { schemaVersion: 1; digestAlgorithm: 'sha256-jcs'; parentDigest: string | null; layouts: Record<string, PrefixLayout> }
function canonicalJson(value: unknown): string;
function computeCatalogDigest(catalog: Catalog): Promise<string>;           // 'sha256:<64 hex>'
function buildCatalogSnapshot(catalog: Catalog, opts: BuildCatalogSnapshotOptions): Promise<CatalogSnapshotBuildResult>; // { snapshot, issues }
function classifyLayoutChange(prev: PrefixLayout, next: PrefixLayout): LayoutChange;
function findUnversionedBreakingChanges(prev: CatalogSnapshot, next: CatalogSnapshot): UnversionedBreakingChange[];
type SnapshotIdentity = Pick<CatalogSnapshotRef, 'catalogId' | 'digest' | 'codecVersion'>; // 판정 입력 — snapshotVersion은 표시용
function resolveDecodeLayout(request: { ref: SnapshotIdentity; prefixId: string; version: string }, target: CatalogSnapshot, lookup: SnapshotLookup): PrefixLayout;
function assertAddressInLayout(layout: PrefixLayout, address: number | bigint): void;
class CodecContractError extends Error { code: CodecErrorCode; details: Readonly<Record<string, unknown>> }
```

C는 T0를 소비하지 않는다. C의 결과 JSON에는 `catalogDigest` 필드를 두되, T0 머지 전에는 `null`을 기록한다.

## 5. 머지 순서

```text
T0 ─┬─► A ──┐
    ├─► B ──┼─► (G2 착수 판정)
    └─► D ──┘
C  ───────────► (G2 착수 판정: baseline 결과 필요)
E ─┐
F ─┴──────────► (G3 착수 판정)
```

A와 B는 서로의 파일을 수정하지 않으므로 순서 제약이 없다. 단, B의 ingest 검증 Task(`snapshot-gate.ts`)는 A의 golden corpus를 테스트 입력으로 쓰면 더 강해지므로, A Task 3 머지 후 B Task 5에 corpus 기반 테스트를 추가한다(선택).
