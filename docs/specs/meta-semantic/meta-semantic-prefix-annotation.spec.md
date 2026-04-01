---
def:
  id: meta-semantic-prefix-annotation
  level: leaf
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: draft
  layer: domain
  tags: [structural, contract]
  links:
    - target: meta-semantic-system
      type: depends_on
    - target: system-concepts
      type: depends_on
---

# Prefix Annotation — 코드↔prefix label-index 바인딩 표식

## 목적 ^purpose

코드가 prefix의 어떤 dim/label을 사용하는지를 **version + index 포함**으로
코드 안에 표식으로 남기는 규약.
코드는 label 기반으로 prefix를 소비하지만, label은 특정 version의 index에 매핑된다.
표식에 version과 index를 함께 기록해야 **label-index 불일치를 검증**할 수 있다.

## 구성 ^overview

- 주석 태그 1종: `@prefix` — prefixId:version + dim:index 쌍
- **한줄 주석 (`//`)**: 자동 생성물이므로 가볍게. 복수 prefix면 복수 행
- **자동 생성**: SDK 함수 호출을 앵커로 탐지 → 함수 시그니처에서 prefix ID + dims 위치 결정 → 카탈로그에서 version+index resolve → 표식 자동 삽입·갱신
- label만으로는 drift 검증 불가 — 같은 label이 version에 따라 다른 index를 가질 수 있음
- version + index가 있어야 카탈로그 대조로 불일치 자동 탐지
- 용도: label-index drift 경고, prefix 단위 일괄 검색, entry 변경 시 영향 범위 확정
- 소유(owns) → `PrefixMeta.source`, 이벤트 매핑 → `prefix-mapping.ts`가 담당 (중복 안 함)

---

## 1. 문제

### 1.1 코드는 label 기반이지만 런타임은 index 기반이다

```ts
// 코드에서 보이는 것: label
track("cart_event", { action: "add", product_id: "p1" });

// 런타임에서 일어나는 것: label → index 치환
// cart_event v1: action → dim index 0, "add" → entry index 0
// cart_event v2: action → dim index 2, "add" → entry index 1  (재배치)
```

label "add"가 v1에서 index 0, v2에서 index 1이면 — 코드가 어떤 version에
바인딩되어 있는지 모르면 label이 같아도 불일치를 판별할 수 없다.

### 1.2 현재의 문제

| 작업 | 현재 방법 | 문제 |
|------|----------|------|
| prefix X를 쓰는 코드 찾기 | `grep "cart_event"` | 453건, 98% 노이즈 |
| label 변경 시 영향 범위 | 전체 grep + 수동 필터 | 놓치기 쉽고 느림 |
| version 간 index 변경 감지 | 할 수 없음 | label만으로는 index 불일치 검증 불가 |
| entry 재배치 후 코드 업데이트 | 기억에 의존 | 어디를 바꿔야 하는지 모름 |

### 1.3 원하는 상태

```ts
// @prefix cart_event:v1 — dims: [action:0, product_id:1]
function addToCart(productId: string) {
  track("cart_event", { action: "add", product_id: productId });
}
```

표식에 version + index가 있으면:
- 카탈로그 v1의 action이 index 0인지 대조 → 불일치 시 경고
- v2로 마이그레이션 시 index가 바뀐 곳을 자동 식별
- label은 같은데 index가 달라진 사일런트 브레이킹을 잡을 수 있음

---

## 2. 주석 태그 정의 ^defines

### 2.1 `@prefix` 태그

코드가 특정 prefix의 특정 version에서 dim/label을 사용한다는 사실을 선언한다.

```
// @prefix <prefixId>:<version> [— dims: [dim1:index1, dim2:index2, ...]]
```

### 2.2 기본 포맷: 한줄 주석

```ts
// @prefix cart_event:v1 — dims: [action:0, product_id:1]
```

- 자동 생성물 → `//` 한줄 주석이 기본. JSDoc 블록 불필요
- 1 prefix = 1행. 복수 prefix면 복수 행
- `prefixId:version`: 카탈로그 prefix ID + 바인딩된 version
- `dim:index`: dim label + 해당 version에서의 index

### 2.3 version 규칙

- version은 `latestPrefixVersion()` 결과와 대조 (CLAUDE.md: 하드코딩 금지 원칙과 동일)
- 표식의 version이 카탈로그 최신 version과 다르면 → `version-behind` warning
- version 생략 불가 — version 없이는 index 검증이 무의미

