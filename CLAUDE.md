# QA-SDK Monorepo

## Monorepo 패키지 그룹

두 개의 독립적인 패키지 그룹이 공존하며, 향후 QA 플랫폼이 인코딩 레이어를 소비하는 통합 경로를 목표로 함.

### 수학/인코딩 라이브러리 (unscoped)
- 패키지: `weighted-index`, `bit-index`, `permission-engine`, `index-meta`, `demo-snapshot`
- 네이밍: bare name (npm 공개 배포 대상)
- 빌드: tsup → ESM + CJS dual format
- 빌드 순서: pnpm workspace가 의존성 기반으로 자동 관리. 수동 순서 불필요
- 인코딩: weighted-index → bit-index → permission-engine
- 플랫폼: @qa-sdk/core → @qa-sdk/logger → @qa-sdk/codec → @qa-sdk/context → @qa-sdk/sdk

### QA 플랫폼 (@qa-sdk/* scoped)
- 패키지: `@qa-sdk/core`, `@qa-sdk/convergence`, `@qa-sdk/browser-codec`, `@qa-sdk/logger`, `@qa-sdk/codec`, `@qa-sdk/context`, `@qa-sdk/sdk`, `@qa-sdk/engine`, `@qa-sdk/store`, `@qa-sdk/apm`, `@qa-sdk/browser`, `@qa-sdk/registry-client`, `@qa-sdk/ingest-server`, `@qa-sdk/registry-service`, `@qa-sdk/cli`
- 서비스 (unscoped): `gate-service`, `query-service`
- `@qa-sdk/decode-service`
- 네이밍: `@qa-sdk/*` scope (내부 플랫폼 서비스)
- 빌드: tsc → ESM only (예외: cli는 tsup ESM only + shebang)

### 규칙
- 새 라이브러리 패키지 → unscoped name + tsup dual format
- 새 서비스/앱 패키지 → `@qa-sdk/*` scope + tsc ESM only
- 그룹 간 의존: QA 플랫폼 → 인코딩 라이브러리 방향만 허용 (역방향 금지)

## 산출물 단위 (Deliverable Units)

비즈니스가 QA SDK를 도입할 때 제공해야 하는 5가지 단위. SDK 인프라는 이 입력을 소비하여 전체 파이프라인(인코딩 → 로깅 → 수집 → 분석)을 구동한다.

### 1. Catalog (도메인 좌표 정의) — 필수
비즈니스의 축(axes) + 주소 공간(prefixes) + 테이블(tables) 정의. 이것이 전체 시스템의 입력. 나머지는 파생.
- 형식: `Catalog` 인터페이스 (`@qa-sdk/core`)
- 참고: `demo-snapshot`의 `DEMO_CATALOG` (쇼핑 도메인 예시)
- 생성: `qa-sdk init`으로 스캐폴딩, 또는 직접 정의
- 운영: `registry-service`에 등록 → 서비스가 API로 조회

### 2. DkgConfig (거버넌스 설정) — DKG 사용 시
도메인 경계, 제약 조건, DSL 번들, 스킬, 스펙 정의. Catalog이 "무엇이 있는가"면, DkgConfig은 "어떻게 관리하는가".
- 형식: `DkgConfig` 인터페이스 (`@qa-sdk/core`)
- 참고: `demo-snapshot`의 `DEMO_DKG_CONFIG`
- 용도: `bootstrapDkg({ catalog, config })` → DKG 그래프 생성 → convergence 분석

### 3. PatternRules (이벤트 분류 규칙) — 패턴 분류 시
세션 이벤트 시퀀스를 행동 패턴으로 분류하는 규칙. `BehaviorPattern`은 `string` 타입이므로 비즈니스별 자유 정의.
- 형식: `PatternRule[]` (`@qa-sdk/core`)
- 권장: behavior_pattern 축 entries와 1:1 매핑

#### 규칙 구성 (2단계)
- **`SYSTEM_PATTERN_RULES`** — 도메인 무관 (bot_crawl, health_check, api_integration, error_recovery). 모든 비즈니스에서 재사용.
- **도메인 규칙** — 비즈니스 전용. 예: `SHOPPING_PATTERN_RULES` (purchase_complete, cart_abandon 등)
- 결합: `combinePatternRules(MY_DOMAIN_RULES)` → 시스템 + 도메인 규칙 priority 정렬 병합

#### 커스텀 규칙 작성 예시 (물류 도메인)
```typescript
import type { PatternRule } from "@qa-sdk/core";

export const LOGISTICS_PATTERN_RULES: readonly PatternRule[] = [
  {
    id: "rule-delivery-completed",
    identificationMode: "any",
    behaviorPattern: "delivery_completed",     // catalog behavior_pattern 축과 일치
    defaultConfidence: "exact",
    priority: 50,
    description: "배송 완료 흐름",
    match: {
      requiredSequence: ["route.planned", "pickup.*", "in_transit.*", "delivery.completed"],
    },
  },
  {
    id: "rule-delivery-failed",
    identificationMode: "any",
    behaviorPattern: "delivery_failed",
    defaultConfidence: "high",
    priority: 45,
    match: {
      requiredKeys: ["delivery.attempted"],
      excludedKeys: ["delivery.completed"],
    },
  },
];
```

#### 적용
```typescript
import { combinePatternRules } from "@qa-sdk/spec-core/convergence";
const myRules = combinePatternRules(LOGISTICS_PATTERN_RULES);
// → SYSTEM_PATTERN_RULES + LOGISTICS_PATTERN_RULES, priority 정렬
```

### 4. ServiceBootConfig (서비스 정체성) — 필수
각 서비스의 namespace, name, env, region 정의. 모든 SDK 레이어(좌표 인코딩, 전송 메타데이터, 권한)가 이 설정에서 파생.
- 형식: `ServiceBootConfig` (`@qa-sdk/core`)
- 파생: `toServiceDims()` → 좌표, `toTransmissionSource()` → 전송, `toTransmissionBuild()` → 빌드
- QaContext / ApmLogger / QaMonitor 모두 `serviceConfig` 필드로 수용

### 5. qa-sdk.config.ts (프로젝트 설정) — CLI 사용 시
CLI가 사용할 카탈로그 경로 또는 레지스트리 URL.
- 형식: `{ catalog: "./path/to/my-catalog.ts" }` 또는 `{ catalog: MyCatalog }`
- 탐색 우선순위: `--catalog` → CWD `qa-sdk.config.ts` → `DEMO_CATALOG`
- 모든 CLI dx 명령(encode/decode/resolve 등)이 이 경로를 따름

### demo-snapshot의 위치
`demo-snapshot`은 **참조 구현**이다. 인프라가 아님.
- `DEMO_CATALOG` — 쇼핑 도메인 카탈로그 예시 (74축, 39 prefix, 19 tables)
- `DEMO_DKG_CONFIG` — 쇼핑 도메인 거버넌스 예시
- `DEMO_PATTERN_RULES` — 쇼핑 이벤트 분류 규칙 예시
- `DEMO_SCENARIOS` — 정식 ScenarioSpec 8종 (shop-web 5 + infra 2 + dev 1)
- `DEMO_TRANSITION_SPECS` — TransitionSpec 32종 (축 커버리지 89%, spec-core/transition에 위치)
- 새 비즈니스는 이를 복사하여 자기 도메인으로 교체

### Transition Spec DSL
- 좌표계 위의 상태 해석 계층. ADR-009 참조
- 상태는 별도 vocabulary 없이 기존 축(flow_step, lifecycle_state, resource_location)으로 표현
- TransitionSpec이 SSOT → dkg-bridge가 TransitionSpecNode 자동 파생
- 7단계 파이프라인: collect→match→bind→load→validate→apply→emit
- DKG 엣지: consumes(축 참조), depends-on(상태 의존), satisfies(DSL invariant 형식 구현)
- CON-EFFECT-VOCAB: effect kind 정규 vocabulary 제약 (create/update/move/consume/open/close)
- ingest Phase 2.5: `TRANSITION_ENGINE_ENABLED=true`로 활성화
- CLI: `dkg transitions`, `dkg transition <name>`, `dkg transition coverage|orphans|violations`
- 다이어그램: `dkg diagram transition-spec <id>`, `dkg diagram transition-dag`
- 설계 문서: `docs/plan/transition-spec-dsl/`

### ScenarioSpec (Verdict)
- ScenarioSpec: "이 흐름이 올바른가?" → Verdict (pass/fail)
- TransitionSpec: "이 흐름이 무슨 의미인가?" → TransitionInstance (상태 변화)
- 두 spec은 같은 이벤트 스트림을 병렬 소비
- DEMO_SCENARIOS 8종:
  - shop-login, shop-checkout-entry, shop-checkout-complete, shop-full-purchase, shop-cart-abandon (shop-web)
  - infra-deploy-health, infra-pipeline-ingest (인프라)
  - dev-build-test (자기참조)
- address_context prefix 존재 검증: `{ field: "address_context.prefix", op: "exists" }` constraint로 좌표 누락 감지

## Codegen 파이프라인

### Catalog 기반 codegen (권장)
```bash
qa-sdk codegen --catalog ./my-catalog.ts [--dkg-config ./my-dkg.ts] --output ./generated
```
- 입력: Catalog (`.ts`/`.js`/`.json`) + DkgConfig (선택)
- 출력 (7개 파일):

| 파일 | 내용 |
|------|------|
| `prefix-ids.ts` | `PrefixId`, `AxisId`, `TableId` 리터럴 유니온 + const 배열 |
| `axes.ts` | 축별 `const ROLE = { ADMIN: "admin", ... } as const` + `type Role` 유니온 |
| `dims.ts` | prefix별 dimension interface (`PermissionDims { role: Role; }`) + `PrefixDimsMap` |
| `dsl.ts` | DSL bundle members/invariants/fixedDims const (DkgConfig 제공 시) |
| `sdk-factory.ts` | `createIndexSDK(SCHEMA)` 사전 구성. `sdk.encode("permission", ...)` 자동완성 |
| `context-types.ts` | `TypedQaContext = QaContext<PrefixId>`. prefix 자동완성 |
| `index.ts` | barrel export |

