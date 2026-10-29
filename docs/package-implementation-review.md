---
def:
  id: package-implementation-review
  type: knowledge
  knowledge_kind: guide
  scope: flow
  aspect: process_flow
  depth: validation
  lifecycle: approved
  tags: [entry-point, testing, migration]
  links:
    - target: system-overview
      type: refines
    - target: spec-convention
      type: constrains
    - target: system-packages
      type: refs
    - target: package-surface-separation-rule
      type: refs
    - target: design-usefulness-audit
      type: refs
sources:
  - scripts/package-surfaces.mjs
  - scripts/report-package-surfaces.mjs
  - scripts/analyze-package-usage.ts
  - scripts/design-usefulness-audit.mjs
  - scripts/verify-analysis-os.ts
  - docs/specs/system/system-packages.spec.md
  - docs/specs/system/package-surface-separation.rule.md
  - docs/specs/system/design-usefulness-audit.rule.md
  - docs/specs/system/system-root.md
  - docs/specs/system/system-taxonomy.md
  - docs/specs/system/system-profile.md
  - packages/package-classifier/README.md
---
# QA-SDK 패키지 구현 현황 리뷰

## 목적 ^purpose

패키지별 구현 목표, 코드 표면, 문서 보강 필요 지점을 한곳에 정리해 패키지 단위 리뷰와 후속 문서 작업의 기준선으로 사용한다. 현재 패키지 소유권과 승격/격리 판정의 SSOT는 `system-packages`, `package-surface-separation-rule`, `scripts/package-surfaces.mjs`이며, 이 문서는 과거 보강 스냅샷과 운영자가 어떤 감사 명령으로 다시 판정해야 하는지를 연결하는 리뷰 가이드다.

- 기준일: `2026-04-07`
- 전체 패키지: `86`개 (`foundation 40 / platform 25 / app 9 / service 9 / data 3`)
- 구현 signal: `구현 57 / 부분 4 / 기반 18 / 쉘 7`
- 로컬 문서 surface: `README 77 / specs redirect 11 / 둘 다 없음 0`
- 추가 메모: `package.json description 없음 0`, `코드 패키지인데 패키지 내부 테스트가 없는 패키지 18`

위 수치는 2026-04-07 보강 작업의 역사적 스냅샷이다. 현재 운영 기준에서는 `packages/*` surface-managed 패키지 113개가 `scripts/package-surfaces.mjs`의 22개 surface / 16개 기능군에 모두 배정되어야 하며, `arch:usage`는 `zeroFanIn`, `archiveCandidates`, `deadWeight`, `missingEntrypoints`, `entrypointGaps`를 surface 판정과 함께 분리한다. 이 문서의 상태 라벨은 품질 게이트 verdict가 아니라 당시 `src/test/readme` 표면을 기준으로 한 리뷰 라벨이며, 현재 승격/격리 판단은 `package-surface-separation-rule`과 `design-usefulness-audit`를 따른다.

## 현행 판정 경로 ^validation

패키지 구현 상태를 다시 판정할 때는 이 문서의 오래된 foundation/platform/app 표를 직접 갱신하기보다 아래 순서로 현재 source-backed 표면을 확인한다.

```bash
node scripts/report-package-surfaces.mjs --json
corepack pnpm --silent arch:usage -- --json
node scripts/design-usefulness-audit.mjs --format json --all
corepack pnpm arch:feedback
```

- `report-package-surfaces`: `packages/*` 패키지가 정확히 하나의 surface에 배정됐는지 확인한다.
- `arch:usage`: fan-in, missing entrypoint, archive/dead-weight 후보를 surface verdict와 함께 계산한다.
- `design-usefulness-audit`: 문서와 패키지를 `keep`/`prove` 후보로 나누고, source refs와 실행 증거가 없는 approved 문서를 보강 대상으로 돌린다.
- `arch:feedback`: lint, 계층 경계, API 영향도, 분석 OS self-check를 한 번에 검증한다.