### 2.4 dim 생략

prefix 전체를 다루거나 특정 dim을 지목할 필요 없을 때 dims 생략 가능.
단, version은 항상 명시:

```ts
// @prefix page_view:v1
```

### 2.5 entry 값 참조

특정 entry 값에 의존하는 로직 — entry의 index도 명시:

```ts
// @prefix flow_point:v1 — dims: [flow_type:2] — entry: flow_type.legacy=3
function isFlowDeprecated(decoded: DecodeResult): boolean {
  return decoded.dims.flow_type?.value === "legacy";
}
```

`flow_type.legacy=3`: flow_type dim의 "legacy" entry가 index 3에 매핑.

### 2.6 복수 선언

prefix마다 한 줄:

```ts
// @prefix page_view:v1 — dims: [page:0, locale:1]
// @prefix tracking:v1 — dims: [trackAction:0, page:1]
// @prefix auth_event:v1 — dims: [role:2]
export class SessionAnalyzer {
  analyze(session: DecodedSession) { ... }
}
```

---

## 3. 자동 생성 — SDK 함수 앵커 기반

### 3.1 원칙

**SDK 함수 호출이 탐지 앵커**. prefix를 소비하려면 반드시 SDK 함수를 거치므로,
SDK 함수 호출을 찾으면 prefix 사용처가 확정된다.

```
SDK 함수 호출 탐지
  → 함수 시그니처에서 prefix ID + dim label 위치 결정
  → 카탈로그에서 version + index resolve
  → 호출부 위에 // @prefix 스탬프 삽입/갱신
```

### 3.2 앵커 함수 테이블

SDK 함수마다 prefix ID와 dims가 인자의 어느 위치에 있는지 고정:

| SDK 함수 | prefix ID 위치 | dims 위치 | 자동화 |
|----------|---------------|-----------|--------|
| `.track({ key: dims })` | 1번째 인자 오브젝트 키 | 오브젝트 값 키들 | 완전 자동 |
| `.emitWithCoords(evKey, { key: dims })` | 2번째 인자 오브젝트 키 | 오브젝트 값 키들 | 완전 자동 |
| `browserTrack(cat, { key: dims })` | 2번째 인자 오브젝트 키 | 오브젝트 값 키들 | 완전 자동 |
| `.encode(prefixId, dims)` | 1번째 문자열 인자 | 2번째 오브젝트 키들 | 완전 자동 |
| `.decode(prefixId, addr)` | 1번째 문자열 인자 | — (전체 labels) | 완전 자동 |
| `encodePrefix(cat, prefixId, ver, pos)` | 2번째 문자열 인자 | 4번째 오브젝트 키들 | 완전 자동 |
| `decodePrefix(cat, prefixId, ver, addr)` | 2번째 문자열 인자 | — (전체 labels) | 완전 자동 |
| `encodePrefixByValue(cat, prefixId, ver, vals)` | 2번째 문자열 인자 | 4번째 오브젝트 키들 | 완전 자동 |
| `decodeContext(cat, addrCtx)` | — (iterate) | — | 수동 힌트 |

이 테이블이 stamp 도구의 **설정값**. 새 SDK 함수가 추가되면 행 추가.

### 3.3 version resolve 체계

stamp이 version을 결정하는 우선순위:

```
1. ServiceVersionManifest (서비스 매니페스트)
   → 이 서비스가 실제로 소비하는 prefix version
2. VERSION_META.prefixVersions (codegen 시점 스냅샷)
   → codegen 생성 시 확정된 prefix version
3. latestPrefixVersion(catalog, prefixId) (폴백)
   → 카탈로그의 최신 version
```

**ServiceVersionManifest 기반** (가장 정확):

```ts
// ManifestRegistry에서 서비스 매니페스트 조회
const manifest = registry.getServiceManifest("shopping-web");
// manifest.prefixes = { "page_view": "v2", "cart_event": "v1", ... }
// → page_view는 v2, cart_event는 v1으로 resolve
```

**VERSION_META 기반** (codegen 소비자):

```ts
// codegen 생성물에 포함된 버전 스냅샷
import { VERSION_META } from "./generated/prefix-ids";
// VERSION_META.prefixVersions = { "auth_event": "v2", "cart_event": "v1", ... }
```

**폴백** (매니페스트/VERSION_META 없을 때):

