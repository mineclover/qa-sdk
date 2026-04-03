# QA-SDK Monorepo

> 규칙과 제약만 기술한다. 아키텍처/설계 상세는 `docs/` 참조.

## 참조 문서

| 문서 | 내용 |
|------|------|
| `docs/system-overview.md` | 시스템 개요, 패키지 구조, DKG, 수집 파이프라인 |
| `docs/CONVENTIONS.md` | 용어집, DimRef 3종, ColumnRef, 좌표 컨벤션, env var 테이블 |
| `docs/getting-started.md` | 산출물 단위, codegen, CLI 사용법 |
| `docs/architecture-decisions.md` | ADR-001~009 |
| `docs/msa-architecture.md` | 서비스 토폴로지, 패턴 분류, 전이 엔진 |
| `docs/data-model.md` | 데이터 모델, 테이블 스키마 |
| `docs/specs/` | 모듈/서비스별 상세 스펙 — 진입점: `docs/specs/README.md` |
| `docs/skills/` | 운영 플레이북 + DKG skill 사용 가이드 — 진입점: `docs/skills/README.md` |
| `docs/definition-system-philosophy.md` | Definition 시스템 철학 — 좌표 기반 문서화 원리 |
| `docs/specs/decision-flow/df-system.md` | decision-flow 시스템 (16멤버, P0~P11) |
| `docs/specs/system/tag-management.spec.md` | 태그 관리 설계 — 저장/조회/전파/충돌/카디널리티 |
| `docs/specs/system/decision-definition-bridge.spec.md` | Decision↔Definition 순환 구조 |
| `docs/guides/testing-patterns.md` | 테스트 SSOT 파생 코드 예시 (8패턴) |
| `docs/guides/scope-classification-guide.md` | scope 7종 판별 + aspect 선택 기준 |
| `tasks/prd-drizzle-standardization-remaining.md` | Drizzle 표준화 잔여 작업 PRD (7 US) |

## 패키지 규칙

- 새 라이브러리 → unscoped name + tsup dual format (ESM + CJS)
- 새 서비스/앱 → `@qa-sdk/*` scope + tsc ESM only (cli는 tsup + shebang)
- 의존 방향: QA 플랫폼 → 인코딩 라이브러리만 허용 (역방향 금지)
- 인코딩 의존 체인: `weighted-index → bit-index → permission-engine`
- 플랫폼 의존 체인: `@qa-sdk/core → logger → codec → context → sdk`

## 빌드

- `pnpm --filter <pkg> build` — 개별 빌드
- TypeScript target: **ES2023** 전체 통일 (루트 + 32개 패키지)
- weighted-index DTS 빌드에 기존 에러 있음 (calc.js exports); ESM/CJS는 정상
- platform-demo: `pnpm --filter platform-demo exec vite build --mode development`
- **CLI tsup 번들 제약**: CLI는 tsup 단일 번들 (`dist/index.js`). 내부 `import("./other.js")` 동적 import 불가 — 정적 import 또는 re-export 사용
- **async createRuntimeStores**: ingest-server의 `createRuntimeStores`는 async (D1 stores 동적 import). 호출부에 `await` 필수

## Skills 관리

- **SSOT**: `skills/` 디렉토리가 skill 정의의 유일한 원본
- **실행 위치**: `~/.claude/skills/`, `~/.codex/skills/`
- **동기화**: `./scripts/sync-skills.sh` — repo → home 단방향 전파
- skill 수정은 항상 `skills/<name>/SKILL.md`에서 하고, `sync-skills.sh`로 전파
- `~/.claude/skills/`, `~/.codex/skills/`를 직접 수정하면 다음 sync에서 덮어쓰기됨
- home 쪽에만 있는 skill(다른 프로젝트용)은 건드리지 않음

## SSOT 원칙

- **Catalog이 유일한 입력** — 나머지(codegen, DKG, DecodeMap, 브라우저 카탈로그)는 전부 파생
- `demo-snapshot`은 참조 구현. 인프라가 아님
- `DEMO_CATALOG` — 축/prefix/table 수는 하드코딩 금지, `Object.keys()` 등으로 동적 파생
- `demo-types`는 codegen 자동 생성. 직접 수정 금지
- `BROWSER_CATALOG`는 자동 생성. 직접 수정 금지
- 인라인 encode 코드 금지 — `import { track } from '@qa-sdk/browser-codec'`
- 데이터 상수는 demo-snapshot SSOT에서 import. 하드코딩/복사 금지

### SSOT 파생 체인

```
DEMO_CATALOG (demo-snapshot)
  ├── codegen → demo-types (TS 타입 자동 생성)
  ├── bootstrapDkg → DKG graph (노드 + 엣지)
  │     ├── listAllDiagrams → 다이어그램 목록 (registry-service /api/diagrams)
  │     ├── collectMetrics → 메트릭 (registry-service /api/dashboard/metrics)
  │     └── service-skills → 관측 자동 생성
  ├── BROWSER_CATALOG → shop-web viz-3d-core.js
  ├── registry seed → D1 서비스/엔드포인트/이벤트스키마
  └── tests → DEMO_CATALOG에서 파생하여 검증 (카운트 하드코딩 금지)
```