이미 패키지 진입 문서가 있는 축은 기존 surface를 유지한다: `address-index`, `apm`, `bench`, `bit-index`, `browser-codec`, `browser-sdk`, `canvas-viewport`, `cli`, `cli-command`, `codec`, `codec-proto`, `codegen-core`, `config-loader`, `context`, `convergence`, `core`, `data-object-codegen`, `db-traffic-control`, `decision-flow`, `decision-service`, `definition-catalog`, `definition-client`, `definition-data-source`, `definition-service`, `demo-snapshot`, `demo-tests`, `dkg`, `engine`, `event-catalog`, `gateway`, `git-utils`, `index-meta`, `infra-engine`, `ingest-server`, `logger`, `motion-*`, `otel`, `package-classifier`, `permission-engine`, `pino`, `platform-demo`, `quality-ledger`, `query-service`, `registry-client`, `registry-service`, `registry-ui`, `review-ledger`, `rlsc`, `roleplay-web`, `sdk`, `snapshot-io`, `spec-analyzer`, `spec-core`, `spec-schema`, `spec-tracker`, `spec-transition`, `store`, `tag-search`, `test-scenario-store`, `test-types`, `viteplus-sdk-smoke`, `weighted-index`, `weighted-index-explorer`, `weighted-ui`, `viz-web`, `work-domain`.

2026-04-24 분리 반영:
- `infra-env-kit`를 추가했다. env 공급/코드 생성/orchestration을 `infra-engine`에서 분리한 공급 패키지다.
- `infra-engine`는 배포/관측/운영 소비 패키지로 남고, 기존 export/env/codegen 경로는 호환성 re-export wrapper만 유지한다.

2026-04-24 정리 반영:
- `infra-engine` 내부 wrapper 파일(`src/export/*`, `src/config/env-bridge.ts`, `src/post-deploy/codegen.ts`)은 제거했다.
- 공급 기능은 `infra-env-kit` direct import와 `infra-env` CLI로 정착했다.

2026-04-07 1차 반영:
- `infra-engine`, `cli`, `decision-service`, `definition-service`, `query-service`, `registry-service`, `registry-ui`, `platform-demo` README를 중앙 spec 참조형 인덱스로 추가했다.

2026-04-07 2차 반영:
- `address-index`, `canvas-viewport`, `cli-command`, `config-loader`, `package-classifier`, `snapshot-io`, `weighted-index-explorer`, `weighted-ui` README를 추가했다.
- 이 중 `canvas-viewport`, `config-loader`, `package-classifier`, `snapshot-io`, `weighted-index-explorer`, `weighted-ui`는 아직 전용 package spec이 없어, 가장 가까운 central spec을 기준으로 README를 구성했다.

2026-04-07 3차 반영:
- `apm`, `browser-codec`, `browser-sdk`, `codec`, `codec-proto`, `context`, `convergence`, `definition-client`, `logger`, `otel`, `spec-core` README를 추가했다.
- `infra-auth-integration-todo`, `store-adapter-parity` orphan 경고를 부모 문서 링크로 해소했다.

2026-04-07 4차 반영:
- `codegen-core`, `data-object-codegen`, `db-traffic-control`, `decision-flow`, `definition-catalog`, `definition-data-source`, `dkg`, `git-utils`, `permission-engine`, `quality-ledger`, `review-ledger`, `rlsc`, `spec-analyzer`, `spec-schema`, `spec-tracker`, `spec-transition`, `tag-search`, `test-scenario-store`, `test-types`, `work-domain` README를 추가했다.

2026-04-07 5차 반영:
- `decision-flow-store`, `decode-service`, `demo-types`, `docs-explorer`, `e2e`, `facet-tests`, `gate-service`, `pipe-store-sqlite`, `platform-demo-api`, `shop-web`, `simulation-tests`, `viz-3d`, `viz-core`, `weighted-gpu`, `weighted-wasm` README를 추가했다.
- 이제 모든 패키지가 `README` 또는 `specs/README` 진입 surface를 가진다.