```ts
latestPrefixVersion(catalog, "service") → "v1"
```

### 3.4 탐지 → resolve → 삽입 흐름

```ts
// ── 1. 탐지: SDK 함수 호출 발견 ──
browserTrack(browserCatalog, {
  service: toServiceDims(config.serviceConfig),
});

// ── 2. 추출: 테이블 규칙 적용 ──
// browserTrack → "2번째 인자 오브젝트 키" → prefixId = "service"
// dims = 함수 호출 반환값 → 카탈로그의 전체 labels 사용

// ── 3. resolve: version 결정 (우선순위) ──
//   매니페스트: manifest.prefixes["service"] → "v1"
//   또는 VERSION_META.prefixVersions["service"] → "v1"
//   또는 latestPrefixVersion(catalog, "service") → "v1"
// catalog.prefixes["service"].labels = ["env", "region", "svc_name", "namespace"]
// labels.indexOf("env") = 0, labels.indexOf("region") = 1, ...

// ── 4. 삽입: 호출부 위에 스탬프 ──
// @prefix service:v1 — dims: [env:0, region:1, svc_name:2, namespace:3]
browserTrack(browserCatalog, {
  service: toServiceDims(config.serviceConfig),
});
```

### 3.4 dims 추출 규칙

| 인자 형태 | dims 추출 | 예시 |
|----------|----------|------|
| **오브젝트 리터럴** | 키를 직접 추출 | `{ action: "add", product_id: "p1" }` → `["action", "product_id"]` |
| **함수 호출** | 반환 타입 추적 불가 → 카탈로그의 전체 labels 사용 | `toServiceDims(config)` → labels 전체 |
| **변수 참조** | 변수 정의 추적 → 오브젝트 리터럴이면 추출, 아니면 전체 labels | `const d = { role: "admin" }; encode("perm", d)` |

dims를 코드에서 추출할 수 없으면 해당 prefix의 **전체 labels**를 기본값으로 사용.
실제 사용 dim이 전체의 부분집합이어도 스탬프의 검증 기능에는 영향 없음
(전체 labels의 index도 부분집합의 index도 같은 값이므로).

### 3.6 prefix ID가 동적인 경우

SDK 호출에서 prefix ID가 변수인 경우의 분류와 처리:

| 카테고리 | 건수 | 처리 | 예시 |
|----------|------|------|------|
| **함수 파라미터** (범용 인프라) | ~16건 | **스탬프 불필요** | `resolve(catalog, prefixId, ...)` — 모든 prefix를 다루는 코드 |
| **조건 상수** (리터럴 분기) | ~2건 | **자동 처리 가능** | `prefixId = r.kind === "build" ? "build_event" : "test_event"` |
| **카탈로그 파생** (dim.prefixId) | ~2건 | **자동 처리 가능** | `dimRef.prefixId` — 카탈로그 구조에서 정적 추출 |
| **런타임 데이터 파싱** | ~1건 | 수동 힌트 | serialized 문자열에서 추출 |
| **CLI 인자** | ~1건 | 수동 힌트 | `args.prefix` — 사용자가 런타임에 입력 |

**범용 인프라 코드** (함수 파라미터로 모든 prefix를 다루는 코드):
- 특정 prefix에 바인딩된 게 아니므로 스탬프 대상이 아님
- 예: `resolve()`, `dim-wire`, `codegen`, `demo-bridge`, `semantic-ref`

**조건 상수** (자동 처리 가능):

```ts
// 삼항 연산자에서 리터럴 추출 → 양쪽 다 스탬프
const prefixId = r.kind === "build" ? "build_event" : "test_event";
encodePrefixByValue(catalog, prefixId, ver, { ... });
// → // @prefix build_event:v2 — dims: [...]
// → // @prefix test_event:v1 — dims: [...]
```

**카탈로그 파생** (자동 처리 가능):

```ts
// dim.prefixId는 카탈로그 메타데이터 → 정적으로 resolve 가능
const dimRef = prefix.dims[dimLabel];
encodePrefixByValue(catalog, dimRef.prefixId, refEntries.refVersion, meaning);
```

### 3.7 수동 힌트

prefix ID만 수동으로 명시하면 stamp이 나머지를 채움:

```ts
// @prefix auth_event
function checkAdmin(decoded: DecodeResult) {
  return decoded.dims.role?.value === "admin";
}
// → stamp --update 실행 후:
// @prefix auth_event:v1 — dims: [role:2] — entry: role.admin=0
```