- `--catalog` 미지정 시 `loadCatalog()` 우선순위: `--catalog` → `qa-sdk.config.ts` → `DEMO_CATALOG`
- `--dkg-config` 미지정 시 `loadDkgConfig()` 우선순위: `--dkg-config` → `qa-sdk.config.ts` → `DEMO_DKG_CONFIG`

### SchemaSnapshot 기반 codegen (레거시)
```bash
qa-sdk codegen --input ./snapshot.json --output ./generated --format ts,proto
```
- 입력: SchemaSnapshot JSON (flat, axis dims만)
- 출력: 단일 `.d.ts` 또는 `.proto`
- 하위 호환 유지. 신규 프로젝트는 Catalog 기반 사용 권장

### 버전 관리 옵션
- `--lock-version v1` — 모든 prefix를 특정 version으로 고정. 생성 파일의 `VERSION_META.prefixVersions`에 반영
- 미지정 시 `latestPrefixVersion()` 기준 (latest)

### 생성 메타데이터
- `VERSION_META.contentHash` — Catalog 구조의 SHA-256 prefix 12자. 같은 구조 → 같은 hash
- `VERSION_META.prefixVersions` — prefix별 생성 시점 version (빌드 고정)
- `VERSION_META.generatedAt` — ISO 8601 생성 시각
- `GENERATION` — `"catalogId:contentHash"` 형식. SDK 부트 시 `QaContextConfig.generation`에 전달하면 catalog 불일치 경고
- `SNAPSHOT_SUPPLY` — prefix별 스냅샷 전략 (`"envelope"` | `"implicit"`)

### 생성 파일 사용 예시
```typescript
import { sdk, type TypedQaContext, GENERATION, VERSION_META } from "./generated";

// createIndexSDK 자동완성
const addr = sdk.encode("permission", { role: "admin", action: "read" });

// QaContext — generation 검증 포함
const qa: TypedQaContext = createQaContext({
  catalog: DEMO_CATALOG,
  generation: GENERATION, // catalog 불일치 시 경고
  serviceConfig: { namespace: "shop", name: "web", env: "prod", region: "asia" },
});
qa.encode("permission", { role: "admin" }); // prefix 자동완성
```

### Migration Test
- `testMigration(catalog, prefixId, fromVersion, toVersion)` — encode(v_old) → decode(v_new) 라운드트립 검증
- stride-break, entry 누락 등 조기 감지

## Build
- `pnpm --filter <pkg> build` — 개별 패키지 빌드
- weighted-index DTS 빌드에 기존 에러 있음 (calc.js exports); ESM/CJS는 정상
- platform-demo tsc 우회: `pnpm --filter platform-demo exec vite build --mode development`

## Package Structure

### SDK 구조 (3분할)
- `@qa-sdk/logger`: QaLogger, Transport, TraceContext, Masking (core만 의존)
- `@qa-sdk/codec`: createIndexSDK, DimWireCodec (core + weighted-index)
- `@qa-sdk/context`: createQaContext, CatalogProvider (core)
- `@qa-sdk/sdk`: 3개를 re-export하는 facade (하위 호환)
- `@qa-sdk/apm`: ApmLogger — QaLogger + PartialBinder 통합. `createApmLoggerFromBoot(ApmBootConfig)` — ServiceBootConfig 기반 편의 팩토리
- `@qa-sdk/browser`: QaMonitor — 브라우저 전용 SDK + `qa-browser-sdk.js` 독립 번들
  - `createQaMonitor({ serviceConfig, ingestUrl, autoCapture })` — 동기 생성 (정적 catalog)
  - `createQaMonitorAsync({ registry })` — 비동기 생성 (registry에서 최신 catalog fetch)
  - `emitWithCoords(eventKey, prefixes)` — 좌표 인코딩 + 전송 한 번에
  - `emit(eventKey, payload, { address_context })` — 수동 좌표 전달
  - `metric(name, value, { address_context })` — 메트릭 + 좌표
  - `serviceConfig` → infra_context 자동 생성 (BROWSER_CATALOG + toServiceDims)
  - encode/decode/track/BROWSER_CATALOG 내장 (viz-3d-core.js 불필요)
  - 번들: `qa-browser-sdk.js` (154KB ESM), `qa-browser-sdk.umd.cjs` (114KB UMD)
  - 복사 위치: `shop-web/public/qa-browser-sdk.js`

### weighted-index
- `packages/weighted-index/src/index.ts` — 모든 public export 관리; 새 함수 추가 시 여기도 업데이트
- `packages/weighted-index/src/calc.ts` — `calcWeights()`가 stride 공식의 **canonical 구현**. `WeightedIndex` 생성자가 이를 호출
- `packages/weighted-index/src/layout-fit.ts` — 레이아웃 시뮬레이터 순수 함수 (Number/BigInt 모드)
- `packages/weighted-index/src/bit-field-layout.ts` — 비트 레벨 가변 폭 필드 패킹 (hex-char 4비트 경계 대신 정확한 비트 경계)
- `packages/weighted-index/src/bitmask.ts` — O(1) 비트마스크 연산 (createMask, setBit, hasBit, maskAnd/Or, popcount)
- `packages/weighted-index/src/partial-binder.ts` — 차원 부분 바인딩 (createBinder → resolve)
- `packages/weighted-index/docs/partial-binder.md` — PartialBinder 상세 문서

### bit-index
- `packages/bit-index/` — 차원별 비트 패킹 인덱스 (weighted-index 의존)
- `src/bit-index.ts` — `BitIndex`(Number) / `BitIndexBig`(BigInt): O(1) 차원 추출, WeightedIndex와 병행
- `src/bridge.ts` — `IndexBridge`: WeightedIndex ↔ BitIndex 좌표 기반 양방향 변환
- `src/bit-mask-set.ts` — `BitMaskSet`: BitIndex 기반 Set<number> 권한 관리 + 차원 필터 + Base64 직렬화
- mixed-radix 대비: 공간 약간 큼 (Σ⌈log₂ shape[i]⌉ vs ⌈log₂ Π shape⌉), 대신 shift+mask로 개별 차원 즉시 접근
- bitmask 프리미티브는 weighted-index에서 re-export (순환 의존 방지)

### permission-engine
- `packages/permission-engine/` — 비트마스크 기반 권한 엔진 (weighted-index + bit-index 의존)
- `src/permission-set.ts` — [feature, role] binary bitmask 인코딩, O(1) grant/check
- `src/permission-codec.ts` — 3-tier 프로토콜 코덱 (text ↔ integer ↔ bitmask). 내부적으로 `LabelRegistry`에 위임하여 string→index 맵 구축
  - BitIndex 최적화: `bitIndex`, `bridge` (lazy), `toBitMaskSet`/`toUint8Mask` 변환, `filterGrants` 차원 필터
  - `PermissionView` — 캐시된 BitMaskSet 기반 필터 뷰 (createView 1회 → 이후 filter 4~6× 빠름)
- `src/ternary-mask.ts` — 3-state 마스크 (-1=deny, 0=unset, 1=allow) + 계층 상속
- partial-binder는 weighted-index에 위치, permission-engine에서 re-export
- `src/scoped-engine.ts` — env/region 등 외부 컨텍스트별 독립 마스크 관리
- `src/migration.ts` — shape 변경 시 마스크 마이그레이션 (ID 매칭 자동 변환 또는 커스텀 CoordMapper)
- `src/resource.ts` — resource 정규화/검증 (canonical path-like key, 타입별 패턴 규칙)
- `src/service-ref.ts` — 서비스 참조 (namespace/name) + SDK 글로벌 컨텍스트 (env/build/region 숨김). `@qa-sdk/core` `ServiceBootConfig`과 구조적 호환 (TypeScript structural typing)
- `src/permission-code.ts` — 전체 permission address: `{service-ref}.{type}.{resource}.{action}`

### demo-snapshot — 통합 카탈로그 (DEMO_CATALOG)
- `packages/demo-snapshot/src/demo-catalog.ts` — **SSOT**: 타입 정의 + DEMO_CATALOG 상수 (74축, 39 prefixes, 6 tables)
  - `VersionedAxis`: 버전별 entries/capacity/ko
  - `DimRef` 3종: `axis` (enum 직접) / `prefix_ref` (다른 prefix 주소) / `table_ref` (DB 테이블 타입 참조)
  - `PrefixDef`: N-D 주소 공간 (축 조합 + 버전별 axis version 핀)
  - 이벤트 prefix: cart_event, auth_event, order_event (table_ref + axis + prefix_ref 조합)
  - 인프라 prefix: deploy_event, health_event (svc_ref + action/status)
  - 파이프라인 prefix: pipeline_point, data_policy, engine_event, schema_event
  - 빌드/테스트 prefix: build_event, test_event (qa_pkg, qa_module 축)
  - DKG 자기참조 prefix: dkg_event (dkg_op × dkg_target_kind), dkg_decision_event (decision_type × dkg_target_kind × node_source), dkg_observation_event (obs_source × dkg_target_kind × lifecycle_state)
  - 계약 검증 prefix: contract_check (qa_pkg × api_surface × test_result)
  - 패턴 분류 prefix: pattern_match (svc_ref × identification_mode × behavior_pattern × pattern_confidence), pattern_anomaly (svc_ref × anomaly_kind × behavior_pattern × anomaly_severity)
- `packages/demo-snapshot/src/catalog-builder.ts` — refEntries 의미 정의 (PERM_SVC_MEANING, EVT_SVC_MEANING 등)
  - SSOT 체인: `_axes.capacity` → `_S` shape → `_sStrides` → `_svcAddr()` → `DEMO_CATALOG`
- `packages/demo-snapshot/src/demo-accessors.ts` — 선택적 접근 + 차원 합성·분해·의미 해석
  - `getPrefixStructure/Shape/Entries` — 3단계 조회
  - `encodePrefix/decodePrefix` — 차원 좌표 ↔ 1D 주소
  - `encodePrefixByValue` — 의미값(entry string / ref address)으로 인코딩
  - `resolveAddress` — 재귀 의미 해석 (prefix_ref → 참조 prefix까지 풀어냄)
  - `decomposeAddress` — 차원 분해 (prefix_ref의 하위 좌표 포함)
  - `verifyRoundTrip` — 전 범위 encode↔decode 정합성 검증