2026-04-07 6차 반영:
- `config-loader`, `package-classifier`, `db-traffic-control`, `otel`, `definition-client`, `snapshot-io`, `canvas-viewport`, `weighted-ui`, `e2e`, `facet-tests`, `simulation-tests`, `shop-web`, `viz-3d`, `weighted-index-explorer`, `weighted-gpu`, `weighted-wasm`의 package-level central spec을 추가했다.
- 상위 모듈 문서(`system-support`, `definition-service-system`, `apm-codegen-system`, `browser-system`, `viz-system`, `wi-system`)에 `contains` 링크를 추가해 문서 그래프 편입도 마쳤다.

2026-04-07 7차 반영:
- description이 비어 있던 `49`개 패키지의 `package.json` 메타데이터를 실제 역할 기준으로 보강했다.
- 현재 패키지 description 공백은 `0개`다.

## 1. Foundation 보강 후보

| 패키지 | 구현 목표 | 상태 | 우선 보강 |
|---|---|---|---|
| `address-index` | `address_context` 역색인과 prefix×address 범위 조회 | 구현 | README |
| `canvas-viewport` | 캔버스 pan/zoom/minimap 공통 수학 | 기반 | README+테스트 |
| `cli-command` | zero-dependency CLI 명령 트리와 라우팅 | 기반 | README+테스트 |
| `codegen-core` | catalog/snapshot 기반 TS·Proto 코드 생성 | 구현 | README |
| `config-loader` | catalog/DKG 설정 파일 자동 탐지와 로더 체인 | 기반 | README+테스트 |
| `data-object-codegen` | DataObject typed binding 코드 생성 | 구현 | README |
| `db-traffic-control` | DB 버짓 기반 동시성·QPS 제어 | 구현 | README |
| `decision-flow` | gate/branch/path 기반 의사결정 엔진 | 구현 | README |
| `decision-flow-store` | decision-flow 인스턴스 SQLite 영속 | 기반 | README+테스트 |
| `definition-catalog` | definition taxonomy, graph lint, harness 규칙 | 구현 | README |
| `definition-data-source` | local SQLite와 remote API를 묶는 DefDataSource 팩토리 | 구현 | README |
| `dkg` | Design Knowledge Graph 모델·분석·추적 API | 구현 | README |
| `git-utils` | commit/tag/scope 추출과 모노레포 Git 유틸리티 | 구현 | README |
| `infra-engine` | deploy/discover/export/verify 운영 파이프라인 | 기반 | README+테스트 |
| `package-classifier` | workspace 패키지 tier/runtime/scope 분류 | 기반 | README+테스트 |
| `permission-engine` | 권한 encode/grant/check 엔진 | 구현 | README |
| `pipe-store-sqlite` | meta-semantic PipeStore/ManifestRegistry SQLite 영속 | 구현 | README |
| `quality-ledger` | 품질 게이트 실행 결과 원장 | 구현 | README |
| `review-ledger` | 파일/커밋 기준 리뷰 완료 이력 원장 | 구현 | README |
| `rlsc` | Relative Layout Structured Content 추출·해석 DSL | 구현 | README |
| `snapshot-io` | snapshot JSON 읽기/쓰기/검증 유틸리티 | 기반 | README+테스트 |
| `spec-analyzer` | 스펙 선언과 실제 코드의 정적 정합성 분석 | 구현 | README |
| `spec-schema` | schema 카테고리·검증·preset 시스템 | 구현 | README |
| `spec-tracker` | 런타임/테스트 증거를 스펙 claim에 연결 | 구현 | README |
| `spec-transition` | 좌표 기반 Transition Spec DSL 엔진 | 구현 | README |
| `tag-search` | 태그 기반 역색인 검색 | 구현 | README |
| `test-scenario-store` | 테스트 시나리오 저장소와 Drizzle 영속 | 구현 | README |
| `test-types` | TestPhase/Kind/Scope/Lifecycle SSOT | 기반 | README+테스트 |
| `weighted-gpu` (2026-10-29 삭제) | weighted-index 가속용 GPU 실험 surface | 구현 | README+실행예 |
| `weighted-index-explorer` | weighted-index 디버그/탐색 UI | 기반 | README+smoke |
| `weighted-ui` | weighted-index 계열 앱용 공통 UI/token | 기반 | README+테스트 |
| `weighted-wasm` | weighted-index WASM 빌드/브리지 surface | 쉘 | README+소스경계 |
| `work-domain` | 작업 유형 분류와 품질 게이트 매핑 | 구현 | README |

