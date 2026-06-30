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
| `docs/specs/system/README.md` | System-level rule/convention 인덱스 (9 `*.rule.md`) |
| `docs/specs/system/layer-separation.rule.md` | 4-layer 책임 모델 (data / validator / workflow / tooling) + workflow smoke 원칙 |
| `docs/skills/` | 운영 플레이북 + DKG skill 사용 가이드 — 진입점: `docs/skills/README.md` |
| `docs/definition-system-philosophy.md` | Definition 시스템 철학 — 좌표 기반 문서화 원리 |

## 패키지 규칙

- 새 라이브러리 → unscoped name + tsup dual format (ESM + CJS)
- 새 서비스/앱 → `@qa-sdk/*` scope + tsc ESM only (cli는 tsup + shebang)
- 의존 방향: QA 플랫폼 → 인코딩 라이브러리만 허용 (역방향 금지)
- 인코딩 의존 체인: `weighted-index → bit-index → permission-engine`
- 플랫폼 의존 체인: `@qa-sdk/core → logger → codec → context → sdk`
- 문서 control-plane 체인: `doc-envelope → (ralph-tui-integration | ontology-pack-validate | deterministic-label-registry) → @qa-sdk/cli` (상세: `docs/specs/definition-catalog/deterministic-label-architecture.spec.md`)

## 빌드

- `pnpm --filter <pkg> build` — 개별 빌드
- TypeScript target: **ES2023** 전체 통일 (루트 + 32개 패키지)
- weighted-index DTS 빌드에 기존 에러 있음 (calc.js exports); ESM/CJS는 정상
- **CLI tsup 번들 제약**: CLI는 tsup 단일 번들 (`dist/index.js`). 내부 동적 import 불가 — 정적 import 또는 re-export 사용
- **async createRuntimeStores**: ingest-server의 `createRuntimeStores`는 async. 호출부에 `await` 필수

## Skills 관리

- **SSOT**: `skills/` 디렉토리가 skill 정의의 유일한 원본
- **실행 위치**: `~/.claude/skills/`, `~/.codex/skills/`
- **동기화**: `./scripts/sync-skills.sh` — repo → home 단방향 전파. `~/.claude/skills/` 직접 수정 금지

## SSOT 원칙

- **Catalog이 유일한 입력** — codegen, DKG, DecodeMap, 브라우저 카탈로그는 전부 파생
- `DEMO_CATALOG` — 축/prefix/table 수 하드코딩 금지, `Object.keys()` 등으로 동적 파생
- `demo-types`, `BROWSER_CATALOG`는 자동 생성. 직접 수정 금지
- 인라인 encode 코드 금지 — `import { track } from '@qa-sdk/browser-codec'`
- 데이터 상수는 demo-snapshot에서 import. 하드코딩/복사 금지
- 파생 체인 상세: `docs/system-overview.md`, `docs/specs/apm-system/apm-schema-system/dsl-schema-versioning.spec.md`
- 관측 체계 3단계 (IntentLink → Auto IL → ScenarioSpec): `docs/specs/analysis-system/analysis-intent-link.spec.md`
- 서비스 소유권 (ownedPrefixes): `docs/specs/realization/service-ownership-spec.spec.md`
- Table 식별자 충돌: schema-builder dialect가 흡수. `docs/plan/schema-builder/purpose.md` §5

## 소스 위치 규칙

- `weighted-index/src/index.ts` — 모든 public export 관리. 새 함수 추가 시 여기도 갱신
- `@qa-sdk/core/catalog/runtime.ts` — canonical runtime 함수. demo-accessors는 re-export
- 의존: demo-catalog → demo-compat → demo-snapshot/demo-domains (순환 금지)

## 설계 원칙

- spec-core는 라이브러리 — ingest-server/registry-service에 정적 의존 없음
- 서비스는 동적 import (`ENABLED=true`일 때만) + optional peer dependency
- 에러 격리: convergence 실패가 Phase 2 verdict/활성화를 절대 차단하지 않음
- Fail-open: gate check 실패 → 허용 + warning diagnostic
- ServiceBootConfig이 서비스 정체성의 단일 진입점