### 관측 체계 3단계

```
IntentLink (수동)     "이 prefix들이 함께 있어야 한다" (공출현, 순서 없음)
     ↑ 발견                    ↓ 위반: traceFlows()
Auto IL (데이터)      "실제로 이렇게 쓰인다" (session 공출현, Jaccard ≥ 0.5)
     ↓ gap = 인사이트
ScenarioSpec (설계)   "이 순서로 진행되어야 한다" (step 기반, verdict 계산)
```

- Auto IL → ScenarioSpec 직접 승격 금지 (실 사용 ≠ 최적 경로)
- 세션 단위 그룹핑: `qa_session_id` (trace는 전송 단위, session이 행동 단위)
- 상세: `docs/specs/analysis-system/`

### 서비스 단위 소유권 (ownedPrefixes)

- ownedPrefixes = 이 서비스가 **실제로 이벤트를 생산하는** prefix만
- 저장/조회/캐시만 하는 서비스는 ownedPrefixes: [] (읽기 전용)
- 라이브러리(SDK, codec)는 서비스가 아님 — ownedPrefixes 선언 없음. 사용하는 서비스가 소유
- 같은 prefix를 두 서비스가 동시에 소유하면 안 됨 (생산자 단일 책임)
- 미구현 prefix는 ownedPrefixes에서 제거하고 TODO 주석으로 표시
- `GET /v1/insights/service-prefixes` — 서비스별 실제 prefix 사용 현황
- 정의(`ownedPrefixes`)와 실제 사용(`insights`)의 gap이 관측 피드백의 기반

### Table 식별자 충돌 전략

- 카탈로그 원본 table ID는 변경하지 않는다 (`entry`, `orders` 유지)
- 외부 도구(Mermaid, SQL, TypeScript)의 예약어 충돌은 **schema-builder의 dialect가 흡수**
- 현재 임시: `mermaid-gen.ts` `safeId()`에서 `tbl_` 접두사 (schema-builder 구현 시 이관)
- 설계 상세: `docs/plan/schema-builder/purpose.md` §5

## 소스 위치 규칙

- `weighted-index/src/index.ts` — 모든 public export 관리. 새 함수 추가 시 여기도 갱신
- `@qa-sdk/core/catalog/runtime.ts` — canonical runtime 함수 (encodePrefix, decodePrefix 등). demo-accessors는 re-export
- 의존: demo-catalog → demo-compat → demo-snapshot/demo-domains (순환 금지)
- **Skills**: `docs/skills/` 가 소스 (git tracked). `.claude/skills/`는 배포 위치 (gitignore). `pnpm sync:skills`로 동기화. 새 skill 생성/수정 시 `docs/skills/`에 작성

## 설계 원칙

- spec-core는 라이브러리 — ingest-server/registry-service에 정적 의존 없음
- 서비스는 동적 import (`ENABLED=true`일 때만) + optional peer dependency
- 에러 격리: convergence 실패가 Phase 2 verdict/활성화를 절대 차단하지 않음
- Fail-open: gate check 실패 → 허용 + warning diagnostic
- ServiceBootConfig이 서비스 정체성의 단일 진입점. 모든 SDK 레이어가 여기서 파생

## Permission Engine 규칙

- 클라이언트는 role을 직접 확인하지 않음 — 서버가 role → flat permission mask로 resolve
- resource: 소문자, `/` 구분, leading/trailing slash 금지, depth ≤ 4, `:param` 허용
- permission code: `{service-ref}.{type}.{resource}.{action}`
- 인코딩 선택: DB+범위 → WeightedIndex, 인메모리 필터 → BitIndex, 양쪽 → IndexBridge
- Domain Role deny 레이어: grant와 대칭 — `denyRoles`(role 단위 제거), `denyFeatures`(feature 단위 제거)
- resolution: parents OR 합산 + ownFeatures → denyRoles resolved + denyFeatures 차감 → final
- deny는 해당 role의 resolved에만 영향, 부모/자식에 전파 안 됨

## PolicyRule 인터페이스

- **공개 API**: `PolicyRule<T> { match: MatchSpec, value: T }` — entity name + 명시적 와일드카드(`"*"`)
- **내부 전용**: `PatternRule<T> { pattern: CoordConstraint[] }` — position 기반
- 모든 dim 명시 필수. dim 누락 → ValidationError (암묵적 와일드카드 금지)
- `resolvePolicy(codec, entities, rules, strategy)` — 공개 함수
- `resolvePatternPolicy(coord, rules, shape, strategy)` — 내부 함수

## getPrefixProfile API

- `getPrefixProfile(catalog, prefixId, version?)` → `PrefixDimProfile`
- 각 dim: `DimCapacityInfo { entries, capacity, headroom, stride }`
- prefix_ref: refEntries 있으면 values.length, 없으면 `undefined` (CON-006: 미완성 상태)
- `safePrecision`: totalSpace ≤ MAX_SAFE_INTEGER이면 true (CON-007)
- 타입명: `PrefixDimProfile` / `DimCapacityInfo` (spec-core `PrefixProfile`과 별개)