## 2. Platform 보강 후보

| 패키지 | 구현 목표 | 상태 | 우선 보강 |
|---|---|---|---|
| `apm` | address context와 metric record를 묶는 APM 보조층 | 구현 | README |
| `browser-codec` | 브라우저용 address_context encode/decode SSOT | 구현 | README |
| `browser-sdk` | 브라우저 auto-capture, session, flush SDK | 구현 | README |
| `cli` | `qa-sdk` 운영 명령 진입점과 workflow orchestration | 구현 | README |
| `codec` | SDK payload/dim wire codec 보조 유틸리티 | 기반 | README+설명 |
| `codec-proto` | protobuf 전송 codec과 transport bridge | 기반 | README+테스트 |
| `context` | QA context 생성과 catalog provider 조립 | 기반 | README+설명 |
| `convergence` | usage snapshot 기반 구조 수렴 분석 엔진 | 구현 | README |
| `definition-client` | definition-service HTTP client | 구현 | README |
| `docs-explorer` | definition-catalog 기반 문서 탐색 웹 UI | 쉘 | README+실행경로 |
| `e2e` | Playwright 기반 cross-app E2E 실행 패키지 | 쉘 | README+시나리오 인덱스 |
| `facet-tests` | 패싯 분리 회귀 테스트 묶음 | 쉘 | README+패싯 목록 |
| `logger` | 서비스/라이브러리 공통 로거 surface | 구현 | README |
| `otel` | OpenTelemetry bridge와 변환 유틸리티 | 구현 | README |
| `spec-core` | spec propagation, DKG bridge, convergence 핵심 레이어 | 구현 | README |
| `simulation-tests` | 시뮬레이션 기반 검증 시나리오 묶음 | 쉘 | README+대상 패키지 |

## 3. Service·App 보강 후보

| 패키지 | 구현 목표 | 상태 | 우선 보강 |
|---|---|---|---|
| `decision-service` | decision-flow 인스턴스/이력 API 서비스 | 기반 | README+smoke |
| `decode-service` | DecodeMap 기반 독립 decode API | 부분 | README+테스트 |
| `definition-service` | 문서 sync/search/graph/intent API 서비스 | 부분 | README+테스트 |
| `demo-types` | demo catalog 파생 타입·SDK 팩토리 | 구현 | README |
| `gate-service` | 주소 상태 게이트·cascade recompute 서비스 | 구현 | README |
| `platform-demo` | monitor/diagram/debugger를 묶는 데모 앱 | 기반 | README+테스트 |
| `platform-demo-api` | platform-demo 보조 API/edge surface | 기반 | README+smoke |
| `query-service` | 정책 해소·gate 통합 질의 서비스 | 부분 | README+테스트 |
| `registry-service` | catalog/prefix/service/event/workspace registry API | 구현 | README |
| `registry-ui` | registry 관리용 웹 UI | 기반 | README+smoke |
| `shop-web` | 커머스 시나리오 데모 앱 | 쉘 | README+앱경로 |
| `viz-3d` | 3D 모니터링과 좌표 시각화 앱 | 구현 | README |
| `viz-core` | 시각화 primitive, token, renderer 코어 | 구현 | README |

## 4. ECS 역할 매핑

ECS(Entity-Component-System)는 이 시스템의 구조를 설명하는 **참조 모델**이다. ECS 전용 runtime, scheduling, archetype, SoA storage를 전제하지 않는다. 대신 세 분리 원칙으로 패키지 역할의 경계를 정한다.