## 좌표 컨벤션

- **Prefix Version**: `latestPrefixVersion(catalog, prefixId)`로 동적 조회. `"v1"` 하드코딩 금지
- **Axis Capacity**: `nextPowerOf2(entries.length * 2)` 이상. headroom ≤ 1 → warning, 0 → critical
- **DecodeResult**: 새 코드는 `DecodeResult` 사용. `dim.kind` 분기 없이 value 타입 가정 금지
- **좌표 저장**: 정수 address 저장 시 `(prefix_id, version, address)` VersionedIndex 패턴 필수. 상세: `docs/specs/system/coordinate-storage.rule.md`

## 코딩 컨벤션

### 한국어
- 주석/UI 텍스트 한국어 사용

### BigInt
- `Number.MAX_SAFE_INTEGER` 초과 시 `MetaCodecBig` + `createLayoutProtocolBig` + Capacity Guard

### 환경변수 처리
- **서비스**: `config/env.ts` zod 스키마. `process.env` 직접 접근 금지
- **SDK/context**: `process.env.QA_*` fallback 허용
- **CLI/테스트**: 직접 접근 허용
- **라이브러리**: constructor 인자 우선, `process.env` 최소화

### 에러 처리
- 에러 3계층, fail-open, 에러 삼킴 금지, `logger.error({ err }, "설명")` — `err` 키 사용
- 상세: `docs/specs/system/system-support/error-handling-convention.spec.md`

### 로깅
- **서비스**: `createLogger("서비스명")` 필수. `console.*` 금지
- **라이브러리**: `createLogger` 또는 생성자 주입. `console.*` 금지
- **CLI**: `console.log` 허용. **브라우저**: `console.warn` 허용. **테스트**: 제약 없음
- IngestForwarder 상세: `docs/specs/apm-system/apm-runtime-system/log-ingest-bridge/log-ingest-forwarder.spec.md`

### 브라우저 SDK
- `emitWithCoords`/`browserTrack` try-catch 필수 — UI 크래시 방지
- browser-sdk는 범용 SDK — 특정 도메인 prefix/데이터 금지
- ownedPrefixes는 SDK가 아닌 **사용하는 서비스**가 선언

### 네트워크 호출
- 서버 시작 시 외부 fetch: `AbortSignal.timeout(5_000)` 필수
- `JSON.parse(외부 데이터)` try-catch 필수

### Codegen / 타임스탬프
- `generateCatalogTypes()` — 같은 catalog → 같은 contentHash (결정론적)
- ISO-8601: 문자열 비교 금지 → `compareTimestamps(a, b)` 사용 (`@qa-sdk/core`)

### 테스트 — SSOT 파생 표준
- 카운트/dim 목록/prefix_ref → SSOT에서 파생. 하드코딩 금지
- 하드코딩 허용: HTTP status, fixture 주입 데이터, 특정 ID, 에러 코드
- NestJS: InMemory store 주입. D1: `NodeSqliteDriver(":memory:")` + DDL
- 코드 예시: `docs/specs/system/testing-patterns.spec.md`

## Decision Flow 컨벤션

| 질문 | 플로우 | 자동 판정 |
|------|--------|----------|
| "테스트가 필요한가?" | `test-needed` | 문서만→불필요, 신규+시스템→E2E |
| "기획을 확장할까?" | `scope-expansion` | 미완성+수요없음→보류 |
| "안정화가 필요한가?" | `stabilization` | 버그빈도 높음→개선필요 |

- 모든 결정에 evidence 첨부: `{ kind: data|rule|precedent|intuition|external, source, content, weight }`
- confidence < 0.3 → 경고. 자동 판정 가능하면 `autoSelect()`, 불가 → 사람이 결정
- 라이브러리는 순수 (SQLite/fetch 없음). 영속과 ingest 전송은 CLI 책임
- Decision↔Definition 순환: `docs/specs/system/decision-definition-bridge.spec.md`

