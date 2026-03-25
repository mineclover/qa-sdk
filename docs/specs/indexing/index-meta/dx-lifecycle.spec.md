---
def:
  id: dx-lifecycle-spec
  scope: flow
  aspect: user_scenario
  depth: specification
  lifecycle: approved
---

# DX 라이프사이클 스펙

## 목적 ^purpose

CLI, 코드젠, 타입 추론, 와이어 포맷을 아우르는 개발자 경험(DX) 전체 동선.
IndexSDK 기반 소비 패턴: [sdk.spec.md](sdk.spec.md)
슬롯 마커: [../slot-marker.spec.md](../slot-marker.spec.md)

---

## 상태

planned

---

## 1. 문제

IndexSDK는 런타임에서 encode/decode/constants를 제공하지만, 개발자가 스키마 상태를 확인하거나 타입 안전한 코드를 작성하려면 매번 코드를 작성해야 한다.

| 작업 | 현재 (SDK만) | 목표 (DX 도구 포함) |
|------|-------------|-------------------|
| 현재 dim entries 확인 | 코드 작성 후 실행 | `index-meta info role` |
| 타입 안전한 상수 사용 | `as const` 수동 선언 | 자동 생성된 `.d.ts` 또는 제네릭 추론 |
| 용량 여유 확인 | `dimCapacity()` 호출 코드 작성 | `index-meta capacity perm/v1` |
| 버전 간 diff | 수동 비교 | `index-meta diff perm v1 v2` |
| 프론트엔드에 상수 전달 | JSON 직접 추출 | `index-meta codegen --format ts` |

---

## 2. DX 전체 동선

```
정의                     생성                      사용
──────────              ──────────                ──────────
스키마 작성              CLI codegen               import 상수
(MetaRegistryInput)        ↓                      IDE 자동완성
       ↓               .d.ts / .ts / .js             ↓
  스키마 파일 저장           생성                  encode/decode
(.ts / .js / JSON)                               타입 검증됨
       ↓
  CLI로 상태 확인
  (info, capacity, diff)
```

### 라이프사이클 단계

```
① 스키마 정의 → ② CLI 검증·조회 → ③ codegen → ④ 개발 (타입 안전) → ⑤ entry 추가
                                                                        ↓
                                                          ⑥ codegen 재실행 → ④
```

- **①→②**: 스키마 파일을 CLI가 읽어 구조·용량·diff 확인
- **②→③**: codegen으로 typed constants 파일 생성
- **③→④**: 생성된 상수를 import해 타입 안전하게 개발
- **⑤→⑥**: 관리 레이어에서 entry 추가 → codegen 재실행으로 상수 동기화

---

## 3. CLI

### 3.1 스키마 로딩

CLI는 다양한 포맷의 스키마 파일을 읽을 수 있어야 한다.

| 포맷 | 확장자 | 로딩 방식 | 사용 시나리오 |
|------|--------|----------|-------------|
| TypeScript | `.ts` | tsx / ts-node 실행 | 개발 환경 |
| JavaScript (ESM) | `.mjs` | dynamic import | Node.js ESM 프로젝트 |
| JavaScript (CJS) | `.cjs` | require() | Node.js CJS 프로젝트 |
| IIFE | `.js` | eval 또는 vm.runInContext | 브라우저 번들, CDN |
| JSON | `.json` | JSON.parse | 직렬화된 스키마 |

스키마 파일은 `MetaRegistryInput`을 default export 또는 named export(`schema`)로 내보내야 한다.

```ts
// schema.ts — default export
const schema: MetaRegistryInput = { dims: { ... }, indices: { ... } };
export default schema;

// schema.ts — named export
export const schema: MetaRegistryInput = { dims: { ... }, indices: { ... } };
```

### 3.2 명령어

#### `index-meta info <dimId|indexId>`

스키마 구조 조회. dim 또는 index의 현재 상태를 출력한다.

```
$ index-meta info role --schema ./schema.ts

Dim: role
Kind: string_enum
Snapshots: v1, v2

Snapshot v1:
  Entries (5): ["_", "~", "admin", "editor", "viewer"]
  Reserved: [1]="_", [2]="~"
  Capacity: 8
  Headroom: 3

Snapshot v2:
  Entries (6): ["_", "~", "admin", "editor", "viewer", "moderator"]
  Reserved: [1]="_", [2]="~"
  Capacity: 8
  Headroom: 2
```

#### `index-meta capacity <indexId/versionId>`

index version의 dim별 용량 정보를 출력한다.