| 역할 | 정의 | 대응 |
|------|------|------|
| **Entity** | 안정 식별자를 가진 도메인 객체 | 불변 ID가 있는 타입/모델 SSOT |
| **Component** | Entity에 붙는 data-only 구조 | 숨은 실행 로직 없는 순수 데이터 |
| **System** | Component를 읽어 변환·판정·전파하는 명시적 로직 | 서비스, 엔진, CLI, SDK |

### 4.1 Entity — 안정 식별자 + 도메인 모델

| 패키지 | 소유 Entity 타입 | 택소노미 (enum/union) |
|--------|-----------------|---------------------|
| `@qa-sdk/core` | `EventRecord` (logId), `TransmissionEnvelope` (transmissionId), `ScenarioSpec` (scenarioId), `VerdictReport`, `SpecGraph`, `RuntimeGraph`, `QaSession` | `RecordKind`, `Verdict`, `StepKind`, `PayloadFormat` |
| `spec-schema` | `SchemaAxis`, `SchemaDef`, `SchemaFragment` | `SchemaCategory` (6종) |
| `test-types` | `TestCase`, `TestSuite` | `TestPhase`, `TestKind`, `TestScope`, `TestLifecycle` |
| `demo-types` | 카탈로그 파생 prefix/axis 타입 | SSOT: `demo-snapshot` |
| `definition-catalog` | `DefDocument` (address), `DefLink` | `DefLevel` (group/module/leaf), `DefLayer` (domain/operation/mediation/experience), `LinkType` (6종), `DefScope` |

### 4.2 Component — 데이터 변환 / 순수 계산

이 계층의 패키지는 Entity를 받아 계산하거나 새 데이터 구조를 생성한다. 서비스나 외부 I/O를 직접 소유하지 않는다.

| 패키지 | 변환 대상 | 산출 데이터 |
|--------|----------|-----------|
| `weighted-index` | dim 값 배열 | mixed-radix 1D 정수 (`Coord`, `Strides`, `Shape`) |
| `bit-index` | Coord | bit-packing 추출 (O(1)) |
| `address-index` | prefix×address | 역색인 범위 조회 |
| `permission-engine` | RBAC role/action/resource | bitmask encode/grant/check |
| `@qa-sdk/codec` | dim 값 | DimWire 직렬화/역직렬화 |
| `@qa-sdk/engine` | `EventRecord[]` + `ScenarioSpec` | `RuntimeGraph`, `StepMatch[]`, `VerdictReport` |
| `convergence` | usage snapshot | 구조 수렴 분석 리포트 |
| `spec-core` | `SpecDocument`, `PrefixSpec` | DKG bridge, codegen, propagation |
| `codegen-core` | `Catalog` snapshot | TypeScript/Proto 코드 |
| `decision-flow` | `FlowSchema`, gate/branch | `FlowInstance`, path trace |

### 4.3 System — 비즈니스 로직 + 외부 인터페이스

System은 Component 계산 결과를 영속하거나 외부와 통신한다. 원본 Entity 상태를 암묵적으로 소유하지 않는다.

**인프라 서비스**

| 패키지 | 포트 | 소유 데이터 | 저장소 |
|--------|------|-----------|-------|
| `@qa-sdk/ingest-server` | 3200 | `EventRecord`, `Trace`, `VerdictReport`, `DLQ` | PostgreSQL + Redis |
| `@qa-sdk/registry-service` | 3300 | `Catalog`, `Prefix`, `Version`, `ServiceEntry` | SQLite/Mem |
| `gate-service` | 3400 | `AddressState` (reserved/inactive/open) | SQLite |
| `query-service` | 3500 | `PolicyRule` 질의 결과 | SQLite |
| `@qa-sdk/decode-service` | 3600 | `DecodeMap` 캐시 | In-memory TTL |
| `definition-service` | 3700 | `DefDocument` 메타데이터 | SQLite |
| `decision-service` | 3800 | `FlowInstance` 이력 | SQLite |

**SDK / 클라이언트**