## Definition 시스템

좌표계(scope×aspect×depth)로 문서 분류, 분해 레벨(level)로 전체-부분 위치 표현. DB = 메타데이터 SSOT, 파일 = 본문 SSOT. 철학: `docs/definition-system-philosophy.md`

### 분해 레벨 (DefLevel) — 3단계

| level | 정의하는 것 |
|---|---|
| `group` | 묶임의 이유 |
| `module` | 단일 개념 + 구성 참조 |
| `leaf` | 최종 명세 (구현 경계). 기본값 |

- group/module은 자식 1건 이상 필수, leaf는 자식 금지
- 구조적 책임은 `tier`(entry/component/system/layout)가 담당하고, level은 contains 검증 보조 메타데이터로 유지
- SSOT: `packages/definition-catalog/src/vocabulary.ts` DEF_LEVEL.entries

### 좌표 주소

- `address` (정수, 불변) — 링크 앵커. `id` (kebab-case, 변경 가능) — 표시 라벨
- v1: scope(16) × aspect(64) × depth(8) = 8,192. v2: + seq(128) = 1,048,576

### LinkType 사용 규칙

`contains`(소속) / `depends_on`(의존) / `implements`(구현) / `refines`(상세화) / `constrains`(제약) / `traces_to`(추적) — 모두 순환 금지

### 검증 (validateGraph)

broken-link(error), circular-ref(error), self-ref(error), orphan(warning), multi-parent(warning, cross-scope 태그 허용), contains-depth>4(warning)

### 4계층 (DefLayer)

`domain`(비즈니스 본질) → `operation`(인프라) → `mediation`(중재) → `experience`(경험). scope × layer 직교

### 서비스 & CLI

- definition-service (port 3700): API 상세 → `docs/specs/definition-service/def-svc-api-contract.md`
- 하네스 (11 FSM): 상세 → `docs/specs/definition-catalog/definition-harness-architecture.spec.md`
- CLI def 명령: DefDataSource 기반. `def scan` = `def sync` alias
- 스펙 마커: `^purpose`(필수), `^defines`/`^consumes`/`^delegates`(구조), `^method`(방법)

## 서비스 운영

상세: `docs/specs/infra-engine/infra-service-operations.md`

- **포트**: ingest(3200), registry(3300), gate(3400), query(3500), decode(3600), definition(3700), decision(3800)
- **Service Profile**: `~/.qa-sdk/service-profile.json`. URL 우선순위: 환경변수 > flag > profile > 기본값
- **Store Driver**: memory(기본) / pg / d1 / clickhouse. 상세 → `docs/specs/ingest/ingest-infra-system/`
- **Insights Driver**: local(기본) / app-hub. fail-open
- **Drizzle**: `docs/specs/system/drizzle-orm-convention.spec.md`
- **Protobuf**: 로컬→JSON, 원격→Proto. `@qa-sdk/codec-proto`
- **Verdaccio**: `pnpm registry` + `pnpm publish:local`

## CI gates

`.github/workflows/def-gate.yml` — `docs/specs/**`, `docs/proposals/**`, `packages/definition-*/**`, `packages/cli/**`, `packages/cli-command/**`, `skills/**` 경로 touch 시 자동 실행.

- `def sync` + `def validate` — L2 structural gate (errors=0 강제)
- `aspect-parents` invariants — L2 vocabulary drift gate (5건)
- `workflow-smoke` — L3 silent-empty CLI regression gate (12건)

근거: `docs/specs/system/layer-separation.rule.md` §2 (Workflow Smoke 원칙).

## DKG Constraints

- CON-001: rbac_role과 role 동시 사용 금지
- CON-002: 이벤트 prefix action dim은 *_action 축 사용
- CON-003: DSL 관측/인프라 멤버는 svc_ref 필수
- CON-004: classificationRate >= 80%
- CON-005: critical anomaly → auto observation
- CON-006: prefix_ref refEntries 필수. 미정의 → GateEngine reserved 처리
- CON-007: totalSpace > 2^53 → safePrecision=false 표기