## GateEngine 4-state 모델

- `active`(encode✓ decode✓) / `inactive`(encode✗ decode✓) / `open`(encode✓ decode✗) / `reserved`(encode✗ decode✗)
- composite AND 규칙: 어느 dim이라도 차단 → composite도 차단
- `inactive ∩ open → reserved` 자동 승격
- CON-006: prefix_ref refEntries 미정의 → unfilled positions = reserved
- deactivation 모드: strict(release 시만 recompute) / flexible(setFlag 시도 recompute)
- gate-service = 읽기 전용 캐시. GateEngine 인스턴스 없음
- query-service = gate-service HTTP 클라이언트로 gate 상태 소비

## convergence-pipeline 타입 규칙

- `ConvergenceFunctions`: `Catalog`, `UsageData`, `MetricValue[]`, `ObservationNode[]` 사용. `unknown` 금지
- `OBS-PATTERN`: DKG ObservationNode 스키마 준수 (`subjects[]`, `finding`, `intent`)
- `GraphPort` vs `ConvergenceGraphPort`: 서비스는 최소 포트, CLI는 GraphRegistry(최대)
- `as unknown as ConcreteType`: 동적 import 구조적 캐스트. `as any` 금지

## Axis 원칙

**Axis = 비즈니스 로직에서 사용하는 정보의 유한 분류. 소비 방식은 소비자가 결정한다.**

- Axis는 정보의 **정의**. 소비 방식은 소비자의 **책임**
- 소비 방식은 고정이 아님 — 비즈니스 요구에 따라 늘어남
- Tag는 별도 개념이 아니라 Axis를 필터 모드로 소비하는 것
- 새 분류 추가 시: Axis로 정의 → 소비자가 어떻게 쓸지는 소비자가 결정

### 현재 관찰된 소비 패턴

| 패턴 | 소비자 | Axis 사용 방식 | 예시 |
|------|--------|--------------|------|
| **좌표** | PrefixDef.dims | Axis × Axis → 1D 주소 (WeightedIndex) | `env × region × svc_name → service:v1:42` |
| **필터** | ServiceAttributes | 단독 값으로 필터/그룹핑 | `concerns: ["security"]`, `category: "core"` |
| **권한** | PolicyRule.match | 조건식으로 접근 제어 판정 | `{ field: "role", op: "eq", value: "admin" }` |
| **게이트** | GateEngine | entry별 active/inactive/open/reserved | `flow_type=custom → inactive (deprecated)` |
| **의사결정** | FlowSchema.gates | Gate=Axis, Branch=Entry, Path=Address | `scope=new, arch=layered → coordinateAddress` |
| **관측** | DKG ObservationNode | subjects/finding에서 축 값 참조 | `subjects: ["cart_event"], finding: "skew detected"` |
| **분류** | PatternClassification | 축 값 기반 패턴 분류 | `evidence_kind=data + freq≥5 → routine` |
| **계층** | LayerMap | 축 값으로 시각화 배치 | `svc_name=shopping-web → Layer 0 (UI)` |
| **전파** | ConcernDef (def-catalog) | 축 값이 link 그래프를 타고 상속 | `security → 의존 문서에 자동 전파` |
| **태깅** | ServiceAttributes, def frontmatter | 대상에 축 값을 다중 부여 (1:N) | `auth → concerns: [security, observability]` |

### 태깅 관리 규칙

태깅 = Axis를 1:N 다중 부여로 소비하는 패턴. 설계: `docs/specs/system/tag-management.spec.md`

- **저장**: 대상이 사는 곳에 함께. 별도 태그 store 없음
- **카디널리티**: 배타적이면 단일(category, criticality), 공존이면 다중(concerns, structural, def.tags). 배포 계층은 `layer` 필드가 담당 (tier 태그 제거됨)
- **전파**: ConcernTag만 depends_on 링크 따라 하위 전파. 나머지 불전파
- **제거**: 직접 태그만 제거. 전파된 것은 다음 계산에서 자동 소멸
- **SSOT**: `definition-catalog/src/taxonomy.ts` KNOWN_TAGS

## 좌표 컨벤션

### Prefix Version
- `latestPrefixVersion(catalog, prefixId)`로 동적 조회. `"v1"`, `"v2"` 하드코딩 금지

### Axis Capacity
- 새 축: `nextPowerOf2(entries.length * 2)` 이상. 눈대중 금지
- headroom ≤ 1 → warning, 0 → critical

### DecodeResult
- 새 코드는 `DecodeResult` 사용. 레거시 `DecodedPosition`/`ResolvedDimValue` 하위호환만
- `dim.kind` 분기 없이 value 타입 가정 금지

### 크로스커팅 prefix 7종 (2026-03-23)
- version_state, metric_aggregate, validation_event, resource_lifecycle, test_coverage, cli_tracking, tag_lifecycle
- infra-domain: version_state, metric_aggregate
- observation-domain: validation_event, resource_lifecycle
- tracking-domain: tag_lifecycle
- dev-domain: test_coverage, cli_tracking

## 코딩 컨벤션

### 한국어
- 주석/UI 텍스트 한국어 사용

