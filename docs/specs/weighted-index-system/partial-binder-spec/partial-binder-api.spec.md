---
def:
  id: partial-binder-api
  scope: interface
  aspect: api_contract
  depth: specification
  svc: weighted-index
  lifecycle: approved
  layer: domain
  tags: [entry-point, contract, runtime]
  links:
    - target: partial-binder-spec
      type: refines
---

# PartialBinder 공개 API

## 목적 ^purpose

`createBinder` 팩토리 함수와 `PartialBinder` 인터페이스의 시그니처, 속성, 메서드 계약을 정의한다.

## 구성 ^overview

소스: `packages/weighted-index/src/partial-binder.ts`

이 모듈의 public export는 두 개다.

| export | 형태 | 계약 |
|---|---|---|
| `createBinder` | function | `PrefixCodec`와 prefix에 대해 부분 바인딩된 인코더를 생성한다. |
| `PartialBinder` | interface | 바인딩 상태(`bound`, `free`, `prefix`, `version`)와 계산 API(`resolve`, `resolveId`, `bind`)를 노출한다. |

이 두 export는 `packages/weighted-index/src/index.ts`에서도 패키지 공개 API로 재수출된다.

### `createBinder(codec, prefix, fixed, version?)`

```ts
createBinder(
  codec: PrefixCodec,
  prefix: string,
  fixed: Record<string, EntityId>,
  version?: string,
): PartialBinder
```

매개변수:

| 이름 | 타입 | 의미 |
|---|---|---|
| `codec` | `PrefixCodec` | label registry와 prefix 정의를 보유한 코덱 |
| `prefix` | `string` | 대상 address space 이름 |
| `fixed` | `Record<string, EntityId>` | 미리 고정할 라벨 값들 |
| `version` | `string \| undefined` | 대상 prefix version. 생략 시 `codec.getCurrentVersion(prefix)` |

동작:

- `fixed`의 key가 해당 prefix에 없는 라벨이면 `RangeError`를 던진다.
- `version`을 생략하면 생성 시점의 current version을 고정한다.
- 반환값은 같은 `prefix`/`version`을 유지하는 `PartialBinder`다.

### `PartialBinder`

```ts
interface PartialBinder {
  readonly bound: Readonly<Record<string, EntityId>>;
  readonly free: readonly string[];
  readonly prefix: string;
  readonly version: string;

  resolve(remaining: Record<string, EntityId>): VersionedIndex;
  resolveId(remaining: Record<string, EntityId>): number;
  bind(additional: Record<string, EntityId>): PartialBinder;
}
```

속성:

| 멤버 | 설명 |
|---|---|
| `bound` | 이미 고정된 라벨과 값 |
| `free` | 아직 입력받아야 하는 남은 라벨 목록 |
| `prefix` | 어떤 prefix address space를 대상으로 하는지 |
| `version` | 어떤 prefix version snapshot에 고정되었는지 |

메서드:

| 메서드 | 반환 | 계약 |
|---|---|---|
| `resolve(remaining)` | `VersionedIndex` | 자유 차원을 받아 `{ prefix, v, id }`를 계산한다. |
| `resolveId(remaining)` | `number` | `resolve(remaining).id`의 단축형이다. |
| `bind(additional)` | `PartialBinder` | 추가 차원을 고정한 새 binder를 반환한다. 체이닝 가능하다. |

체이닝 규칙:

- `bind()`는 기존 binder를 mutate하지 않고 새 binder를 반환한다.
- 체이닝 중에도 `prefix`와 `version`은 유지된다.
- `free`는 단계가 진행될수록 줄어들 수 있고, 모두 고정되면 `free`는 빈 배열이 된다.