| 패키지 | 대상 | System 역할 |
|--------|------|------------|
| `@qa-sdk/sdk` | Node.js 서버 | `qa.track()` → `TransmissionEnvelope` 생성 + ingest 전송 |
| `@qa-sdk/browser-sdk` | 브라우저 | `QaMonitor` auto-capture + session 관리 |
| `@qa-sdk/browser-codec` | 브라우저 | 브라우저 전용 address encode/decode (core 미의존) |
| `@qa-sdk/registry-client` | 서버 내부 | registry-service HTTP client |
| `definition-client` | CLI/서비스 | definition-service HTTP client |

**운영 도구**

| 패키지 | System 역할 |
|--------|------------|
| `@qa-sdk/cli` | `def validate`, `docs status`, `docs graph`, `docs drift`, `docs label inventory`, `dkg self-check`, `encode`/`decode`, `flow start/select` |
| `infra-engine` | 멀티 프로바이더 배포/디스커버리/익스포트 |
| `@qa-sdk/otel` | OpenTelemetry 초기화 + Drizzle 계측 |
| `@qa-sdk/gateway` | 인증 + 내부 서비스 라우팅 |

### 4.4 Taxonomy — 시스템 공용 분류 어휘

아래 enum/union은 Entity·Component·System 전반에서 공유된다. 새 분류가 필요할 때는 소유 패키지를 확인하고 확장한다.

| 분류 이름 | 소유 패키지 | 값 (요약) |
|---------|-----------|---------|
| `RecordKind` | `@qa-sdk/core` | `"log"` \| `"span"` \| `"metric"` |
| `Verdict` | `@qa-sdk/core` | `"pass"` \| `"fail"` \| `"warn"` \| `"degraded"` \| `"unknown"` \| `"skipped"` |
| `DefLayer` | `definition-catalog` | `"domain"` \| `"operation"` \| `"mediation"` \| `"experience"` |
| `DefLevel` | `definition-catalog` | `"group"` \| `"module"` \| `"leaf"` |
| `LinkType` | `definition-catalog` | `"contains"` \| `"depends_on"` \| `"implements"` \| `"refines"` \| `"constrains"` \| `"traces_to"` |
| `SemanticCoordinateLabelKind` | `@qa-sdk/cli` (docs-control-plane) | `"definition-doc"` \| `"source-file"` \| `"ontology-pack"` \| `"artifact"` \| `"prd-markdown"` \| `"ralph-prd-json"` \| `"prd-story"` \| `"evidence"` |
| `DeterministicLabelRecordState` | `@qa-sdk/cli` (docs-control-plane) | `"DRAFT"` \| `"LINTED"` \| `"RESOLVED"` \| `"ACTIVE"` \| `"DEPRECATED"` \| `"ARCHIVED"` \| `"BLOCKED"` |
| `TestPhase` | `test-types` | `"unit"` \| `"integration"` \| `"e2e"` \| `"simulation"` \| `"bench"` |
| `StoreDriver` | `@qa-sdk/ingest-server` | `"memory"` \| `"pg"` \| `"d1"` \| `"clickhouse"` |
| `DeterministicLabelReadinessGate` | `@qa-sdk/cli` | `"lint"` \| `"resolve"` \| `"activate"` |

---

## 5. 이번 리뷰의 결론

- 패키지 구현 자체는 넓게 진행돼 있지만, 패키지 단위 목표를 빠르게 읽는 문서 surface는 약하다.
- 특히 `service/app` 계열의 `README` 공백이 커서 구현 목표와 실행 진입점이 코드 안에만 숨어 있다.
- 1차로 service/app 핵심 surface README는 반영했다.
- 다음 보강 우선순위는 package-level spec 신규 생성보다, 기존 spec 공백이 남은 consumer/demo 패키지(`docs-explorer`, `platform-demo-api`, `viz-core`)의 세부 멤버 문서 분해와, README 내부의 오래된 깨진 링크(index-meta, motion-content 계열)를 정리하는 것이다.