```
$ index-meta capacity perm/v1 --schema ./schema.ts

Index: perm / Version: v1
Shape: [5, 4, 3]  Size: 60

  Dim       Snapshot  Total  Capacity  Headroom
  ────────  ────────  ─────  ────────  ────────
  role      v1        5      8         3
  action    v1        4      6         2
  resource  v1        3      3         0  ← 확장 필요
```

#### `index-meta constants <indexId/versionId> [dimId]`

상수 객체를 출력한다. dimId를 생략하면 모든 dim의 상수를 출력한다.

```
$ index-meta constants perm/v1 role --schema ./schema.ts

{
  admin: "admin",
  editor: "editor",
  viewer: "viewer"
}
```

#### `index-meta diff <indexId> <versionA> <versionB>`

두 버전 간 변경 사항을 출력한다.

```
$ index-meta diff perm v1 v2 --schema ./schema.ts

Index: perm
  v1 → v2

  Dim: role
    Snapshot: v1 → v2
    + moderator (position 6)

  Dim: action
    Snapshot: v1 → v1  (변경 없음)

  Shape: [5, 4, 3] → [6, 4, 3]
  Size:  60 → 72
```

#### `index-meta codegen`

타입 정의 파일 또는 상수 모듈을 생성한다. → §4 참조.

### 3.3 공통 옵션

| 옵션 | 기본값 | 설명 |
|------|--------|------|
| `--schema <path>` | `./schema.ts` | 스키마 파일 경로 |
| `--format <fmt>` | `text` | 출력 포맷 (`text`, `json`) |
| `--reserved` | `"_,~,?"` | 예약 토큰 (쉼표 구분) |

---

## 4. 코드젠 (codegen)

### 4.1 생성 모드

타입 추론을 위한 두 가지 접근법을 모두 제공한다.

#### A. codegen — `.d.ts` 생성

CLI가 스키마를 읽어 TypeScript 타입 정의 파일을 생성한다.

```
$ index-meta codegen --schema ./schema.ts --out ./generated/schema.d.ts
```

생성 결과:

```ts
// generated/schema.d.ts — 자동 생성, 수동 편집 금지

/** perm index, version v1 */
export declare namespace Perm_V1 {
  type Role = "admin" | "editor" | "viewer";
  type Action = "read" | "write" | "delete";

  const ROLE: Readonly<{ admin: "admin"; editor: "editor"; viewer: "viewer" }>;
  const ACTION: Readonly<{ read: "read"; write: "write"; delete: "delete" }>;
}
```

**장점**: 확실한 타입, LSP에서 즉시 인식
**단점**: 빌드 스텝 필요, 스키마 변경 시 재생성

#### B. 제네릭 추론 — `as const`

`createIndexSDK(schema as const)`에서 TypeScript가 리터럴 타입을 추론한다.

```ts
const schema = {
  dims: {
    role: {
      kind: { type: "string_enum" } as const,
      snapshots: {
        v1: { entries: ["admin", "editor", "viewer"] as const },
      },
    },
  },
  indices: {
    perm: {
      dims: ["role"] as const,
      versions: { v1: { snapshots: { role: "v1" } } },
    },
  },
} as const;

const sdk = createIndexSDK(schema);
const perm = sdk.client("perm", "v1");
const ROLE = perm.constants("role");
// 타입 추론: { admin: "admin", editor: "editor", viewer: "viewer" }
```

**장점**: 빌드 스텝 없음, 스키마 변경 시 자동 반영
**단점**: `as const` 필수, 복잡한 스키마에서 추론 한계 가능

### 4.2 생성 포맷

| 포맷 | 확장자 | 용도 |
|------|--------|------|
| TypeScript declarations | `.d.ts` | TS 프로젝트 타입 정의 |
| TypeScript module | `.ts` | 상수 + 타입 함께 사용 |
| JavaScript (ESM) | `.mjs` | JS ESM 프로젝트 |
| JavaScript (CJS) | `.cjs` | JS CJS 프로젝트 |
| JSON | `.json` | 범용 데이터 전달 |

### 4.3 codegen 옵션

```
$ index-meta codegen [options]

Options:
  --schema <path>     스키마 파일 경로 (기본: ./schema.ts)
  --out <path>        출력 파일 경로 (기본: stdout)
  --format <fmt>      출력 포맷 (ts, dts, mjs, cjs, json)
  --index <id>        특정 index만 생성 (생략 시 전체)
  --version <id>      특정 version만 생성 (생략 시 최신)
  --reserved <tokens> 예약 토큰 (쉼표 구분, 기본: "_,~,?")
```

---

## 5. 와이어 포맷

encode 결과를 전송할 때 두 가지 방식을 지원한다.

### A. full VersionedValue

현재 지원하는 방식. indexId + versionId + value를 모두 전송한다.