- 모든 runtime 함수(`encodePrefix`, `decodePrefix`, `resolveAddress` 등)는 `@qa-sdk/core/catalog/runtime.ts`가 canonical 구현. demo-accessors는 core를 re-export하는 하위 호환 레이어
- `packages/demo-snapshot/src/demo-compat.ts` — DEMO_CATALOG에서 기존 상수/함수 파생 (하위 호환)
- `packages/demo-snapshot/src/demo-bridge.ts` — 외부 시스템 변환 (catalogToRegistryInput, catalogToPrefixCodecInput)
- 의존 방향: demo-catalog → demo-compat → demo-snapshot/demo-domains (순환 금지)
- axis ID 충돌 주의: catalog `rbac_role` ≠ `role` (쇼핑). compat에서 AXIS.role로 매핑.

### demo-types — codegen 생성 타입 패키지
- `packages/demo-types/` — `qa-sdk codegen --output` 으로 자동 생성. 직접 수정 금지
- 빌드: tsc → ESM only
- 생성물: `PrefixId`(39), `AxisId`(74), `TableId`(6) 리터럴 유니온 + `PREFIX_IDS`/`AXIS_IDS`/`TABLE_IDS` const 배열
- `sdk`: 타입 안전 encode/decode 팩토리 (DEMO_CATALOG 스키마 내장)
- `VERSION_META`: catalogId + contentHash + generatedAt + prefixVersions
- `GENERATION`: `"demo:hash"` 형식 빌드 시점 식별자
- `DSL_*` const: DSL 번들별 멤버 prefix + fixedDims
- `TypedQaContext`: 타입 안전 QaContext (PrefixId 유니온)
- 의존: `@qa-sdk/codec`, `@qa-sdk/context` (런타임). demo-snapshot에 대한 런타임 의존 없음 (1-way 생성)
- 재생성: `pnpm --filter demo-types generate`

