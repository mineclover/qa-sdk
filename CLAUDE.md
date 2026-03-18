# QA-SDK Monorepo

## Build
- `pnpm --filter <pkg> build` — 개별 패키지 빌드 (tsup)
- weighted-index → bit-index → permission-engine → platform-demo 순서로 빌드해야 함 (의존성)
- weighted-index DTS 빌드에 기존 에러 있음 (calc.js exports); ESM/CJS는 정상
- platform-demo tsc 우회: `pnpm --filter platform-demo exec vite build --mode development`

## Package Structure

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
- `src/service-ref.ts` — 서비스 참조 (namespace/name) + SDK 글로벌 컨텍스트 (env/build/region 숨김)
- `src/permission-code.ts` — 전체 permission address: `{service-ref}.{type}.{resource}.{action}`

### platform-demo
- `packages/platform-demo/src/pages/layout.ts` — 레이아웃 시뮬레이터 UI
- `packages/platform-demo/src/pages/casbin.ts` — Casbin 권한 모델 해설 (qa-sdk ↔ Casbin 대비)
- `packages/platform-demo/src/pages/perm-engine.ts` — permission-engine v1→v2 마이그레이션 비교 데모

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
- service-ref: (namespace/name) 필수 + (env/build/region) SDK가 일괄 설정하여 숨김
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
- 서비스별 env 설정: `SQLITE_DRIVER` (node|better), `SQLITE_PATH` (서비스별 분리 — gate-service.sqlite, query-service.sqlite 등)

### index-meta 연동 (1D 주소 저장)
- 1D integer address → index-meta의 EntryFlagStore (active/inactive, append-only 이력) 활용 가능
- AddressStateStore: 범위 기반 상태 캐시 (reserved/inactive/open)
- GateEngine: 상태 변경 시 cascade 전파 (leaf → composite)
- PrefixCodec의 composite ref로 그룹별 독립 인코딩 → 통합 주소 구성 가능

## Conventions
- 한국어 주석/UI 텍스트 사용
- Number.MAX_SAFE_INTEGER 한계: indexBudget > 13 hex chars 시 dimMaxForBudget 캡 발생 → `MetaCodecBig` + `createLayoutProtocolBig` + `Capacity Guard`로 BigInt 경로 제공. `numberType: "bigint"` 선언 또는 자동 감지