### BigInt
- `Number.MAX_SAFE_INTEGER` 초과 시 `MetaCodecBig` + `createLayoutProtocolBig` + Capacity Guard

### 환경변수 처리
- **서비스**: `config/env.ts` zod 스키마. `process.env` 직접 접근 금지
- **SDK/context**: `process.env.QA_*` fallback 허용
- **CLI**: 직접 접근 허용
- **라이브러리**: constructor 인자 우선, `process.env` 최소화
- **테스트**: 직접 접근 허용

### 에러 처리 — 상세: `docs/specs/system/error-handling-convention.spec.md`

- **에러 3계층**: AppError(서비스, code+statusCode+extras), ServiceClientError(클라이언트, status+payload), 라이브러리 에러(독립)
- **에러 코드**: INVALID_INPUT(400), NOT_FOUND(404), CONFLICT(409), INTERNAL_ERROR(500)
- **에러 로깅**: `logger.error({ err }, "설명")` — `err` 키 사용 (pino 자동 직렬화). `error` 키 사용 금지 (`{}`로 출력됨)
- **fail-open**: gate check 실패 → 허용 + warning. 차단하지 않음
- **에러 삼킴 금지**: 빈 catch 블록 금지. 최소 logger.warn
- **라이브러리→서비스 변환**: catch 후 AppError로 wrap (`fromIndexMetaError()` 패턴)

### 서비스 로깅
- **서비스**: `createLogger("서비스명")` 필수. `console.log/warn/error` 사용 금지
- **라이브러리**: `createLogger` 사용 또는 생성자로 logger 주입. `console.*` 금지
- pino 구조화 JSON 로깅: `logger.info({ key: value }, "메시지")`
- **브라우저 SDK**: `console.warn` 허용 (pino 미사용)
- **CLI**: `console.log` 허용 (사용자 출력)
- **테스트**: 제약 없음

### 로그 → Ingest 브릿지 (IngestForwarder)
- pino 로그 중 `addressContext` 키가 있는 것만 필터 → `EventRecord`로 변환 → `POST /v1/ingest`
- 활성화: `createLogger("서비스명", { destinations: [{ stream: createIngestForwarder({...}), level: "info" }] })`
- 환경변수: `QA_INGEST_ENDPOINT` 설정 시 서비스가 자체 판단하여 활성화
- **fail-open**: forwarder 실패가 로그 출력(stdout)을 절대 차단하지 않음
- **ingest-server 자기 참조 금지**: ingest-server는 자기에게 forward하지 않는다
- event_key 규칙: 명시(`eventKey` 필드) > 자동(`svc_log.{level}`)
- 코드 위치: `@qa-sdk/logger` (IngestForwarder), `@qa-sdk/core` (createLogger destinations 옵션)

### 브라우저 SDK 에러 처리
- `emitWithCoords`/`browserTrack` try-catch 필수 — UI 크래시 방지
- 인코딩 실패 시 coordinate 없이 emit (이벤트 유실보다 좌표 누락이 낫다)
- `createQaMonitorAsync` registry fetch 실패 → console.warn + 로컬 fallback
- **browser-sdk는 범용 SDK — 특정 도메인 prefix/데이터가 들어가면 안 됨**
- ownedPrefixes는 SDK가 아닌 **사용하는 서비스**가 선언 (예: shopping-web이 page_view/tracking/cart_event/auth_event 소유)

### 서비스 네트워크 호출
- 서버 시작 시 외부 fetch: `AbortSignal.timeout(5_000)` 필수
- `JSON.parse(외부 데이터)` try-catch 필수

### Codegen 결정론성
- `generateCatalogTypes()`는 timestamp 1회 캡처. 같은 catalog → 같은 contentHash

### ISO-8601 타임스탬프
- 문자열 비교 (`<`, `>`, `localeCompare`) 금지
- `compareTimestamps(a, b)` 사용 (`@qa-sdk/core`)
- 외부 입력은 `normalizeTimestamp()` 후 비교

### 테스트 — SSOT 파생 표준

원칙: "카탈로그가 바뀌어도 테스트는 깨지지 않아야 한다"

- 카운트 → SSOT에서 파생 (`Object.keys(DEMO_CATALOG.axes).length`). 하드코딩 금지
- DKG 결과 → 범위 검증 (`toBeGreaterThan`) 또는 불변조건. 정확한 노드 수 금지
- dim 목록 → 구조 기반 (포함/제외 조건). 전체 목록 하드코딩 금지
- prefix_ref → DKG에서 자동 생성. 수동 나열 금지
- 하드코딩 허용: HTTP status, fixture 주입 데이터, 특정 ID(시나리오용), 에러 코드
- NestJS 테스트: InMemory store 주입, mock은 외부 서비스 호출만
- D1 테스트: `NodeSqliteDriver(":memory:")` + DDL 실행
- convergence 복사본: `spec-core/shared/graph-port.ts` 변경 시 동기화 필수 (`copy-drift.test.ts`)
- 코드 예시: `docs/guides/testing-patterns.md`

## Decision Flow 컨벤션

