# QA-SDK Monorepo

> 규칙과 제약만 기술한다. 아키텍처/설계 상세는 `docs/` 참조.

## 참조 문서

| 문서 | 내용 |
|------|------|
| `docs/system-overview.md` | 시스템 개요, 패키지 구조, DKG, 수집 파이프라인 |
| `docs/CONVENTIONS.md` | 용어집, DimRef 3종, ColumnRef, 좌표 컨벤션, env var 테이블 |
| `docs/architecture-decisions.md` | ADR-001~009 |
| `docs/msa-architecture.md` | 서비스 토폴로지, 패턴 분류, 전이 엔진 |
| `docs/getting-started.md` | 산출물 단위, codegen, CLI 사용법 |
| `docs/data-model.md` | 데이터 모델, 테이블 스키마 |
| `docs/specs/` | 모듈/서비스별 상세 스펙 (gate-engine, coordinate-query, decode-service 등) |

## 패키지 규칙

- 새 라이브러리 → unscoped name + tsup dual format (ESM + CJS)
- 새 서비스/앱 → `@qa-sdk/*` scope + tsc ESM only (cli는 tsup + shebang)
- 의존 방향: QA 플랫폼 → 인코딩 라이브러리만 허용 (역방향 금지)
- 인코딩 의존 체인: `weighted-index → bit-index → permission-engine`
- 플랫폼 의존 체인: `@qa-sdk/core → logger → codec → context → sdk`

## 빌드

- `pnpm --filter <pkg> build` — 개별 빌드
- weighted-index DTS 빌드에 기존 에러 있음 (calc.js exports); ESM/CJS는 정상
- platform-demo: `pnpm --filter platform-demo exec vite build --mode development`

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

### 서비스 단위 소유권 (ownedPrefixes)

- 각 서비스는 registry에 `ownedPrefixes`로 생산하는 prefix를 선언
- 이벤트 수집 시 `address_context`의 prefix가 어떤 서비스에서 온 것인지 추적 가능
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

### 브라우저 SDK 에러 처리
- `emitWithCoords`/`browserTrack` try-catch 필수 — UI 크래시 방지
- 인코딩 실패 시 coordinate 없이 emit (이벤트 유실보다 좌표 누락이 낫다)
- `createQaMonitorAsync` registry fetch 실패 → console.warn + 로컬 fallback

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

#### 원칙: "카탈로그가 바뀌어도 테스트는 깨지지 않아야 한다"

#### 1. 카운트는 SSOT에서 파생

```typescript
// ❌ 하드코딩 (카탈로그 변경 시 깨짐)
expect(axes.length).toBe(74);
expect(prefixes.length).toBe(46);

// ✅ SSOT 파생
expect(axes.length).toBe(Object.keys(DEMO_CATALOG.axes).length);
expect(prefixes.length).toBe(Object.keys(DEMO_CATALOG.prefixes).length);
```

#### 2. DKG bootstrap 결과는 범위 검증

```typescript
// ❌ 정확한 노드 수 하드코딩 (DKG 설정 변경 시 깨짐)
expect(nodes.length).toBe(267);

// ✅ 범위 또는 불변조건
expect(nodes.length).toBeGreaterThan(100);
expect(graph.getNodesByKind("prefix").length).toBe(
  Object.keys(DEMO_CATALOG.prefixes).length
);
```

#### 3. export surface / dim 목록은 구조 기반 검증

```typescript
// ❌ dim 이름 하드코딩 (svc_ref 추가 시 깨짐)
expect(spec.export.dims).toEqual(["action"]);

// ✅ 제외 조건으로 검증
for (const dim of spec.export.dims) {
  expect(dim).not.toBe("actor");  // table_ref 제외 확인
}
expect(spec.export.dims).toContain("action");  // 핵심 dim 포함 확인
```

#### 4. prefix_ref 포함 테스트는 DKG에서 파생

```typescript
// ❌ address_context를 수동 나열 (prefix 추가 시 누락)
const ac = { page_view: "pv:v2:0", endpoint: "ep:v1:0" /* ... 30개 */ };

// ✅ DKG에서 전체 prefix 자동 생성
const ac: Record<string, string> = {};
for (const p of graph.getNodesByKind("prefix")) {
  ac[p.id] = `${p.id}:v1:0`;
}
```

#### 5. 하드코딩이 허용되는 경우

| 패턴 | 이유 |
|------|------|
| HTTP status (`toBe(200)`) | 프로토콜 상수 |
| 테스트 fixture의 주입 데이터 (`3 records inserted → toBe(3)`) | 테스트가 데이터를 제어 |
| 특정 prefix/axis ID (`"tracking"`, `"cart_event"`) | 테스트 시나리오 컨텍스트 |
| 에러 메시지/코드 (`"INVALID_INPUT"`) | API 계약 |

#### 6. 서비스 단위 테스트 (NestJS 패턴)

```typescript
// 의존성 주입으로 격리 테스트
function buildApp(deps: Partial<AppDeps> = {}) {
  return createApp({
    configStore: new InMemoryConfigStore(),  // 실제 인메모리 구현
    ...deps,
  });
}

// mock: 외부 서비스 호출만
const bindings = { "ingest-server": { fetch: vi.fn().mockResolvedValue(new Response("ok")) } };
```

#### 7. D1 Store 테스트

```typescript
// NodeSqliteDriver(:memory:)로 D1 시뮬레이션
const driver = new NodeSqliteDriver(":memory:");
for (const stmt of DDL.split(";").filter(s => s.trim())) {
  await driver.execute(stmt);
}
const store = new D1RecordStore(driver);
```

#### 8. convergence 복사본 동기화

- `spec-core/shared/graph-port.ts` 변경 시 `convergence/graph-port.ts` 동기화 필수
- `copy-drift.test.ts`가 자동 감지

## 서비스 포트

ingest(3200), registry-service(3300), gate(3400), query(3500), decode(3600), gRPC debug(50051, GRPC_PORT 설정 시)

## 신규 패키지 (이 세션 추가)

| 패키지 | 용도 |
|--------|------|
| `@qa-sdk/codec-proto` | 진짜 Protobuf encode/decode (zero-dependency 순수 구현) |
| `decision-flow` | 의사결정 흐름 엔진 |
| `event-catalog` | 이벤트 카탈로그 + auto-track + prefix 매핑 |
| `motion-content` | 모션 콘텐츠 (platform-demo에서 분리) |

## Ingest Store Driver (STORE_DRIVER)

```
STORE_DRIVER=memory  → InMemory 전체 (기본, 개발/데모)
STORE_DRIVER=pg      → Drizzle + PostgreSQL (운영, TRACE_DATABASE_URL 필수)
STORE_DRIVER=d1      → D1/SQLite via SqlDriver (CF Workers, SQLITE_PATH)
STORE_DRIVER=clickhouse → ClickHouse RecordStore (대량 분석, CLICKHOUSE_URL)
```

- D1 store: 4개 core (Record, Trace, Session, Verdict) + 나머지 InMemory
- ClickHouse store: RecordStore만 구현, 나머지 InMemory
- store-factory.ts에서 드라이버 선택 + 생성

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