수동 힌트가 필요한 경우:
- `decodeContext()` 결과를 소비하는 코드 (prefix ID가 iterate에서 나옴)
- decoded 결과의 dim을 직접 참조하는 로직
- 제네릭 래퍼를 통해 간접 호출하는 코드

### 3.8 제외 대상

| 대상 | 이유 |
|------|------|
| SDK 구현 내부 (`browser-codec.ts`, `monitor.ts`, `qa-context.ts`, `runtime.ts`) | SDK 자체는 모든 prefix를 다루는 범용 코드 |
| `prefix-mapping.ts`, `auto-track.ts` | 매핑 자체가 SSOT |
| `demo-catalog.ts` | `PrefixMeta.source`가 소유 정보 보유 |
| codegen 생성물 (`demo-types/`) | `VERSION_META`가 추적 |
| 테스트 파일 (`*.test.ts`, `*.spec.ts`) | 검증 코드에 표식 부착은 과잉 |

### 3.9 CLI 명령

```bash
# SDK 함수 호출 탐지 → 스탬프 자동 삽입
qa-sdk prefix stamp

# 서비스 매니페스트 기반 version resolve
qa-sdk prefix stamp --service shopping-web

# 기존 스탬프 + 수동 힌트를 카탈로그 현재 상태로 갱신
qa-sdk prefix stamp --update

# dry-run: 변경 내용만 출력
qa-sdk prefix stamp --dry-run

# 특정 파일/디렉토리만
qa-sdk prefix stamp src/pages/
```

### 3.10 삽입 로직

```
1. 파일 확장자 → COMMENT_PREFIX 결정
2. SDK 앵커 함수 호출 탐지 (앵커 테이블 기반)
3. 인자에서 prefix ID + dim labels 추출 (테이블의 위치 규칙)
4. 카탈로그에서 version + index resolve
5. 호출부를 포함하는 함수/클래스 선언의 바로 위에 스탬프 행 생성
6. 중복 체크:
   - 같은 prefix ID의 기존 스탬프 → 교체 (version+index 갱신)
   - 다른 prefix ID의 기존 스탬프 → 유지
   - 없음 → 삽입
7. 들여쓰기는 대상 선언 행의 indent를 따라감
```

---

## 4. label-index 바인딩 검증

### 4.1 검증 모델

표식의 `dim:index` 쌍을 카탈로그의 해당 `prefix:version`과 대조:

```
표식:     // @prefix cart_event:v1 — dims: [action:0, product_id:1]
카탈로그:  cart_event v1 → labels: ["action", "product_id", "env"]
                           index:    0          1              2

대조: action=0 ✓, product_id=1 ✓ → 일치
```

### 4.2 drift 검증 규칙

| 검증 | 심각도 | 의미 |
|------|--------|------|
| `index-mismatch` | **error** | 표식의 dim:index가 카탈로그의 실제 index와 불일치 |
| `label-removed` | **error** | 표식의 dim label이 카탈로그에서 삭제됨 |
| `entry-index-mismatch` | **error** | entry label의 실제 index가 표식과 불일치 |
| `entry-removed` | **error** | 표식의 entry label이 카탈로그에서 삭제됨 |
| `version-behind` | **warning** | 표식 version이 카탈로그 최신 version보다 이전 |
| `label-renamed` | **warning** | dim label이 변경됨 |
| `label-added` | **info** | 새 dim/entry 추가됨 |
| `unknown-prefix` | **error** | 카탈로그에 없는 prefix ID |
| `unknown-dim` | **error** | 해당 prefix에 없는 dim |

### 4.3 사일런트 브레이킹 탐지

가장 위험한 경우: **label은 그대로인데 index가 바뀐 것**.

```
v1: labels: ["action", "product_id", "env"]    → action=0
v2: labels: ["env", "action", "product_id"]    → action=1  (재배치!)
```

label만 기록했으면 코드에서 "action"을 grep해도 문제 없어 보인다.
index까지 기록했으면 `action:0` vs 실제 `action:1` → **index-mismatch error**.

---

## 5. 적용 범위

### 5.1 표식이 필요한 곳

prefix의 dim/label을 **코드에서 직접 언급**하는 모든 곳:

| 패턴 | 예시 | 자동화 수준 |
|------|------|------------|
| `track()` / `emit()` 호출 | `track("X", { dim: val })` | 완전 자동 |
| `decode()` 결과 참조 | `decoded.dims.role.value` | 반자동 (prefix ID 힌트) |
| entry 값 비교 | `if (action === "add")` | 반자동 (dim 컨텍스트 힌트) |
| 타입에서 dim 참조 | `interface { action: CartAction }` | 반자동 |

### 5.2 표식이 불필요한 곳

| 대상 | 이유 |
|------|------|
| `prefix-mapping.ts` | 매핑 자체가 prefix→dim label 계약 |
| `demo-catalog.ts` | `PrefixMeta.source`가 소유 정보 보유 |
| codegen 생성물 (`demo-types/`) | `VERSION_META`가 추적 |
| auto-track 내부 | prefix-mapping에서 파생 |
| 테스트 파일 | 검증 코드에 표식 부착은 과잉 |

### 5.3 부착 위치

| 수준 | 언제 | 예시 |
|------|------|------|
| **함수/메서드** | 특정 함수가 prefix label 사용 | `addToCart()`, `decodeSession()` |
| **클래스** | 클래스 전체가 특정 prefix 다룸 | `SessionAnalyzer` |
| **파일 상단** | 파일 내 모든 코드가 같은 prefix | 전용 트래커 모듈 |

가장 좁은 범위에 부착. 파일 내 모든 함수가 같은 prefix를 쓰면 파일 수준.

---

## 6. 유틸리티 — 표식 기반 도구

### 6.1 `prefix stamp` — 자동 생성·갱신 (핵심)

```bash
# 코드 스캔 → 표식 자동 삽입
qa-sdk prefix stamp

# 기존 표식 갱신 (카탈로그 현재 상태로 재계산)
qa-sdk prefix stamp --update

# dry-run
qa-sdk prefix stamp --dry-run
```

### 6.2 `prefix drift` — 불일치 경고

```bash
qa-sdk prefix drift

# ERROR  index-mismatch: cart_event:v1 action — 표식 index:0, 실제 index:2
#   → pages/cart/add-to-cart.ts:1
#
# WARNING  version-behind: cart_event — 표식 v1, 최신 v2
#   → pages/cart/add-to-cart.ts:1
```

### 6.3 `prefix find` — 일괄 탐색

```bash
qa-sdk prefix find cart_event
qa-sdk prefix find cart_event --dim action
qa-sdk prefix find cart_event --version v1
qa-sdk prefix find --summary
```

### 6.4 `prefix migrate` — version 마이그레이션

```bash
qa-sdk prefix migrate cart_event v1 v2
# // @prefix cart_event:v1 → // @prefix cart_event:v2 + index 재계산
```

### 6.5 `prefix impact` — 영향 범위

```bash
qa-sdk prefix impact cart_event
# cart_event 사용처:
#   pages/cart/add-to-cart.ts:1 — v1, dims: [action:0, product_id:1]
#   analysis/session-analyzer.ts:3 — v1, dims: [action:0]
```

---

## 7. 파싱 규칙

### 7.1 확장자별 주석 문자

표식은 **한줄 주석**으로만 작성한다. 언어별 한줄 주석 문자가 다르므로
stamp/drift 도구는 확장자를 보고 주석 접두사를 결정한다.

| 주석 접두사 | 확장자 |
|------------|--------|
| `//` | `.ts`, `.tsx`, `.js`, `.jsx`, `.mts`, `.mjs`, `.go`, `.rs`, `.java`, `.kt`, `.swift`, `.c`, `.cpp`, `.cs` |
| `#` | `.py`, `.sh`, `.bash`, `.zsh`, `.rb`, `.yaml`, `.yml`, `.toml`, `.r` |
| `--` | `.lua`, `.sql`, `.hs` |
| `%` | `.m` (MATLAB), `.erl` |

예시 — 같은 표식이 언어별로:

```ts
// @prefix cart_event:v1 — dims: [action:0, product_id:1]
```

```py
# @prefix cart_event:v1 — dims: [action:0, product_id:1]
```

```sh
# @prefix cart_event:v1 — dims: [action:0, product_id:1]
```

```sql
-- @prefix cart_event:v1 — dims: [action:0, product_id:1]
```

`@prefix` 이후의 포맷은 언어 불문 동일. 주석 접두사만 다르다.

### 7.2 정규식 — 2단계 파싱

**1단계: 표식 행 탐지** — 주석 접두사를 변수화하여 확장자별로 주입