| 질문 | 플로우 | 자동 판정 |
|------|--------|----------|
| "테스트가 필요한가?" | `test-needed` | 문서만→불필요, 신규+시스템→E2E |
| "기획을 확장할까?" | `scope-expansion` | 미완성+수요없음→보류 |
| "안정화가 필요한가?" | `stabilization` | 버그빈도 높음→개선필요 |
| "기존에 뭐가 있지?" | `ContextProvider.lookup(keyword)` | — |

- 모든 결정에 evidence 첨부: `{ kind: data|rule|precedent|intuition|external, source, content, weight }`
- confidence < 0.3 → 경고. 자동 판정 가능하면 `autoSelect()`, 불가 → 사람이 결정
- 라이브러리는 순수 (SQLite/fetch 없음). 영속(`~/.qa-sdk/decision-flow.sqlite`)과 ingest 전송은 CLI 책임
- **Decision → Definition 순환**: 의사결정 outcome(artifactType) → 문서 scope 추론, 문서(컨텍스트) → 다음 의사결정 입력
- bridge: `suggestScopeFromArtifact()`, `suggestLifecycleFromVerdict()`, `buildDefinitionContext()`
- 상세: `docs/specs/decision-flow/`, `docs/specs/system/decision-definition-bridge.spec.md`

## Cross-Loop 피드백 아키텍처

6개 피드백 루프가 서로의 출력을 입력으로 사용하여 순환한다. 브릿지 코드: `definition-catalog/src/cross-loop-bridge.ts`

### 6개 루프

| # | 루프 | 관측 prefix | 트래커 |
|---|------|------------|--------|
| ① | 사용자 행동 | page_view, tracking, endpoint, flow_point 등 | autoTrack (event-catalog) |
| ② | 상태 머신 (11-machine) | harness_transition, harness_guard, harness_process_step | harness-tracker.ts |
| ③ | 품질 게이트 | gate_execution, bundle_observation | gate-tracker.ts |
| ④ | 수렴 분석 | convergence_event, pattern_match, metric_point 등 | convergence-pipeline.ts |
| ⑤ | 의사결정 | decision_path, model_apply | decision-flow/observe.ts |
| ⑥ | 인프라 생명주기 | version_point, gate_point, resource_lifecycle 등 | gate-aware-query.ts |

### 루프 간 브릿지

| 연결 | 브릿지 | 사용법 |
|------|--------|--------|
| ③→② Gate→Harness | `createGateHarnessBridge()` | BundleState `complete` → convention `compliant` 자동 전이 |
| ②→⑤ Harness→Decision | `buildHarnessContext()` | 하네스 상태를 ContextProvider context에 주입 |
| ⑤→⑥ Decision→Infra | `createDecisionInfraBridge()` | verdict → doc-lifecycle 전이 제안 |
| ⑥→① Infra→User | `gateFilterRanges("encodable")` | inactive/reserved 주소 encode 차단 (fail-open) |
| ①→④ User→Convergence | HTTP ingest → recordStore → flush | 자동 (ingest-server 내장) |
| ④→⑥ Convergence→Infra | `metricsToObservations()` → DKG store | 자동 (convergence-pipeline 내장) |

### guard 의존 순서

- convention → compliant 전이에는 `doc-lifecycle: approved` guard 필요
- 전체 루프 순서: Decision success → Doc approved → Gate complete → Convention compliant

## Definition 시스템 (좌표 기반 문서 관리 체계)

좌표계(scope×aspect×depth)로 문서를 분류하고, 분해 레벨(level)로 전체-부분 구조에서의 위치를 표현한다. DB가 메타데이터 SSOT, 파일이 본문 SSOT. 상세: `docs/definition-system-philosophy.md`

### 분해 레벨 (DefLevel) — 3단계

**원칙: 모든 문서는 하나의 개념과 그 개념의 구성을 참조하는 완결된 정의여야 한다.**

| level | 질문 | 정의하는 것 |
|---|---|---|
| `group` | "왜 이것들이 함께 있는가" | 묶임의 이유 (조직적 경계). 재귀 가능 |
| `module` | "이 개념은 무엇인가" | 단일 개념 + 구성 요소 참조 (개념적 경계) |
| `leaf` | "이 구성 요소는 어떻게 동작하는가" | 최종 명세 (구현 경계). 기본값 |

- contains 계층: group → group \| module, module → module \| leaf, leaf → 자식 없음
- group은 재귀 가능 (group → group → module → leaf)
- **좌표에 인코딩하지 않음** — 변할 수 있으므로 주소 불변성 보존
- frontmatter에 `level: module` 선언. 없으면 기본값 `leaf`
- **검증**: group/module은 자식 1건 이상 필수, leaf는 자식 금지 (`validateGraph`)

### 좌표 주소 (이중 관리)

| 역할 | 필드 | 특성 |
|------|------|------|
| **불변 식별자** | `address` (정수) | 한번 부여 후 불변. 링크/참조의 앵커 |
| **표시 라벨** | `id` (kebab-case) | 사람이 읽는 이름. 변경 가능 |

```
v1 (분류): scope(16) × aspect(64) × depth(8) = 8,192 (유형 분류용)
v2 (유일): scope(16) × aspect(64) × depth(8) × seq(128) = 1,048,576 (문서별 유일)
```