### viz-3d — 3D 좌표계 시각화 + 브라우저 코덱
- `packages/viz-3d/` — Three.js 기반 3D 좌표 시각화 + 브라우저 전용 encode/decode 단일 출처
- 빌드: tsup → `dist/core.js` (ESM 번들, Three.js 무의존)
- **core/**: grid-builder, split-pattern(7종), color-tokens, signal-model, prefix-meta, cross-view
- **adapter/**:
  - `browser-codec.ts` — **단일 출처 encode/decode**: `encode()`, `decode()`, `track()`, `trackWithSignal()`
  - `demo-catalog-browser.ts` — BROWSER_CATALOG (DEMO_CATALOG의 브라우저 경량 사본)
  - `catalog-loader.ts` — 런타임 카탈로그 로딩: API → localStorage 캐시 → Static fallback
  - `monitor-adapter.ts` — WebSocket ↔ 셀 매핑 어댑터
- **view/**: ViewEngine(layer/category/dsl/service 4모드 전환), service-scope(4-tier 서비스 계층)
- **effects/**: CellStateManager, BeamPool, ActivationProcessor
- **renderer/**: InstancedMesh, LOD(near/mid/far), PerfMonitor, FlowHistory
- **matrix/**: matrix-stack (스택 축 레이아웃)
- **색상 토큰 체계** (`core/color-tokens.ts` — SSOT):
  - `PALETTE`: 배경/텍스트/액센트 기본 색상
  - `CATEGORY_COLORS`: prefix 존재론적 성격별 색상 (observation/event/policy/entity/state/relation/table). 노드 기본 색상에 사용
  - `ROLE_COLORS`: Signal Role별 색상 (context/trigger/channel/state/guard/effect/data). 선(beam)/반짝임(glow)/타임라인에 사용
  - `LAYER_COLORS`: 레이어별 색상 (L0 UI/L1 Business/L2 Infra/L3 Data)
  - `generateCssVariables()`: `--cat-*`, `--role-*`, `--layer-*` CSS 변수 자동 생성
  - 색상 변경 시: color-tokens.ts 수정 → `pnpm --filter @qa-sdk/viz-3d build` → 번들 복사
- 번들 복사 위치: `platform-demo/public/viz-3d-core.js`, `shop-web/public/viz-3d-core.js`

### shop-web — 쇼핑 데모 사이트
- `packages/shop-web/public/index.html` — 8개 상품, 해시 라우팅, 13개 트래킹 포인트
- `qa-browser-sdk.js` 단일 import — encode/decode + QaMonitor + ID 생성 통합
- `createQaMonitor({ serviceConfig })` → infra_context 자동 + BeaconTransport + sessionStorage 세션
- `emitWithCoords(eventKey, prefixes)` — 좌표 인코딩 + 전송 1줄
- autoCapture: clicks + navigation 자동 수집
- viz-3d-core.js는 3D 모니터링 시각화 전용 (SDK 기능은 qa-browser-sdk.js에 통합)

### platform-demo — 데모 + 모니터링 + 다이어그램
- `packages/platform-demo/` — Vite SPA + static HTML 페이지 (Cloudflare Pages 배포)
- dev 서버: `pnpm --filter platform-demo dev` → `http://localhost:5176/`
- **SPA** (`/`): 14개 시트 — overview, range, access, service, permission, event, scenario 등
- **Monitor** (`/monitor.html`): 3D 모니터링 대시보드 (InstancedMesh, LOD, 4-view 모드)
  - 노드 색상: CATEGORY_COLORS (존재론적 성격)
  - 선/반짝임: ROLE_COLORS (Signal Role)
  - encode/decode는 viz-3d-core.js에서 import (인라인 코드 없음)
- **Diagram** (`/diagram.html`): Mermaid 다이어그램 뷰어 + 줌/팬
  - 프리셋: IntentLink, DSL, Domain, Service, Constraint, Table(ER), Transition Spec, Transition DAG, Observation Loop
  - 줌: 휠/Ctrl+±/버튼, 팬: 드래그/터치, Fit: 자동 스케일링
  - 커스텀 입력: textarea + Ctrl+Enter
  - URL 상태: `?preset=IL-checkout-flow` (새로고침 복원)
  - Copy MMD / Download SVG
- **프리셋 생성**: `pnpm --filter platform-demo exec tsx scripts/generate-diagram-presets.ts`
- **번들 복사**: `viz-3d/dist/core.js` → `platform-demo/public/viz-3d-core.js`
- 3페이지 공유 nav bar: Demo | Monitor | Diagram

### @qa-sdk/convergence — 수렴 분석 (독립 패키지)
- `packages/convergence/` — spec-core에서 물리 분리됨. `@qa-sdk/core` + `weighted-index`만 의존
- DKG 타입 부분집합 (`dkg-types.ts`), GraphPort, decision-scaffold를 자체 포함 (spec-core 역의존 없음)
- `collectMetrics`의 `auditSchemaHealth` 의존은 optional injection으로 분리 (`schemaHealthAuditor` 옵션)
- 5개 분석 서비스 + 집계/측정/필터/기록/패턴 분류
  - `symbol-comparator.ts` — 축/prefix Jaccard 유사도 비교 (merge/alias/review 판정)
  - `decision-comparator.ts` — Decision 충돌 스캔 (contradictory/redundant/superseding)
  - `causal-discovery.ts` — co-occurrence → 인과 후보 + Observation 노드 생성
  - `simplification-advisor.ts` — 미사용 차원/저사용 entry/과도 headroom 감지
  - `boundary-recommender.ts` — 새 prefix 경계 추천 (split/extends/independent)
  - `convergence-runner.ts` — `runConvergenceAnalysis()` 5개 서비스 단일 진입점
  - `self-check-analyzer.ts` — `analyzeSelfCheck()` 순수 함수 + `generateSyntheticEvents(catalog)` 자동 합성
  - 집계: usage-aggregator, scoped-aggregator / 측정: entry-coverage, temporal-analysis, deployment-skew / 기록: metric-registry

### spec-core — 설계 지식 그래프
- `packages/spec-core/` — DKG(Design Knowledge Graph) + 전파 파이프라인. convergence는 `@qa-sdk/convergence`로 분리
- 서브 경로 exports: `"."` (shared+schema+spec), `"./dkg"` (DKG 그래프+스킬), `"./convergence"` (re-export from @qa-sdk/convergence), `"./store"` (SQLite), `"./codegen"`, `"./propagation"`, `"./viz"`, `"./analysis"` (deprecated — ./dkg + ./convergence 사용)
- **dkg/**: bootstrapDkg(6 도메인, 11 DSL 번들, 32 skill, 7 spec), service-topology(7 서비스, 3 계약), **TableNode(15번째 노드 타입)**
- **propagation/**: spec 작성 → registry 고정 → 소비자 전파 → codegen → DKG 기록
  - `activation-gate.ts` — `checkActivationReadiness(graph, prefixId, options)`: 활성화 전 constraint/observation/domain-health 검사
- **store/**: DkgSqliteStore (persist + migrate)

### GraphPort 3단 추상화
- 하나의 그래프 저장소에 대해 소비자마다 노출 범위를 달리하는 의존성 역전 구조
- **GraphPort** (`shared/graph-port.ts`): convergence/schema 내부용. `GraphNodeLike` (`{ kind, id }`) 반환. DkgNode를 import하지 않음
- **GraphRegistryPort** (`ingest-server/types/`, `registry-service/types/`): 서비스 동적 import용. `getAllNodes()` + `getNodesByKind()` 2메서드. spec-core가 optional peer이므로 정적 타입 불가
- **GraphRegistry** (`dkg/graph-registry.ts`): CLI/skills용 구체 구현. `getNodesByKind<K>()` → `Extract<DkgNode, { kind: K }>` 타입 안전 반환. Table 질의, cascade, constraint 등 전체 API
- 설계 원칙: Port는 얇게 (kind/id만), 구현은 풍부하게 (15종 노드 구체 필드). convergence가 DKG 타입에 결합되지 않음

### DKG Table 의존 추적
- `TableNode` (14번째 DKG 노드): catalog의 `tables` 섹션에서 자동 파생. `kind: "table"`, `columns: string[]`
- `catalog-derive.ts`가 `catalog.tables` 순회 → TableNode 생성 + column-level 엣지:
  - column `axis_ref` → `composes` 엣지 (dimKind: "column_axis")
  - column `prefix_ref` → `references` 엣지
  - column `table_ref` (FK) → `references` 엣지 (meta: `{ fk: true }`)
- prefix → table 연결: prefix의 `table_ref` dim → `composes` 엣지 (dimKind: "table_ref") — 기존과 동일
- `GraphRegistry` 질의 API:
  - `getPrefixesForTable(tableId)` — 테이블을 참조하는 prefix 목록
  - `getTablesForPrefix(prefixId)` — prefix가 참조하는 테이블 목록
  - `getTableColumnRefs(tableId)` — 컬럼별 참조 대상 (axis/prefix/FK)
  - `cascadeFromTable(tableId)` — 테이블 변경 시 영향받는 prefix + FK 참조 테이블
- `ServiceTopologyRegistry` 추론 API:
  - `getTablesForService(serviceId, graph)` — 서비스가 접근하는 테이블 (prefix 소유 관계에서 추론)
  - `getServicesForTable(tableId, graph)` — 테이블에 접근하는 서비스
- CLI:
  - `dkg tables` — 전체 테이블 목록 (cols, prefixes, services, fk, axis_ref 요약)
  - `dkg table <id>` — 개별 테이블 프로파일 (컬럼 참조, prefix, FK, 서비스, impact summary)
- DEMO_CATALOG에 6개 테이블 정의: members, orgs, items, orders, carts, cart_items

## Permission Engine Architecture

### 3-tier 프로토콜 스택
- Tier 1 (text): `"shop/payment.api.admin/teams.GET"` — 로그, 디버그, 설정 파일
- Tier 2 (1D integer): `"perm:42"` — DB 저장, 이벤트 태깅, 서비스간 전송 (index-meta의 SemanticAddress 호환)
- Tier 3 (bitmask): `Uint8Array` — 클라이언트 JWT/세션, O(1) can() 체크
- PermissionCodec이 Tier 1 ↔ 2 ↔ 3 변환을 담당; version 없이 `perm:42` 단축형도 지원

### 마스크 체계
- Binary mask (PermissionSet): 0/1 per slot — 단순 grant/deny
- Ternary mask (TernaryMask): -1/0/1 per slot — deny/unset/allow 3-state
  - 계층 상속: `TernaryMask.inherit(org, team)` → child 우선 + deny-wins
  - `toBinaryMask("deny")` → 클라이언트 전송 시 binary로 flatten
  - 크기: binary의 2배 (allow mask + deny mask), 클라이언트에는 binary만 전송

### BitIndex 최적화 레이어
- `PermissionView = codec.createView(mask)` — mask 1개당 1회 변환, 이후 필터 4~6× 빠름
- `PermissionView.applyGrant/applyRevoke` — 재생성 없이 O(1) 점진적 패치
- `PermissionViewCache` — 서비스용 캐시 매니저 (LRU + Singleflight + 점진적 패치)
  - `get(key)` → cache hit O(1) / miss → loadMask → createView → 캐시
  - `applyGrant/applyRevoke(key, ...)` → 캐시된 view에 O(1) 패치 (재생성 없음)
  - `invalidate(key)` / `invalidateByDim(label, value)` / `invalidateAll()` — 3단계 무효화
  - Singleflight: 동시 get(same key) → loadMask 1회만 실행
  - S6 벤치: 100 유저 × 100 요청, hitRate 99%, ~880K ops/s
- 단건 check는 기존 `checkRaw`(WI+hasBit)이 더 빠름 (126ns vs 225ns)
- 반복 필터는 `view.filter()`가 유리 (5조건 반복 시 5.1× 빠름)
- sparse 직렬화(JWT 등)는 `BitMaskSet.toBase64()`가 Uint8Array보다 작음 (1% 부여 시 3× 절약)

### 차원 부분 바인딩 (PartialBinder)
- 전체 경로: `namespace > name > env > device > region > shard > resource > action`
- SDK 부트 시 고정 차원 캐시: `createBinder(codec, "full", { namespace, name, env, device })`
- 런타임에 나머지만 입력: `binder.resolve({ region, shard, resource, action })`
- 체이닝 지원: `binder.bind({ region, shard }).resolveId({ resource, action })`
- 원리: mixed-radix에서 각 차원 기여분이 독립적이므로 분리 계산 후 합산 가능 (partialQueryBase 참조)
- PrefixCodec 연동: 라벨 기반 엔티티 ID → 1-based 인덱스 변환을 내부 수행
- 멀티서비스: 같은 codec + 다른 binder로 서비스별 독립 주소 공간

### 설계 원칙
- 클라이언트는 role을 직접 확인하지 않음 — 서버가 role → flat permission mask로 resolve 후 전송
- 외부 차원 (env/region/namespace) → ScopedEngine scope key 또는 PartialBinder로 관리
- service-ref: (namespace/name) 필수 + (env/build/region) SDK가 일괄 설정하여 숨김. `ServiceBootConfig`이 통합 진입점
- resource 규칙: 소문자, `/` 구분, leading/trailing slash 금지, depth ≤ 4, `:param` 패턴 허용
- permission code: `{service-ref}.{type}.{resource}.{action}` (예: `shop/payment.api.admin/teams.GET`)
- type별 패턴: page(param 금지/depth 3), api(param 허용/depth 4), action(param 금지/depth 3)

### 인코딩 선택 기준
- **DB 저장 + 범위 질의** → WeightedIndex (calcAddressRanges → BETWEEN 연속 구간)
- **인메모리 필터 + 캐시 키** → BitIndex (extractDim O(1), shift 그룹핑)
- **양쪽 다 필요** → IndexBridge로 좌표 기반 양방향 변환

### SQLite 드라이버 분리
- `NodeSqliteDriver` (`node-sqlite-driver.ts`) — `node:sqlite` 내장, native 빌드 불필요. 로컬 개발/CI 테스트용
- `BetterSqliteDriver` (`better-sqlite-driver.ts`) — `better-sqlite3` npm, 프로덕션 Node.js 서버용
- `D1SqlDriver` (`d1-driver.ts`) — Cloudflare D1 엣지용
- `createSqliteDriver(options)` — 팩토리. `{ driver: "node"|"better", path, schema }` 런타임 선택
- 생성자 `schema` 파라미터: 생략 시 index-meta 전체 DDL, `null` 전달 시 bare driver (서비스별 자체 스키마 적용)
- 서비스별 env 설정: `SQLITE_DRIVER` (node|better) — gate-service, query-service만 지원. registry-service는 NodeSqliteDriver 고정
- `SQLITE_PATH` — 서비스별 분리 (gate-service.sqlite, query-service.sqlite 등). registry-service 기본값 `:memory:` (운영 시 반드시 설정)
- DkgSqliteStore `catalog_id` 컬럼: dkg_nodes/dkg_edges에 마이그레이션 자동 추가. 기본값 "demo". 멀티 카탈로그 격리용
- 서비스 포트 레지스트리: ingest(3200), registry-service(3300), gate(3400), query(3500), decode(3600). 각 서비스 시작 시 충돌 경고

### index-meta 연동 (1D 주소 저장)
- 1D integer address → index-meta의 EntryFlagStore (active/inactive, append-only 이력) 활용 가능
- AddressStateStore: 범위 기반 상태 캐시 (reserved/inactive/open)
- GateEngine: 상태 변경 시 cascade 전파 (leaf → composite)
- PrefixCodec의 composite ref로 그룹별 독립 인코딩 → 통합 주소 구성 가능

## Signal Model
- Signal = 1회 qaTrack() 호출 = 하나의 의미 있는 순간
- 7 SignalRole: context(배경), trigger(사용자 행위), channel(전송 경로), state(흐름 상태), guard(권한), effect(부수 효과), data(데이터 참조)
- prefix → SignalRole 매핑: service→context, tracking→trigger, endpoint→channel, flow_point→state, permission→guard, pipeline_point→effect, orders→data
- Signal chain: requires 관계로 의존 표현 (예: trigger는 context를 require)
- DEMO_SIGNALS 13종: auth.login, page.view, page.home, page.product, page.mypage, page.order_complete, api.call, cart.add, checkout.entry, checkout.process, payment.success, auth.logout
- 구현: `viz-3d/src/core/signal-model.ts` (`getPrefixRole()`, `classifyByRole()`, `validateSignal()`)
- 색상: `viz-3d/core/color-tokens.ts`의 `ROLE_COLORS`가 Signal Role별 색상 SSOT
- 시각화: monitor.html에서 노드=CATEGORY_COLORS, 선/glow=ROLE_COLORS로 이중 표현

## Observation Loop (관측 루프)

런타임 이벤트 → 자동 분석 → DKG 기록 → 활성화 게이트의 폐루프 아키텍처.

### 파이프라인 흐름
```
ingest-server Phase 2 완료
  → ConvergencePipelineRunner.notifyCompletion(traceIds)
  → 버퍼 축적 (threshold 100건 or timer 60초)
  → recordStore.findByTraceId() → AddressContextRecord[]
  → aggregateUsageData(catalog, records)
  → collectMetrics(catalog, graph, usageData)
  → metricsToObservations(metrics)
  → DkgSqliteStore.saveUsageSnapshotWithObservations()
```

### 구성 요소

| 모듈 | 패키지 | 역할 |
|------|--------|------|
| `convergence-pipeline.ts` | ingest-server | Window-based 배치 처리, Phase 2 후단. 패턴 분류 단계 포함 |
| `convergence-graph-provider.ts` | ingest-server | Lazy DKG graph/catalog 초기화 (동적 import, catalog 주입 지원) |
| `convergence-scheduler.ts` | ingest-server | 주기적 강제 flush (저트래픽 대응) |
| `activation-gate.ts` | spec-core/propagation | `checkActivationReadiness()` 순수 함수 |
| `activation-gate-adapter.ts` | registry-service | ActivationGatePort 어댑터 (fail-open) |
| `post-activation-hook.ts` | registry-service | 활성화 후 VersionEvent 자동 기록 |

### 패턴 분류 파이프라인 (convergence pipeline 내장)
- convergence pipeline flush 시 자동 실행 (patternFns 주입 시)
- 흐름: sessionId별 그룹핑 → classifyPattern(세션) → aggregatePatternStats → detectAnomalies → observation 변환
- `PatternFunctions`: classifyPattern, aggregatePatternStats, detectAnomalies, buildPatternHealthReport, patternRules
- 이전 윈도우 통계를 `previousPatternStats`로 보관하여 비율 급변(ratio_shift) 감지
- observation ID: `OBS-PATTERN-{anomaly_kind}-{date}` (날짜 단위 멱등)
- 에러 격리: 패턴 분류 실패가 metric pipeline을 차단하지 않음
- `ConvergenceFlushResult.pattern`: sessionsClassified, anomaliesDetected, classificationRate

### 패턴 분류 관련 prefix/축 (ADR-006)
- `pattern_match` prefix: svc_ref × identification_mode × behavior_pattern × pattern_confidence
- `pattern_anomaly` prefix: svc_ref × anomaly_kind × behavior_pattern × anomaly_severity (v2: 4차원 확장)
- 축: `anomaly_kind` (6종: unclassified/ratio_shift/volume_spike/new_sequence/abnormal_speed/abnormal_duration)
- 축: `anomaly_severity` (3종: info/warning/critical)
- DKG constraint: CON-004 (classificationRate >= 80%), CON-005 (critical anomaly → auto observation)
- DKG consumer: convergence-pipeline (pattern_match, pattern_anomaly 소비)
- DKG skill: skill-pattern-analysis (분류 + 이상 감지 조합)

### Observation 멱등성
- metric observation ID는 결정적: `OBS-METRIC-{metric.id}` (timestamp 없음 → upsert 덮어쓰기)
- pattern observation ID는 결정적: `OBS-PATTERN-{anomaly_kind}-{date}` (날짜 단위 멱등)
- `resolveRecoveredMetrics()`: metric이 ok로 복귀하면 이전 observation을 자동 해소
- `cleanStaleMetricObservations()`: 이전 timestamp 기반 잔여 observation 자동 정리
- `converge --persist` 반복 실행 시 observation 수 고정 (누적 안 함)

### 환경변수

| 변수 | 기본값 | 패키지 | 설명 |
|------|--------|--------|------|
| `CONVERGENCE_ENABLED` | `false` | ingest-server | convergence 파이프라인 활성화 |
| `CONVERGENCE_FLUSH_INTERVAL_MS` | `60000` | ingest-server | 타이머 기반 flush 주기 |
| `CONVERGENCE_RECORD_THRESHOLD` | `100` | ingest-server | 건수 기반 flush 임계값 |
| `CONVERGENCE_DKG_SQLITE_PATH` | — | ingest-server | DKG SQLite 경로 |
| `CONVERGENCE_SCHEDULE_INTERVAL_MS` | `300000` | ingest-server | 스케줄러 주기 |
| `CONSTRAINT_GATE_ENABLED` | `false` | registry-service | 활성화 게이트 사용 |
| `CONSTRAINT_GATE_MODE` | `"warn"` | registry-service | "strict" = 차단, "warn" = 진단만 |
| `CONSTRAINT_GATE_DKG_PATH` | — | registry-service | DKG SQLite 경로 |
| `POST_ACTIVATION_HOOK_ENABLED` | `false` | registry-service | 활성화 후 DKG 기록 |
| `POST_ACTIVATION_DKG_PATH` | — | registry-service | DKG SQLite 경로 |
| `TRACE_DATABASE_URL` | — (필수) | ingest-server | PostgreSQL 연결 URL |
| `REDIS_URL` | — | ingest-server | TASK_QUEUE_ENABLED=true 시 필수 |
| `REGISTRY_URL` | — | ingest-server | 스키마 검증용 레지스트리 URL |
| `REGISTRY_VALIDATION_MODE` | `"warn"` | ingest-server | strict/warn/off |
| `SQLITE_PATH` | `":memory:"` | registry-service | SQLite 경로 (운영: 반드시 설정) |
| `DATABASE_URL` | — (필수) | ingest-server (TRACE_DATABASE_URL) | PostgreSQL 연결 URL |
| `GATE_SERVICE_URL` | — | query-service | gate-service 연동 URL |
| `QUERY_DEFAULT_STRATEGY` | `"most-specific"` | query-service | 질의 전략 |
| `QUERY_GATE_FAILURE_MODE` | `"fail-open"` | query-service | gate 실패 시 동작 |
| `DECODE_MAP_SOURCE` | — | decode-service | DecodeMap JSON 파일/URL |
| `CACHE_TTL_MS` | `60000` | decode-service | 디코더 캐시 TTL (ms) |
| `TRANSITION_ENGINE_ENABLED` | `false` | ingest-server | Phase 2.5 전이 엔진 활성화 |
| `TRANSITION_VIOLATION_MODE` | `"warn"` | ingest-server | strict=위반 시 에러, warn=로깅만 |
| `TRANSITION_STATE_PATH` | — | ingest-server | SqliteStateStore 경로 |
| `CATALOG_ID` | `"demo"` | ingest-server | 패턴 규칙 registry fetch 시 카탈로그 ID |

### CLI 통합
- `qa-sdk dkg converge [--persist] [--verbose]` — metrics + convergeChain + systemHealthChain 통합 실행
- `--persist`: 결과를 DKG store에 자동 저장 + auto-resolve + stale 정리
- `--verbose`: 개별 observation/action 상세 출력 + 미해결 observation top-3 안내

### Converge Chain — 분리 결정 자동 억제
- `convergeChain()`의 merge 제안 시 기존 DEC-SEP/DEC-MERGE 결정을 자동 확인
- `hasActiveSeparationDecision(graph, a, b)`: `DEC-SEP-{a}-{b}` / `DEC-MERGE-{a}-{b}` 양방향 ID 탐색
- `lifecycle === "active"` 결정만 억제. superseded/reversed 결정은 재검토 허용
- axis merge + prefix merge 양쪽 경로에 적용
- 예: `initiator↔channel`(DEC-SEP), `dkg_target_kind↔cli_subject`(DEC-MERGE) — 기존 분리 결정으로 merge 제안 자동 억제

### Mermaid 다이어그램 생성
- `qa-sdk dkg diagram list` — 사용 가능한 다이어그램 목록
- `qa-sdk dkg diagram intent-links [IL-id]` — IntentLink 시퀀스
- `qa-sdk dkg diagram dsl <dsl-id>` — DSL 번들 시퀀스
- `qa-sdk dkg diagram domain <dom-id>` — 도메인 prefix 시퀀스
- `qa-sdk dkg diagram service <svc-id>` — 서비스 소유/소비 관계
- `qa-sdk dkg diagram constraint <CON-id>` — 제약 대상
- `qa-sdk dkg diagram table <table-id>` — 단일 테이블 ER (컬럼 타입 + FK + prefix 참조)
- `qa-sdk dkg diagram table-er` — 전체 테이블 ER 다이어그램
- `qa-sdk dkg diagram transition-spec <TSPEC-id>` — 전이 spec 흐름 (match→input→output)
- `qa-sdk dkg diagram transition-dag` — 전이 간 관계 DAG (depends-on + satisfies)
- `qa-sdk dkg diagram observation-loop` — 관측→의사결정 루프
- `--output <path>` — 파일 출력
- `--format mmd|svg|png|html` — 출력 형식 (svg/png는 mmdc 필요)
- `--no-invariants` — invariant 주석 비표시
- 생성기: `spec-core/src/visualization/mermaid-gen.ts` (순수 함수, I/O 없음)
- 웹 뷰어: `platform-demo/public/diagram.html` (줌/팬 + Mermaid CDN 라이브 렌더링)
- API: `registry-service /api/diagrams` (목록 + 개별 생성)

### Dev Dashboard
- `DEV_DASHBOARD_ENABLED=true` → `http://localhost:3300/dev/` 접속
- **Flow Map**: Schema(74축) → Prefix(39개) → Consumer 3-layer 시각화. 노드 클릭 → 상세
- **Metrics**: 8종 metric 카테고리 카드 (headroom, skew, coverage, overlap, conflict, health, invariant, transition)
- **Timeline**: 의사결정/관측/버전 이벤트 시간순 (루프 닫힘 표시)
- **WebSocket**: `/dev/ws` — 10초 push (overview+metrics). 연결 끊기면 30초 폴링 fallback
- **카탈로그**: `/dev/api/catalogs` — 등록된 카탈로그 목록. CatalogStore 연동
- 환경변수: `DEV_DASHBOARD_ENABLED` (default: false), `DEV_DASHBOARD_DKG_PATH` (SQLite 경로)

### 런타임 이벤트 연결
- `store/src/db/schema.ts`에 `addressContext` jsonb 컬럼 추가 (event_records 테이블)
- shop-web의 13개 트래킹 포인트 → ingest-server → Phase 2.5(transition) + convergence pipeline → DKG store
- `CONVERGENCE_ENABLED=true` 설정 시 Phase 2 완료 후 자동 실행
- `TRANSITION_ENGINE_ENABLED=true` 설정 시 Phase 2.5 전이 매칭 활성화

### 관측 루프 자동 해소 (3가지 경로)
- **metric 복귀**: metric ok → `resolveRecoveredMetrics()` → OBS-METRIC 자동 resolve
- **skew 복귀**: severity ok → bootstrap refresh 시 OBS-SKEW 자동 resolve
- **metric→decision prompts**: `dkg converge --persist` 시 OBS-METRIC → 관련 Decision에 prompts 엣지 자동 생성
- 미해소: OBS-PATTERN, OBS-DSL-UNCOVERED는 수동 `dkg resolve` 필요

### 설계 원칙
- spec-core는 라이브러리 — ingest-server/registry-service에 정적 의존 없음
- 서비스는 동적 import (`ENABLED=true`일 때만) + optional peer dependency
- 에러 격리: convergence 실패가 Phase 2 verdict/활성화를 절대 차단하지 않음
- Fail-open: gate check 실패 → 허용 + warning diagnostic
- 멀티 카탈로그: provider에 `catalog` 파라미터 주입 가능 (기본: DEMO_CATALOG)
- Catalog 자동 갱신: seedDemoCatalog가 JSON hash 비교로 변경 감지 → 자동 update. SQLite 삭제 불필요

## Event Pattern Classification (ADR-006)
- **2축 분류**: identification_mode (anonymous/identified/pseudonymized/service) × behavior_pattern (12종)
- **PatternRule**: 선언적 규칙 정의 (requiredKeys, excludedKeys, requiredSequence, actorCondition, minIntervalMs)
- **DEMO_PATTERN_RULES**: 10개 기본 규칙 (bot_crawl, health_check, api_integration, purchase_complete, checkout_fail, error_recovery, cart_abandon, browse_only, anonymous_cart, anonymous_browse)
- **classifyPattern()**: `spec-core/convergence/pattern-classifier.ts` — 세션 이벤트 시퀀스 → PatternClassification
- **detectAnomalies()**: `spec-core/convergence/pattern-anomaly.ts` — 미분류/비율급변/볼륨급증/비정상속도/비정상시간
- **aggregatePatternStats()**: `spec-core/convergence/pattern-aggregator.ts` — 패턴별 빈도/비율/평균
- **PatternClassificationPort**: `ingest-server/lib/pattern-classification-port.ts` — 세션 close 시 비동기 분류 hook
- **좌표 매핑**: `pattern_match` prefix (svc_ref × identification_mode × behavior_pattern × pattern_confidence)
- **이상 감지**: `pattern_anomaly` prefix (svc_ref × behavior_pattern)
- **CLI**: `qa-sdk dkg patterns` (규칙 목록), `qa-sdk dkg pattern-stats` (통계)
- **활성화**: `PATTERN_CLASSIFICATION_ENABLED=true`
- **ActorContext.identification_mode**: actor_id/user_id/platform 기반 자동 판별 (`identifyActorMode()`)

## Catalog Generalization
- **Canonical types**: `@qa-sdk/core/catalog` (Catalog, PrefixMeta, CatalogProvider, DkgConfig)
- **CatalogRegistry**: `@qa-sdk/core/catalog` — 인메모리 Map<id, Catalog>. 멀티 카탈로그 런타임 관리. defaultId "demo"
- **DEMO_CATALOG**: demo-snapshot의 인스턴스. `id: "demo"`, `name: "쇼핑 데모"`. 25개 prefix에 `meta: PrefixMeta` 포함. `deepFreeze` 적용 (런타임 변경 방어)
- **DkgConfig**: bootstrap.ts의 하드코딩 데이터를 선언적 구조로 추출. `DEMO_DKG_CONFIG` (demo-snapshot)
- **bootstrapDkg**: `(options: { catalog, config, date? })` — catalog과 config 필수. 기본값 없음. CLI는 DEMO_CATALOG + DEMO_DKG_CONFIG 전달
- **deriveMeta**: `core/catalog/derive-meta.ts` — prefix.meta 있으면 사용, 없으면 구조 기반 추론
- **flattenForBrowser**: `core/catalog/browser-flatten.ts` — Catalog → BrowserCatalog 변환
- **BROWSER_CATALOG**: `viz-3d/scripts/generate-browser-catalog.ts` 자동 생성 (수동 동기화 제거)
- **CLI --catalog**: 글로벌 옵션. 우선순위: --catalog → CWD qa-sdk.config.ts → DEMO_CATALOG
- **CLI catalog list/info**: 등록된 카탈로그 목록/상세 조회 (CatalogRegistry 기반)
- **qa-sdk init**: 새 카탈로그 프로젝트 스캐폴딩 (인터랙티브 + --from demo)
- **parseSerializedAddress**: 3파트 (`perm:v1:42`) + 4파트 (`catalogId:perm:v1:42`) 주소 파싱. 6+ 파일의 `split(":")` 중앙화
- **DkgSqliteStore(catalogId)**: 단일 SQLite + `catalog_id` 컬럼으로 카탈로그별 DKG 격리
- **registry-service CatalogStore**: POST/GET/PUT/DELETE `/catalogs` CRUD 엔드포인트 (SQL + in-memory)
- **Profile API**: prefix/axis 단위 개별 PATCH (전체 blob 교체 대신 프로필 패치)
  - `PATCH /prefixes/:id` — category, meta, labels 병합 패치
  - `GET/PATCH/POST/DELETE /catalogs/:cid/axes/:id` — axis 프로필 CRUD
  - `POST /catalogs/:cid/axes/:id/entries` — entry 추가 (headroom 자동 검증)
  - 서버 시작 시 DEMO_CATALOG → catalog blob + axis 프로필 67개 자동 seed
  - 변경 시 `onCatalogChange`/`onAxisChange` 콜백 → dev dashboard `refresh()` 캐시 무효화
- **Catalog → Registry fetch**: `CONVERGENCE_REGISTRY_URL` 설정 시 graph provider가 API에서 catalog fetch (실패 시 static fallback)
- **core subpath exports**: `.` (전체), `./catalog` (Catalog 타입 + runtime 함수), `./platform` (QA 플랫폼 전용 타입/포트/서버 유틸)
- **catalog runtime 함수**: `encodePrefix`, `decodePrefix`, `encodePrefixByValue`, `resolveAddress`, `decomposeAddress`, `latestPrefixVersion` 등이 `@qa-sdk/core/catalog/runtime.ts`에 canonical 구현. demo-snapshot은 re-export
- 카탈로그가 유일한 입력이면 나머지는 전부 파생되어야 한다

## Browser Encode/Decode — @qa-sdk/browser-codec
- `@qa-sdk/browser-codec` — zero-dependency 독립 패키지. 브라우저 encode/decode의 **단일 출처**
- `encode()`, `decode()`, `track()`, `trackWithSignal()`, `decodeContext()` — mixed-radix 경량 구현
- `BROWSER_CATALOG` — DEMO_CATALOG에서 자동 생성된 경량 JSON. 직접 수정 금지
- `loadCatalog()` — 런타임 카탈로그 로딩: API → localStorage 캐시 → BROWSER_CATALOG(static) fallback
- 재생성: `pnpm --filter @qa-sdk/viz-3d prebuild` → `packages/browser-codec/src/demo-catalog-browser.ts`
- 소비자: `@qa-sdk/browser` (QaMonitor), `@qa-sdk/viz-3d` (3D 시각화), `shop-web`, `platform-demo`
- viz-3d/adapter/browser-codec.ts는 @qa-sdk/browser-codec re-export (하위 호환)
- 인라인 encode 코드 금지 — `import { track } from '@qa-sdk/browser-codec'` 사용

## Browser SDK — @qa-sdk/browser
- `qa-browser-sdk.js` — 브라우저 번들. QaMonitor + encode/decode + BROWSER_CATALOG 통합
- `viz-3d-core.js`는 3D 시각화 전용. SDK 기능(QaMonitor, emit, ID 생성)은 `qa-browser-sdk.js`에만 포함
- 번들 복사: `pnpm --filter @qa-sdk/browser build` → `dist/qa-browser-sdk.js` → `shop-web/public/`에 복사

## Conventions
- 한국어 주석/UI 텍스트 사용
- Number.MAX_SAFE_INTEGER 한계: indexBudget > 13 hex chars 시 dimMaxForBudget 캡 발생 → `MetaCodecBig` + `createLayoutProtocolBig` + `Capacity Guard`로 BigInt 경로 제공. `numberType: "bigint"` 선언 또는 자동 감지

### 환경변수 (process.env) 처리 규칙
- **서비스 패키지** (ingest-server, registry-service, gate-service 등): `config/env.ts`에 zod 스키마 정의 → `export const env = envSchema.parse(process.env)` → 코드에서 `env.CATALOG_ID`로 접근. `process.env` 직접 접근 금지
- **SDK/context** (qa-context, catalog-provider): `process.env.QA_*` fallback 허용 — SDK 소비자가 env로 설정하는 것은 편의 패턴
- **CLI**: `process.env.QA_REGISTRY_URL`, `HOME`, `USER` 등 직접 접근 허용 — CLI 도구는 zod 불필요
- **라이브러리** (core, spec-core, codec): constructor 인자 우선, `process.env` fallback 최소화. 필요 시 JSDoc으로 문서화
- **테스트**: `process.env.DATABASE_URL` 등 직접 접근 허용

### 브라우저 SDK 에러 처리
- `emitWithCoords`, `browserTrack` 등 인코딩 호출은 반드시 try-catch — 잘못된 prefix/dim 값이 UI를 크래시하면 안 됨
- 인코딩 실패 시 coordinate 없이 emit (이벤트 유실보다 좌표 누락이 낫다)
- `createQaMonitorAsync` registry fetch 실패 → console.warn + 로컬 fallback (silent swallow 금지)

### 서비스 네트워크 호출
- 서버 시작 시 외부 서비스 fetch에 timeout 필수: `AbortSignal.timeout(5_000)`
- JSON.parse(외부 데이터)는 try-catch 필수 — 손상된 데이터가 서비스를 죽이면 안 됨

### codegen 결정론성
- `generateCatalogTypes()`는 timestamp를 **1회 캡처**하여 전 파일에 동일 값 사용
- 같은 catalog → 같은 contentHash (SHA-256 결정론적)
- timestamp 외 입력이 같으면 동일 출력 (VCS 노이즈 최소화)

### ISO-8601 타임스탬프 비교 — 문자열 비교 금지
- 타임스탬프 정렬/비교 시 `localeCompare`, `<`, `>` 문자열 비교를 사용하지 않는다
- `"10:00:00Z"` vs `"10:00:00.100Z"` — Z(0x5A) > .(0x2E)이므로 밀리초 없는 타임스탬프가 뒤로 밀린다
- `compareTimestamps(a, b)` (`@qa-sdk/core`) 사용. Date 변환 기반으로 밀리초 유무 차이 안전 처리
- `normalizeTimestamp(iso)` — 밀리초 없는 타임스탬프에 `.000Z` 추가 (정규 형식: `YYYY-MM-DDTHH:mm:ss.mmmZ`)
- `now()` 반환값은 이미 정규 형식. 외부 입력(클라이언트, DB)은 보장 안 되므로 비교 전 normalizeTimestamp 또는 compareTimestamps 사용

### 테스트에서 카탈로그 파생 카운트 하드코딩 금지
- 축/prefix/domain/consumer/DSL 등 DEMO_CATALOG 또는 DEMO_DKG_CONFIG에서 파생되는 엔티티 수를 테스트에 숫자로 하드코딩하지 않는다
- 올바른 방법: `expect(axes.length).toBe(Object.keys(DEMO_CATALOG.axes).length)` — SSOT에서 파생
- 잘못된 방법: `expect(axes.length).toBe(71)` — 축 추가 시 깨짐
- bootstrap 로직이 자동 생성하는 노드(observation, decision)는 `toBeGreaterThan(0)` 또는 불변조건으로 검증
- 특정 테스트 시나리오에서 주입한 데이터 기반 카운트(예: 이벤트 3종 inject → activePrefixes: 3)는 하드코딩 허용

## Gateway — API 게이트웨이 (2026-03-23 확립)
- `packages/gateway/` — 단일 진입점 인증 + 서비스 라우팅 (ADR-001 구현)
- 실행 모드: `pnpm dev` (Node.js + Tailscale) | `pnpm dev:worker` (CF Worker)
- AUTH_MODE: bypass(개발) | api-key | tailscale | cf-access
- 동적 라우팅: registry `/api/services/gateway` 에서 60초 캐시 로드 → fallback 하드코딩
- body 전달: `c.req.arrayBuffer()` 사용 (stream 소비 문제 방지 — `c.req.raw.body` 금지)
- Tailscale: `tailscale serve --bg <port>` → VPN 네트워크에 노출. `Tailscale-User-Login` 헤더로 인증
- ServiceRecord: `urls` (환경별 URL), `gatewayPath` (라우팅 prefix) 필드로 registry 중앙 관리

### CLI Ingest 명령
- `qa-sdk ingest health|send|recent|trace|status|services` — 수집 서버 상호작용
- `--env dev|prod|staging` 또는 `QA_ENV` — 환경 프리셋 스위칭
- `--registry <url>` → `/api/services/urls` 에서 서비스 URL 자동 탐색
- `--ingest <url>` — 직접 지정 (최우선)

### 배포 인프라
- CF Pages: shop-web (`wrangler.toml` + `_redirects`), platform-demo (기존 wrangler.toml)
- CF Workers: gate-service, query-service (D1 바인딩), gateway (인증 + 프록시)
- GitHub Actions: `.github/workflows/ci.yml` (빌드+테스트), `deploy.yml` (Pages+Workers)
- 시크릿: `CF_API_TOKEN`, `CF_ACCOUNT_ID`

### convergence-pipeline 타입 규칙
- ConvergenceFunctions: `unknown` 대신 `Catalog`, `UsageData`, `MetricValue[]`, `ObservationNode[]` 사용
- OBS-PATTERN: DKG ObservationNode 스키마 준수 (`subjects[]`, `finding`, `intent` — 비표준 필드 금지)
- GraphPort vs ConvergenceGraphPort: 서비스는 ConvergenceGraphPort(최소 — `getNodesByKind`만), CLI는 GraphRegistry(최대)
- `as unknown as ConcreteType`: 동적 import의 구조적 캐스트. `as any`보다 안전 (의도적 캐스트 명시)

## ServiceBootConfig — 서비스 정체성 설정 (2026-03-22 확립)

로깅 SDK의 핵심 질문은 "이 이벤트가 어디서 발생했는가"이다. `ServiceBootConfig`은 이 질문에 대한 **단일 정답**으로, 앱 부트 시 한 번 정의하면 모든 SDK 레이어(좌표 인코딩, 전송 메타데이터, 권한)가 자동으로 정렬된다.

### 정의 (`@qa-sdk/core/types/service-identity.ts`)
```typescript
interface ServiceBootConfig {
  namespace: string;        // 필수. 서비스 네임스페이스 (예: "shop")
  name: string;             // 필수. 서비스 이름 (예: "payment")
  env: string;              // 필수. 배포 환경 — 좌표 차원 (예: "prod", "dev")
  region: string;           // 필수. 리전 — 좌표 차원 (예: "asia", "usa")
  build?: string;           // 선택. 빌드 식별자 — 비좌표 메타데이터
  releaseVersion?: string;  // 선택. 릴리즈 버전 — 비좌표 메타데이터
}
```
- `namespace`/`name` → 서비스 식별 (permission canonical form: `"namespace/name"`)
- `env`/`region` → 좌표 차원 (카탈로그 service prefix 4축 중 2축). required
- `build`/`releaseVersion` → 5Q 체크리스트 미통과 (유한하지 않음, 배포마다 변경). 전송 메타데이터로만 전달

### 설정 방법 (패키지별)

**Node.js 서버 — QaContext 경로**
```typescript
import { createQaContext } from "@qa-sdk/sdk";
const qa = createQaContext({
  serviceConfig: { namespace: "shop", name: "payment", env: "prod", region: "asia", build: "abc123" },
  catalog: DEMO_CATALOG,
});
qa.infraContext();  // → { service: "service:v1:42" } — QaLogger.infraContext에 전달
```

**Node.js 서버 — ApmLogger 경로**
```typescript
import { createApmLoggerFromBoot } from "@qa-sdk/apm";
const logger = createApmLoggerFromBoot({
  service: { namespace: "shop", name: "payment", env: "prod", region: "asia" },
  transport, owner, codec,
});
```

**브라우저 — qa-browser-sdk.js 경로**
```html
<script type="module">
import { createQaMonitor } from './qa-browser-sdk.js';
const monitor = createQaMonitor({
  ingestUrl: "http://localhost:3200",
  serviceConfig: { namespace: "shop", name: "shopping-web", env: "prod", region: "asia" },
  autoCapture: { clicks: true, navigation: true },
});
// infra_context 자동 생성, 세션 자동 관리, Beacon 전송 보장
monitor.emitWithCoords('page.home', {
  page_view: { page: 'home', locale: 'ko', userType: 'member' },
});
</script>
```

**기존 방식 (deprecated, 하위 호환)**
```typescript
// QaContext: 개별 필드
createQaContext({ env: "prod", region: "asia", service: "payment", namespace: "shop", catalog });
// QaMonitor: meta
createQaMonitor({ ingestUrl, meta: { serviceName: "payment", env: "prod" } });
```

### 자동 파생
`ServiceBootConfig` 하나로 3가지 출력이 자동 생성된다:

| 함수 | 출력 | 용도 |
|------|------|------|
| `toServiceDims(config)` | `{ env, region, svc_name, namespace }` | 카탈로그 service prefix 인코딩. `name` → `svc_name` 매핑 |
| `toTransmissionSource(config, sdk, ver)` | `{ service_name: "namespace/name", ... }` | 전송 엔벨로프 source 필드 |
| `toTransmissionBuild(config)` | `{ env: "production", build_ref, ... }` | 전송 엔벨로프 build 필드. env 정규화 포함 |

모든 파생 함수는 `@qa-sdk/core`에서 export. `@qa-sdk/sdk` facade에서도 re-export.

### Env 정규화
- `BuildEnv`는 `string` 타입 (리터럴 유니온 아님). 권장값: local, dev, staging, production, test, stage, prod
- 카탈로그 축 엔트리(`prod`, `stage`)와 전송 형식(`production`, `staging`)이 다름 → 자동 매핑
- `catalogEnvToBuildEnv("prod")` → `"production"`, `buildEnvToCatalogEnv("staging")` → `"stage"`

### 호환성
- permission-engine `ServiceRef`와 구조적 호환 (TypeScript structural typing). 패키지 의존 추가 없음
- `QaContext.infraContext()` — 서비스 좌표를 infra_context 형태로 반환. envelope 레벨 서비스 바인딩에 사용

## Projection — 이벤트 뷰 프리셋 (2026-03-22 확립)

### 개념
- Projection = "좌표 공간을 어떤 조건으로 잘라서 어떻게 배치할지" 선언
- 전제: 모든 이벤트 prefix는 service에 바인딩 (svc_ref 축 또는 svcOwners 매핑)
- 같은 `cart_event`라도 shopping-web에서 발생하면 Frontend, shopping-backend이면 Backend

### Projection 인터페이스
```typescript
interface Projection {
  name: string;
  servicePrefix?: string;    // default: "service"
  groupByAxis?: string;      // default: "svc_name"
  groupLayerMap: Record<string, LayerLevel>;  // svc_name → layer
  axisFilters?: Record<string, string[]>;     // { env: ["prod"] }
  includePrefixes?: string[];
  excludePrefixes?: string[];
  prefixMap?: Record<string, LayerLevel>;     // svc 바인딩 없는 prefix 고정
}
```

### 기본 프리셋
- `SERVICE_PROJECTION` — 전체 서비스 계층 (기본값). Frontend/Backend/Infra/System 4계층
- `PROD_ASIA_PROJECTION` — prod + asia 환경만 필터
- `DEV_PROJECTION` — dev 환경만 필터
- `CHECKOUT_PROJECTION` — 결제 흐름 prefix만 (8개)
- `LEGACY_PROJECTION` — 하위 호환 (prefix ID 기반 하드코딩)

### 사용법
```typescript
import { buildLayerMap, buildSvcOwnerMap, SERVICE_PROJECTION } from "@qa-sdk/spec-core/viz";
const svcOwners = buildSvcOwnerMap(services);
const result = buildLayerMap(catalog, SERVICE_PROJECTION, svcOwners);
// result.layers → Frontend 6 / Backend 9 / Infra 16 / System 8
```

### 배치 우선순위
1. `groupLayerMap` — svcOwners에 등록된 prefix → 발생 서비스 기반 layer
2. `prefixMap` — svcOwners에 없는 prefix 고정 (DKG, system 등)
3. `domainMap` — domain 기반
4. `meta.layer` — catalog 하드코딩 (fallback)
5. `defaultLayer` — 기본값 (1)

## 좌표계 컨벤션 (2026-03-21 확립)

### Prefix Version
- prefix version은 `latestPrefixVersion(catalog, prefixId)` 또는 `prefix.versions[versions.length - 1].version`으로 동적 조회
- `"v1"`, `"v2"` 하드코딩 금지 — catalog 구조 변경 시 깨짐
- `version-resolution.test.ts`가 전체 prefix의 라운드트립을 자동 검증 (SSOT 기반 동적 카운트)

### Axis Capacity
- 새 축 추가 시 capacity는 `nextPowerOf2(entries.length * 2)` 이상
- 눈대중으로 딱 맞게 잡으면 headroom 경고 발생 (headroom ≤ 1 → warning, 0 → critical)
- `dkg promote scan`의 q5_capacity가 이 공식 사용

### DimRef 3종 — axis / prefix_ref / table_ref

prefix의 각 dim은 3종 중 하나:

| kind | 값 | 디코딩 결과 | 예시 |
|------|-----|-----------|------|
| `axis` | entry 문자열 | `{ role: "admin" }` | role, env, action |
| `prefix_ref` | 참조 prefix의 1D 주소 (정수) | `{ perm_svc: 42 }` | perm_svc, evt_svc, svc_ref |
| `table_ref` | DB 레코드 식별자 | `{ member_id: 7 }` | member_id, order_id |

### prefix_ref 디코딩 컨벤션

**원칙**: prefix_ref dim은 **명시적 추가 조회 없이는 정수만 반환**. 재귀 디코딩은 클라이언트가 요청할 때만 수행.

```
permission:v4:1376
  ↓ 1단계 (기본): 자체 디코딩
  { perm_svc: 42, role: "admin" }     ← perm_svc는 정수 (service prefix 1D 주소)

  ↓ 2단계 (명시적 /decode/deep 요청 시): prefix_ref 재귀 해석
  { perm_svc: { env: "prod", region: "asia", svc_name: "payment", namespace: "shop" },
    role: "admin" }
```

**display label**: prefix_ref dim은 정수 외에 **표시 이름**을 1개 갖는다.
- `refEntries`가 SSOT — 의미값 배열(MEANING) → 정수 배열(values) 매핑
- 예: `PERM_SVC_MEANING[0] = { env: "prod", svc_name: "shopping-web", ... }` → `values[0] = 65536`
- display label: `"prod/asia/shopping-web/shop"` (의미값 join)
- catalog-builder.ts에서 자동 파생. 직접 정수 하드코딩 금지 (`feedback_semantic-ref-entries` 참조)

**DecodeMap에서의 표현**:
```json
{ "dimId": "perm_svc", "kind": { "type": "index_ref", "indexId": "service" }, "entries": [] }
```
- `entries: []` — prefix_ref는 자체 entry 목록 없음. shape에는 참조 prefix의 capacity가 들어감
- 디코더는 정수 그대로 반환. 재귀 해석은 `/decode/deep`에서만

**decode-service API**:
- `POST /decode` → `{ entities: { perm_svc: 42, role: "admin" } }` (1단계)
- `POST /decode/deep` → `{ entities: ..., refs: { perm_svc: { env: "prod", ... } } }` (2단계)

### 주소 디코딩 함수 계층 — 4단계

같은 1D 주소를 해석하는 함수가 4개 있으며, 각각 해석 깊이와 의존성이 다르다.

| 단계 | 함수 | 패키지 | prefix_ref 처리 | 의존성 | 용도 |
|------|------|--------|----------------|--------|------|
| L1 | `decodePrefix()` | `@qa-sdk/core` | **refEntries의 정수값** 반환 | Catalog | 기본 디코딩. `{ perm_svc: 42, role: "admin" }` |
| L2 | `resolveAddress()` | `@qa-sdk/core` | **재귀 해석** → 트리 구조 (ref.dims) | Catalog | 의미 해석. `{ perm_svc: { ref: { dims: { env: "prod", ... } } } }` |
| L3 | `decomposeAddress()` | `@qa-sdk/core` | **참조 prefix decode** → refDims | Catalog | 차원 분해. `{ perm_svc: { value: 42, refDims: { env: { value: "prod" } } } }` |
| S1 | `PrefixDecoder.decode()` | `index-meta` | **정수** 그대로 반환 | DecodeMap | 서비스용 경량 디코딩 (catalog 불필요) |
| S2 | `PrefixDecoder.decodeDeep()` | `index-meta` | **refs에 로드된 코덱으로 1-level 확장** | DecodeMap + refs | 서비스용 deep 디코딩 |

**L계열 (Catalog 기반)**: `@qa-sdk/core/catalog/runtime.ts`. Catalog 전체를 알아야 동작. CLI, spec-core, 서버 사이드에서 사용.
**S계열 (DecodeMap 기반)**: `index-meta/prefix-decoder.ts`. DecodeMap 번들만으로 동작. decode-service, 외부 서비스, 브라우저에서 사용.

핵심 차이:
- **L1 `decodePrefix`** vs **S1 `decode`**: 같은 결과. axis→entry string, prefix_ref→refEntries 정수. L1은 catalog 직접 참조, S1은 DecodeMap shape/strides로 계산
- **L2 `resolveAddress`**: ko 라벨 + prefix_ref 재귀 resolve (트리 형태). **S계열에 대응 없음** — catalog의 axes.ko, refEntries.meaning 필요
- **L3 `decomposeAddress`**: prefix_ref를 참조 prefix로 decode. **S2 `decodeDeep`과 유사**하지만 L3은 catalog에서 refVersion/refEntries를 직접 조회
- **S2 `decodeDeep`**: refs Map에 로드된 코덱으로만 확장. 로드 안 된 ref는 unresolved로 보고

decode-service API 매핑:
- `POST /decode` → S1 `decode()` — 정수/entry만 반환
- `POST /decode/deep` → S2 `decodeDeepDetailed()` — refs 확장 + unresolved 보고
- `POST /decode/batch` → S1 `decode()` × N

### Catalog 소비 경로
- **개발**: `import { DEMO_CATALOG } from "demo-snapshot"` 직접 사용
- **운영**: `createCatalogProvider({ registry: "http://registry:3300" })` → registry에서 active catalog fetch
- **SDK**: `createQaContextAsync({ registry })` → CatalogProvider 경유 → fallback: 로컬
- **CLI**: `--registry` 옵션 또는 `QA_REGISTRY_URL` 환경변수
- Registry가 prefix/version/shape/stride의 authority. 코드는 development shortcut.

### 관측 루프 (Observation Loop) — SPEC-OBSERVATION-LOOP
관측 루프 = observation이 열리면 decision으로 판단하고 resolution으로 닫는 순환 구조.

루프 상태:
- **열림 (open)**: observation 생성됨. resolution 없음. 미해결.
- **연결됨 (linked)**: prompts 엣지로 decision에 연결됨. 아직 resolve 안 됨.
- **닫힘 (closed)**: resolution 설정됨. outcome: accepted|deferred|rejected.

루프 경로:
1. `dkg observe` → observation 생성 (루프 열기)
2. `dkg decide` → decision 생성 (판단). `--spec`으로 근거 연결 가능.
3. `dkg link` → observation → decision prompts 엣지 (촉발 연결)
4. `dkg resolve` → observation.resolution 설정 (루프 닫기)

intent별 루프 의무:
- `action-needed`: **반드시 닫아야 함**. health metric이 issue로 집계.
- `monitoring`: 닫지 않아도 됨. 조건 변화 시 재평가. health에서 제외.
- `completed`: 닫아야 함 (완료 보고).

자동 해소:
- metric 기반 observation → metric ok 복귀 시 `resolveRecoveredMetrics()`가 자동 resolve.
- DEC-SEP Decision으로 수용된 overlap → metric ok 처리.
- `prompts → active Decision` 연결된 observation → acknowledged, health 제외.

### Self-Check 레이어
- **Layer 1 (SLOW)**: CI에서 빌드/테스트 실행 → SelfCheckResult[]
- **Layer 2 (FAST)**: `analyzeSelfCheck()` 순수 함수 → 좌표 인코딩 + convergence + invariant (47ms, execSync 없음)
- **Layer 3 (STORE)**: `--apply` 시 snapshot/observation 저장 (dry-run이 기본)

### Entry 커버리지 — 자동 합성 이벤트 (표준)
- `generateSyntheticEvents(catalog)` — 카탈로그에서 합성 이벤트를 **자동 생성**. 수동 관리 불필요
- 알고리즘: 각 prefix의 각 axis dim에서 모든 entry를 순회. 조합 폭발 방지를 위해 **합(sum) 전략** 사용
  - base: 각 axis의 첫 번째 entry로 고정
  - 각 axis를 순회하며 해당 axis의 entry만 변경, 나머지는 base 유지
  - 총 이벤트 수 = Σ(axis entries count) (곱이 아닌 합)
- prefix_ref dim은 refEntries 첫 번째 값을 자동 주입. table_ref dim은 스킵
- 커버리지 측정 단위: **axis entry** (조합이 아님). 각 entry가 최소 1회 인코딩되면 observed
- `MANUAL_SYNTHETIC_EVENTS` — 자동 생성으로 커버되지 않는 특수 조합만 추가 (현재 빈 배열)
- error-path entries (`ERROR_PATH_ENTRIES`: failure, timeout 등)는 coverage 분모에서 제외
- `dkg self-check --fast` — Phase A(빌드/테스트) 스킵, Phase B~E만 실행 (0.3초)

### CLI 완전 관측
- 모든 CLI 명령은 `emitCliEvent(command)` → `cli_event` prefix로 자동 기록
- `CLI_COMMAND_MAP`: 전체 CLI 명령 → 고유 좌표 매핑 (intent × domain × subject). 수치는 `dkg run skill-cli-coverage`로 동적 확인
- 명령어 이름은 교체 가능한 UI. 좌표가 안정 식별자
- `analyzeCliCoverage()`: dormant 좌표 = 한 번도 실행 안 된 기능

### DKG 자기참조
- 74축, 39 prefix, 11 DSL, 6 도메인, 6 테이블
- `dev-domain`: build_event, test_event, dkg_event, dkg_decision_event, dkg_observation_event, cli_event, contract_check
- `dsl-dev`: 7 members, 불변조건 3개 (빌드 실패 후 테스트 금지 등)
- `dkg_op` 축: claim, release, decide, observe, resolve, link, refresh, self-check, converge, trace, promote
- `dkg promote scan`: 5Q 자동 판정으로 좌표 승격 후보 발견

### Self-Check 패키지
- 28/35 패키지 관리 (80%)
- 미관리 7개: platform-demo-api, registry-ui, roleplay-web, shop-web, weighted-gpu, weighted-index-explorer, weighted-ui
- `SELF_CHECK_PKGS` 배열에 등록. `hasBuild`/`hasTest` 플래그로 빌드/테스트 스킵 제어

### 지정 초기화
- `dkg reset bootstrap` — 구조만 재초기화
- `dkg reset operational` — 운영 데이터(observation, decision) 삭제
- `dkg reset snapshots` — usage 스냅샷 삭제
- `dkg reset all --confirm` — 전체 초기화
- `--confirm` 없으면 dry-run (현재 상태만 표시)