```
/^[ \t]*<COMMENT_PREFIX>\s*@prefix\s+([\w-]+):([\w.]+)(?:\s+—\s+(.*))?$/
```

- `<COMMENT_PREFIX>`: 확장자별 `\/\/` | `#` | `--` | `%`
- 그룹 1: prefix ID (`[\w-]+` — 하이픈 포함)
- 그룹 2: version (`[\w.]+` — `v1`, `v1.2` 등)
- 그룹 3: 부가 정보 (dims, entry, 설명)

**2단계: 부가 정보 파싱** — 1단계 그룹 3에서 추출

dims:

```
/dims:\s*\[([^\]]+)\]/
```

각 dim 항목:

```
/([\w-]+):(\d+)/g
```

→ label:index 쌍. label에 하이픈 허용 (`product-id:1`)

entry:

```
/entry:\s*([\w-]+)\.([\w-]+)=(\d+)/
```

- 그룹 1: dim label
- 그룹 2: entry label
- 그룹 3: entry index

### 7.3 stamp 삽입 로직

```
1. 파일 확장자로 COMMENT_PREFIX 결정
2. 코드에서 prefix 사용 추출 (track/decode 호출부)
3. 카탈로그에서 version + index resolve
4. 표식 행 생성: `{COMMENT_PREFIX} @prefix {id}:{ver} — dims: [{dim:idx}, ...]`
5. 대상 함수/클래스/파일 상단에 삽입
6. 기존 표식이 있으면 → 동일 prefix ID 행을 교체 (다른 행은 유지)
```

### 7.4 ripgrep 호환

전체 코드베이스에서 표식을 찾을 때 주석 접두사를 몰라도 `@prefix`만으로 탐색 가능:

```bash
# 모든 언어에서 @prefix 표식 검색
rg "@prefix\s+cart_event"

# 특정 prefix의 특정 dim
rg "@prefix\s+cart_event:\w+ — dims:.*action:"
```

`@prefix`가 고유 토큰이므로 주석 접두사를 정규식에 넣지 않아도 충분히 정밀하다.
stamp/drift 같은 도구만 확장자별 접두사를 인식하면 된다.

---

## 8. 기존 인프라 연결 구조

### 8.1 계층 관계

```
계층:
  Catalog        prefix 정의 + 소유               PrefixMeta.source
  Manifest       서비스별 소비 prefix version      ManifestRegistry (ServiceVersionManifest)
  Codegen        prefix 상수 + version 스냅샷      PREFIX_IDS, VERSION_META, PrefixId 타입
  Mapping        이벤트→prefix dim 매핑            prefix-mapping.ts
  Service        서비스→prefix 생산 선언           ownedPrefixes / consumedPrefixes
  Lifecycle      prefix version 상태 전이          dkg version (lock/release/activate/deprecate)
  Code           코드→prefix label:index           // @prefix  ← 이 스펙
```

### 8.2 역할 매트릭스

| 질문 | 답하는 메커니즘 | 위치 |
|------|----------------|------|
| 이 prefix를 누가 정의했나? | `PrefixMeta.source` | `demo-catalog.ts` |
| 이 이벤트는 어떤 prefix로 매핑되나? | `prefix-mapping.ts` | `event-catalog/` |
| 이 서비스가 어떤 prefix를 생산하나? | `ownedPrefixes` | `seed-config.ts` |
| 이 서비스가 어떤 prefix를 어떤 version으로 소비하나? | `ServiceVersionManifest` | `ManifestRegistry` |
| codegen 시점에 각 prefix가 무슨 version이었나? | `VERSION_META.prefixVersions` | `demo-types/prefix-ids.ts` |
| 이 prefix의 현재 lifecycle 상태는? | `dkg version` CLI | `registry-service` |
| **이 코드가 이 prefix의 어떤 label:index에 바인딩되어 있나?** | **`// @prefix`** | **코드 주석** |

### 8.3 stamp이 기존 인프라를 활용하는 흐름