좌표에 포함: scope, aspect, depth, seq(v2)
메타데이터: level, lifecycle, layer, tags, svc
config: `.qa-sdk/def-config.json` — 주소 버전, 동기화 시각, 문서별 해시

### LinkType 사용 규칙 (taxonomy.ts LINK_TYPE_RULES)

| 유형 | 읽는 법 | 순환 | 사용 기준 |
|------|---------|------|----------|
| `contains` | A가 B를 포함한다 | 금지 | 그룹→멤버 소속 (트리). 다중 부모 시 cross-scope 태그 필요 |
| `depends_on` | A가 B에 의존한다 | 금지 | A가 B 없이 동작 불가 |
| `implements` | A가 B를 구현한다 | 금지 | 추상 계약→구체 코드 |
| `refines` | A가 B를 구체화한다 | 금지 | 같은 계층 내 상세화 (문서→상세문서) |
| `constrains` | A가 B를 제약한다 | 금지 | constraint 문서가 규칙 부과 |
| `traces_to` | A가 B로 추적한다 | 금지 | deprecated→대체 문서, 이력 추적 |

### 문서 그래프 검증 (validateGraph)

| 검증 | 심각도 | 설명 |
|------|--------|------|
| broken-link | error | target 미존재 |
| circular-ref | error | depends_on/implements/refines 순환 |
| self-ref | error | 자기 참조 |
| orphan | warning | approved 문서인데 아무도 참조 안 함 (draft/review 제외) |
| multi-parent | warning | contains 다중 부모 (cross-scope 태그 있으면 허용) |
| contains-depth | warning | contains 계층 4단계 초과 |

### 4계층 (DefLayer) — "이것이 왜 존재하는가"

| layer | 존재 이유 | 삭제 시 영향 | 영향 전파 |
|---|---|---|---|
| `domain` | "이것이 참이다" — 비즈니스 본질 | 진실 소멸 | → domain + operation + mediation |
| `operation` | "시스템이 돌아가게 한다" — 인프라 | 성능 저하 | → operation 내부만 (독립) |
| `mediation` | "진실을 소비 가능하게 변환" — 중재 | 유저 불편 | → mediation + experience |
| `experience` | "사용자 행동을 유도한다" — 경험 설계 | 유도 소멸 | → experience 내부만 |

- scope(구조) × layer(존재 이유) 직교. 같은 scope도 layer가 다를 수 있음
- `definition-catalog/src/types.ts` `DefLayer`, `impact.ts` `canPropagate()`

### definition-service (port 3700, NestJS)

- 9 NestJS 모듈: docs, search, prefixes, intents, consumption, graph, sync, graphql, tests
- DB: drizzle ORM (정규 테이블) + SearchModule (FTS5, drizzle 미지원 → onModuleInit에서 독립 생성)
- **메타데이터 SSOT: DB** — frontmatter는 읽기 전용 캐시 (id + address만 파일 소유)
- prefix 공급: registry-service → fetch → DB. registry 실패 시 DB 캐시
- prefix SDK: `@qa-sdk/definition-client` (순수 HTTP + NestJS DI)

### definition-service API

| Method | Path | 기능 |
|---|---|---|
| GET | `/docs?scope=&aspect=&depth=&layer=&svc=&tag=&q=&limit=&offset=` | 확장 필터 + 전문검색 + pagination |
| GET | `/docs/:id` | 단건 조회 |
| PATCH | `/docs/:id` | 메타데이터 업데이트 (DB SSOT, address 자동 계산) |
| GET | `/docs/:id/children` | contains 자식 |
| GET | `/docs/:id/parent` | contains 부모 |
| GET | `/docs/:id/incoming-links` | 역링크 |
| POST/DELETE | `/docs/:id/links`, `/docs/:id/tags/:tag` | 원자적 link/tag 추가/삭제 |
| POST | `/sync` | file → DB |
| POST | `/sync/to-files` | DB → file (frontmatter 역동기화) |
| POST | `/graph/validate` | 깨진 링크, 순환 참조, 고아 문서 검증 |
| GET | `/graph/:id/impact` | blast radius 분석 |
| GET | `/graph/:id/concerns` | concern 전파 조회 |

### definition-catalog 좌표 주소

- `def_document:v2:<N>` (scope × aspect × depth × seq 인코딩)
- 규모 확인: `qa-sdk def stats`

### CLI def 명령

- 모든 def 명령은 DefDataSource(SQLite/HTTP) 기반. 레거시 scanAndBuild 경로 제거됨
- `def scan` = `def sync`의 alias (파일→DB 동기화). 실행 후 `def get/list/search` 즉시 사용 가능
- `def state` — 11개 FSM 상태 분포 조회 (scanAndBuild + config 기반, 파일 직접 스캔)

### 하네스 상태 관리 (harness)

11개 상태 머신을 통합 관리하는 접착층. 코드 모듈 구조:

| 모듈 | 파일 | 역할 |
|------|------|------|
| FSM 엔진 | `state-model.ts` | 범용 전이 함수 |
| 머신 선언 | `harness-machines.ts` | 7개 시스템 머신 정의 |
| guard/cascade | `harness-guards.ts` | 의존 관계 검증 |
| 상태 파생 | `harness-derive.ts` | 11개 derive 함수 (순수) |
| SDK 수집 | `harness-tracker.ts` | 이벤트 emit |
| CLI | `cli/commands/def.ts:cmdState` | `qa-sdk def state` |
| 영속화 | `def-config.ts` (states 필드) | 머신 상태 저장 |
| Gate FSM | `work-domain/gate-fsm.ts` | GateState 9종 + BundleState |
| Gate 도출 | `work-domain/contract-to-gates.ts` | scope×aspect → GateKind |
| 계획 | `work-domain/harness.ts` | buildHarnessPlan + 런타임 |

### 스펙 문서 마커 체계

모든 스펙 문서에 구조와 흐름을 마커로 표시:

**필수:**
- `^purpose` — 왜 존재하는가 (목적)

**구조 마커 (개념 흐름 방향):**
- `^defines` — 이 문서가 새로 정의하는 개념/함수/타입
- `^consumes` — 외부에서 가져다 쓰는 것 (코드의 import)
- `^delegates` — 자식에게 위임하는 것 (module/unit만, 코드의 re-export)

**방법 마커:**
- `^method` — 하위 구성요소를 어떻게 사용하여 목적을 달성하는가 (module/group용)

**보조:**
- `^overview` — 핵심 사실 나열 (선택)

level별 조합: leaf = purpose + defines + consumes. module = purpose + method + defines + consumes + delegates.

### 범용 유틸

- `definition-catalog/src/yaml-lite.ts` — zero-dep YAML 파서 (frontmatter에서 추출, 범용 재사용 가능)

## 서비스 포트

ingest(3200), registry-service(3300), gate(3400), query(3500), decode(3600), definition(3700), motion-workspace(3710), decision(3800), gRPC debug(50051, GRPC_PORT 설정 시)

## 신규 패키지

| 패키지 | 용도 |
|--------|------|
| `@qa-sdk/codec-proto` | 진짜 Protobuf encode/decode (zero-dependency 순수 구현) |
| `decision-flow` | 의사결정 흐름 엔진 |
| `event-catalog` | 이벤트 카탈로그 + auto-track + prefix 매핑 |
| `motion-content` | 모션 콘텐츠 (platform-demo에서 분리) |
| `@qa-sdk/definition-service` | 문서/prefix 정의 관리 서비스 (NestJS + SQLite, port 3700) |
| `@qa-sdk/definition-client` | definition-service HTTP 클라이언트 + NestJS DI 모듈 |
| `@qa-sdk/decision-service` | 의사결정 스키마/인스턴스/문서연결 관리 (NestJS + SQLite, port 3800) |
| `codegen-core` | SchemaSnapshot/Catalog → TypeScript/Proto 코드 생성 순수 함수 (CLI에서 추출) |
| `config-loader` | Catalog/DkgConfig .ts/.js/.json 파일 로더 — 자동 감지 + 폴백 체인 (CLI에서 추출) |
| `decision-flow-store` | decision-flow InstanceStore SQLite 영속 — drizzle + node:sqlite (CLI에서 추출) |
| `definition-data-source` | DefDataSource 팩토리 — SQLite local + HTTP 서버 자동 감지 (CLI에서 추출) |
| `git-utils` | Git 메타데이터 추출 — conventional commits, semver tags, scope 집계 (execa 기반, CLI에서 추출) |
| `package-classifier` | 모노레포 패키지 tier/runtime/scope 분류 (CLI에서 추출) |
| `snapshot-io` | SchemaSnapshot JSON 읽기/쓰기/검증 (CLI에서 추출) |
| `review-ledger` | 파일별 커밋 기준 리뷰 완료 기록 원장 — SQLite + drizzle (신규) |

## Ingest Store Driver (STORE_DRIVER)

```
STORE_DRIVER=memory  → D1+:memory: 자동 업그레이드 (기본, insights 활성). 실패 시 InMemory fallback
STORE_DRIVER=pg      → Drizzle + PostgreSQL (운영, TRACE_DATABASE_URL 필수, packages/store)
STORE_DRIVER=d1      → D1/SQLite via SqlDriver (CF Workers, SQLITE_PATH)
STORE_DRIVER=clickhouse → ClickHouse RecordStore (대량 분석, CLICKHOUSE_URL)
```

- D1 store: 4개 core (Record, Trace, Session, Verdict) + 나머지 InMemory
- ClickHouse store: RecordStore만 구현, 나머지 InMemory
- store-factory.ts에서 드라이버 선택 + 생성

## Insights Driver (INSIGHTS_DRIVER)

```
INSIGHTS_DRIVER=local    → DrizzleInsightsStore (SQLite, 기본)
INSIGHTS_DRIVER=app-hub  → AppHubInsightsStore (Google App Hub)
```