```ts
const vv = perm.encode({ role: "admin", action: "read" });
// → { indexId: "perm", versionId: "v1", value: 3 }

// 전송
POST /api/check { vv: { indexId: "perm", versionId: "v1", value: 3 } }
```

**장점**: 자기 설명적, 수신 측에서 어떤 index/version인지 즉시 판별
**단점**: 페이로드 크기, prefix 스펙 노출

### B. dim별 인덱스 전송

개발자는 friendly name으로 코딩하고, 전송 시에는 dim별 1-based index만 전달한다.
prefix 스펙(indexId, versionId)은 양쪽이 사전에 합의하거나 별도 채널로 공유한다.

```ts
const vv = perm.encode({ role: "admin", action: "read" });
const indices = perm.toIndices({ role: "admin", action: "read" });
// → { role: 3, action: 1 }

// 전송 — prefix 스펙 숨김
POST /api/check { role: 3, action: 1 }
```

**장점**: 최소 페이로드, prefix 스펙 비노출
**단점**: 수신 측이 index/version을 사전에 알아야 함

### 선택 기준

| 상황 | 권장 포맷 |
|------|----------|
| 마이크로서비스 간 통신 | A (full VersionedValue) |
| 프론트엔드 → 백엔드 | B (dim별 인덱스) — prefix 합의 가능 |
| DB 저장 | A (자기 설명적 필요) |
| 실시간 이벤트 스트림 | B (페이로드 최소화) |
| 외부 API 공개 | A (수신 측이 스키마를 모를 수 있음) |

---

## 6. 타입 추론 설계

### 목표

개발자가 `constants()` 반환값의 키를 IDE에서 자동완성으로 사용할 수 있어야 한다.

```ts
const ROLE = perm.constants("role");
//    ^? Readonly<{ admin: "admin"; editor: "editor"; viewer: "viewer" }>

ROLE.admin   // ✓ 자동완성
ROLE.hacker  // ✗ 타입 에러
```

### 제네릭 타입 파라미터 설계 (B 방식)

`createIndexSDK`의 제네릭이 `MetaRegistryInput`의 리터럴 타입을 캡처해야 한다.

```ts
function createIndexSDK<T extends MetaRegistryInput>(
  input: T,
  options?: IndexSDKOptions,
): IndexSDK<T>;
```

이 때 `IndexSDK<T>`가 `client(indexId, versionId)`의 반환 타입에서:
- `indexId`는 `T["indices"]`의 키로 제한
- `versionId`는 해당 index의 `versions` 키로 제한
- `constants(dimId)`의 반환 타입은 해당 version의 snapshot에서 추론

### 타입 레벨 제약

TypeScript의 conditional types + mapped types + template literal types로 구현 가능하나,
깊은 제네릭 체인은 IDE 성능에 영향을 줄 수 있다.

| 레벨 | 추론 범위 | 복잡도 | IDE 영향 |
|------|----------|--------|---------|
| L0 | indexId, versionId 키 제한만 | 낮음 | 없음 |
| L1 | + dimId 키 제한 | 중간 | 미미 |
| L2 | + constants() 반환 타입 추론 | 높음 | 가능 |
| L3 | + encode() 입력 타입 검증 | 매우 높음 | 주의 필요 |

**단계적 접근**: L0 → L1 → L2 순서로 구현하고, 각 단계에서 IDE 성능을 측정한다.

---

## 7. 제약

### CLI

- CLI는 스키마를 **읽기만** 한다. entry 추가, version 생성 등 쓰기 작업은 관리 레이어의 책임이다.
- CLI 출력은 사람이 읽을 수 있는 텍스트와 프로그래밍 가능한 JSON을 모두 지원해야 한다.

### codegen

- 생성된 파일에는 `// 자동 생성, 수동 편집 금지` 주석을 포함한다.
- 생성된 상수는 `Object.freeze()`로 불변이어야 한다.
- 예약 토큰과 inactive 항목은 생성 결과에서 제외된다.

### 와이어 포맷

- B 방식(dim별 인덱스)은 양쪽이 동일한 version을 사용한다는 전제가 필요하다.
  version 불일치 시 인덱스가 다른 entity를 가리킬 수 있다.
- B 방식에서 version 협상 메커니즘은 이 스펙의 범위 밖이다 (별도 프로토콜 스펙 필요).

### 타입 추론

- `as const` 없이는 TypeScript가 리터럴 타입을 추론하지 않는다.
  codegen 방식(A)은 이 제약이 없다.
- 복잡한 스키마에서 제네릭 추론은 IDE 성능 저하를 유발할 수 있다.
  이 경우 codegen 방식(A)을 권장한다.