```
┌─ ManifestRegistry ─────────────────────┐
│ ServiceVersionManifest {               │
│   serviceId: "shopping-web",           │
│   prefixes: {                          │
│     "page_view": "v2",                 │  ← stamp이 version 결정에 사용
│     "cart_event": "v1",                │
│   }                                    │
│ }                                      │
└────────────────────────────────────────┘
         ↓ version
┌─ Catalog ──────────────────────────────┐
│ prefixes["cart_event"].labels           │
│   = ["action", "product_id", "env"]    │  ← stamp이 dim:index resolve에 사용
│     index: 0       1            2      │
└────────────────────────────────────────┘
         ↓ stamp 생성
┌─ Code ─────────────────────────────────┐
│ // @prefix cart_event:v1 — dims: [action:0, product_id:1]
│ function addToCart(item) {             │
│   track("cart_event", { action: "add" })│
│ }                                      │
└────────────────────────────────────────┘
         ↓ drift 검증
┌─ VERSION_META ─────────────────────────┐
│ prefixVersions: {                      │
│   "cart_event": "v1",  ← 스탬프와 일치?│
│ }                                      │
└────────────────────────────────────────┘
```

### 8.4 codegen이 제공하는 상수와의 관계

codegen (`qa-sdk codegen`)이 이미 생성하는 것:

| 생성물 | 내용 | stamp과의 관계 |
|--------|------|---------------|
| `PrefixId` 타입 | prefix 이름 유니온 | 코드에서 prefix ID 타입 안전성 보장 |
| `PREFIX_IDS` 상수 | prefix 이름 배열 (`as const`) | 코드에서 prefix ID를 상수로 참조 (리터럴 하드코딩 방지) |
| `VERSION_META` | prefix별 version 스냅샷 | stamp의 version resolve 소스 |
| dim 인터페이스 | prefix별 dim 타입 | 타입 수준에서 dim 안전성 보장 |

**PREFIX_IDS + stamp의 역할 분리**:
- `PREFIX_IDS` / `PrefixId` → "어떤 prefix를 쓸 수 있는가" (타입 안전성)
- `// @prefix` → "이 코드가 실제로 어떤 prefix의 어떤 dim:index에 바인딩되어 있는가" (런타임 바인딩 추적)

타입 시스템은 "잘못된 prefix 이름"을 컴파일 시점에 막고,
stamp은 "version/index가 바뀌었을 때 영향 범위"를 추적한다.

### 8.5 dkg version / dkg publish와의 연동

prefix version 상태 전이 시 stamp drift가 자동 감지:

```
1. dkg version activate cart_event v2     ← v2 활성화
2. qa-sdk prefix drift                    ← 기존 v1 스탬프와 불일치 탐지
   WARNING  version-behind: cart_event — 표식 v1, 최신 v2
3. qa-sdk prefix stamp --update           ← 스탬프를 v2로 갱신
   또는
   qa-sdk prefix migrate cart_event v1 v2 ← v1→v2 일괄 마이그레이션
```

---

## 9. 예시 시나리오

### 9.1 stamp 자동 생성

```ts
// ── 표식 없는 코드 (before) ──
function addToCart(item: CartItem) {
  monitor.emitWithCoords("cart.add", {
    cart_event: { action: "add", product_id: item.id },
  });
}

// ── qa-sdk prefix stamp 실행 후 (after) ──
// @prefix cart_event:v1 — dims: [action:0, product_id:1]
function addToCart(item: CartItem) {
  monitor.emitWithCoords("cart.add", {
    cart_event: { action: "add", product_id: item.id },
  });
}
```

stamp이 한 일:
1. `emitWithCoords` 호출에서 prefix ID `"cart_event"` + dim keys `["action", "product_id"]` 추출
2. `latestPrefixVersion(catalog, "cart_event")` → `"v1"`
3. v1의 labels `["action", "product_id", "env"]`에서 index resolve
4. 함수 위에 `// @prefix` 한줄 주석 삽입

### 9.2 stamp --update (카탈로그 변경 후 갱신)

카탈로그에서 cart_event v2의 labels가 `["env", "action", "product_id"]`로 변경 후:

```bash
$ qa-sdk prefix stamp --update
# pages/cart/add-to-cart.ts:1
#   // @prefix cart_event:v1 — dims: [action:0, product_id:1]
#   → // @prefix cart_event:v2 — dims: [action:1, product_id:2]
```

### 9.3 반자동 — decode 소비자

```ts
// ── prefix ID 힌트만 수동 입력 ──
// @prefix auth_event
function checkAdmin(decoded: DecodeResult) {
  return decoded.dims.role?.value === "admin";
}

// ── qa-sdk prefix stamp 실행 후 ──
// @prefix auth_event:v1 — dims: [role:2] — entry: role.admin=0
function checkAdmin(decoded: DecodeResult) {
  return decoded.dims.role?.value === "admin";
}
```