- `InsightsStore` 포트: `ingest-server/src/ports/insights-store.port.ts` — 읽기 12메서드 + `collect()` 쓰기
- local 모드: ingest pipeline이 같은 SQLite DB에 기록, `collect()` no-op
- app-hub 모드: `collect()`에서 App Hub API로 전달, 읽기도 App Hub
- 프로필: `~/.qa-sdk/service-profile.json` — CLI `qa-sdk service mode local|prod`로 전환
- 서버는 시작 시 프로필 파일을 환경변수 기본값으로 로딩 (환경변수 명시 설정 시 우선)
- App Hub 설정: `APP_HUB_ENDPOINT`, `APP_HUB_PROJECT_ID`, `APP_HUB_CREDENTIAL`
- fail-open: insights 수집 실패가 ingest 파이프라인을 차단하지 않음
- memory 모드에서 D1+:memory: 자동 업그레이드 — insights 기본 활성화
- D1 초기화 실패 시 순수 InMemory fallback (insights 비활성)

## Service Profile (서비스 URL 중앙 관리)

- `~/.qa-sdk/service-profile.json` — 모든 CLI 명령의 서비스 URL 소스
- `qa-sdk service mode local|staging|prod` — 전체 URL 일괄 전환
- `qa-sdk service mode --set <serviceId>=<url>` — 개별 URL 커스텀
- URL 우선순위: 환경변수 > --flag > service-profile > local 기본값
- `ingest mode`는 `service mode`의 alias (하위 호환)
- `service-profile.ts` (`cli/src/lib/`) — `getServiceUrl(serviceId)` 공용 유틸. 새 CLI 명령에서 URL 하드코딩 금지

## Drizzle 마이그레이션 규칙

- **버전**: `drizzle-orm` / `drizzle-kit` 모두 `1.0.0-beta.20` 고정
- **스키마 파일**: 각 패키지 `src/db/schema.ts` (예외 없음)
- **설정 파일**: 각 패키지 루트 `drizzle.config.ts` (`dialect: "sqlite"`, `out: "./drizzle"`)
- **마이그레이션 폴더 경로**: `new URL("../drizzle", import.meta.url).pathname` (process.cwd 금지). **주의**: tsc가 src→dist로 컴파일하므로 `src/`에서의 상대경로와 `dist/`에서의 상대경로가 다름. `dist/xxx.js` 기준으로 `../drizzle`이 `패키지/drizzle`을 가리키는지 확인
- **IF NOT EXISTS**: drizzle `migrate()`가 `__drizzle_migrations` hash로 중복 실행을 방지하므로, 정상 마이그레이션 경로에서는 불필요. 생성된 SQL을 수동 수정하지 않는다
- **PRAGMA**: 모든 SQLite 서비스에 WAL + busy_timeout=3000. FK 있으면 foreign_keys=ON
- **드라이버**: NestJS 서비스는 `drizzle-orm/better-sqlite3`, 나머지는 `drizzle-orm/node-sqlite`
- **node:sqlite 타입**: `getDatabaseSync()` + `DatabaseSyncInstance`를 index-meta에서 import. 자체 인터페이스 정의 금지
- **쿼리 빌더**: 신규 코드는 drizzle query builder 사용. raw SQL 금지 (기존 definition-service 예외)
- **에러 핸들링**: migrate() 호출은 try/catch + throw 필수. 에러 삼킴 금지 (index-meta SCHEMA_DDL 폴백 제외)
- **D1 (Workers)**: 파일시스템 접근 불가하므로 런타임 migrate() 불가. DDL 문자열은 src/db/schema.ts와 수동 동기화
- **tsup 번들**: drizzle/ 폴더는 `onSuccess` 훅으로 dist에 복사 (publicDir 아님)

## Protobuf 전송 (codec-proto)

```
JSON (기본)          → Content-Type: application/json
QAPB (레거시)         → Content-Type: application/x-protobuf + QAPB magic header
진짜 Protobuf         → Content-Type: application/x-protobuf (QAPB magic 없음)
```

- ingest-server가 자동 감지: QAPB magic 있으면 QAPB, 없으면 진짜 protobuf
- `@qa-sdk/codec-proto`: `encodeEnvelope(json) → Uint8Array`, `decodeEnvelope(binary) → json`
- 크기: JSON 대비 55% 절감 (642B → 265B per record)
- 성능: encode 178K ops/s, decode 102K ops/s (JSON보다 느리지만 네트워크 절감이 큼)
- 선택 가이드: 로컬 → JSON, 인터넷 경유 → Proto, 대량 아카이빙 → Proto

## Verdaccio 로컬 npm 배포

```bash
pnpm registry        # Verdaccio 시작 (localhost:4873)
pnpm publish:local   # 14개 패키지 배포
```

소비자: `echo "registry=http://localhost:4873" > .npmrc && pnpm install @qa-sdk/core`

## DKG Constraints

- CON-001: rbac_role과 role 동시 사용 금지
- CON-002: 이벤트 prefix action dim은 *_action 축 사용
- CON-003: DSL 관측/인프라 멤버는 svc_ref 필수
- CON-004: classificationRate >= 80%
- CON-005: critical anomaly → auto observation
- CON-006: prefix_ref refEntries 필수. 미정의 → GateEngine reserved 처리
- CON-007: totalSpace > 2^53 → safePrecision=false 표기