stamp이 한 일:
1. `// @prefix auth_event` 힌트에서 prefix ID 추출
2. 함수 본문에서 `dims.role` 접근 + `"admin"` 비교 감지
3. 카탈로그에서 version + role index + admin entry index resolve
4. 한줄 주석 갱신

### 9.4 복수 prefix 사용

```ts
// @prefix page_view:v1 — dims: [page:0, locale:1]
// @prefix tracking:v1 — dims: [trackAction:0, page:1]
export function HomePage() {
  monitor.emitWithCoords("page.home", {
    page_view: { page: "home", locale: "ko", userType: "member" },
    tracking: { trackAction: "view", page: "home", userType: "member" },
  });
}
```

### 9.5 drift 시나리오 — 사일런트 브레이킹

```
$ qa-sdk prefix drift
ERROR  index-mismatch: cart_event:v1 action — 표식 index:0, v2 실제 index:1
  → pages/cart/add-to-cart.ts:1 // @prefix cart_event:v1 — dims: [action:0, product_id:1]

WARNING  version-behind: cart_event — 표식 v1, 최신 v2
  → pages/cart/add-to-cart.ts:1
```

### 9.6 version 마이그레이션

```bash
$ qa-sdk prefix migrate cart_event v1 v2
# 변경 대상 2건:
#   pages/cart/add-to-cart.ts:1
#     // @prefix cart_event:v1 — dims: [action:0, product_id:1]
#     → // @prefix cart_event:v2 — dims: [action:1, product_id:2]
#   analysis/session-analyzer.ts:3
#     // @prefix cart_event:v1 — dims: [action:0]
#     → // @prefix cart_event:v2 — dims: [action:1]
```

---

## 10. 도입 전략

### Phase 1 — 규약 + 기반 (완료)

- [x] 이 스펙 작성
- [x] `qa-sdk prefix stamp` CLI 구현 (SDK 앵커 탐지 + 자동 삽입)
- [x] `qa-sdk prefix drift` CLI 구현 (label-index 불일치 경고)
- [x] `qa-sdk prefix find` CLI 구현 (표식 기반 탐색)
- [x] 확장자별 주석 매핑 (JS/TS/Python/Shell 등)
- [x] 중복 방지 로직
- [x] 기존 코드 3곳 수동 스탬프 (service prefix)

### Phase 2 — version resolve 강화

- [ ] stamp에서 `ServiceVersionManifest` 기반 version resolve 연동
- [ ] stamp에서 `VERSION_META.prefixVersions` 기반 version resolve 연동
- [ ] `--service` 옵션으로 서비스 매니페스트 기반 스탬프
- [ ] 조건 상수 패턴 자동 인식 (`a ? "X" : "Y"` → 양쪽 다 스탬프)

### Phase 3 — 마이그레이션 + CI

- [ ] `qa-sdk prefix migrate` — version 마이그레이션 시 표식 일괄 갱신
- [ ] `qa-sdk prefix impact` — entry 변경 영향 범위
- [ ] `dkg version` 상태 전이 시 자동 drift check 연동
- [ ] CI 통합 (선택)
- [ ] `PrefixMeta.source` 100% 채우기

---

## 관련 소스

| 파일 | 역할 |
|------|------|
| `packages/cli/src/commands/prefix-stamp.ts` | stamp/drift/find CLI 구현 |
| `packages/definition-catalog/src/version-manifest.ts` | ManifestRegistry + ServiceVersionManifest |
| `packages/demo-types/src/prefix-ids.ts` | PREFIX_IDS, PrefixId, VERSION_META (codegen) |
| `packages/codegen-core/src/catalog-typescript.ts` | codegen 생성 로직 |
| `packages/demo-snapshot/src/demo-catalog.ts` | PrefixMeta.source (소유 정보) |
| `packages/event-catalog/src/prefix-mapping.ts` | 이벤트→prefix 매핑 SSOT |
| `packages/registry-service/src/core/seed-config.ts` | ownedPrefixes / consumedPrefixes |
| `packages/core/src/catalog/runtime.ts` | latestPrefixVersion, encodePrefix |
| `packages/spec-core/src/propagation/lifecycle.ts` | version 상태 전이 + 전파 |
| `packages/cli/src/commands/dkg.ts` | dkg version / dkg publish CLI |
