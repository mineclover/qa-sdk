---
def:
  tier: component
  id: partial-binder-validation
  scope: constraint
  aspect: tech_constraint
  depth: specification
  svc: weighted-index
  lifecycle: approved
  layer: domain
  tags: [testing, structural, runtime]
  links:
    - target: partial-binder-spec
      type: refines
sources:
  - packages/weighted-index/src/vocab/partial-binder.ts
  - packages/weighted-index/src/vocab/partial-binder.test.ts
  - packages/weighted-index/src/vocab/prefix-registry.ts
  - packages/weighted-index/src/vocab/prefix-registry.test.ts
---

# PartialBinder 에러 및 검증 규칙

## 목적 ^purpose

PartialBinder의 입력 검증, 에러 종류, export coverage 매핑을 정의한다.

## 구성 ^overview

### 에러 검증

| 상황 | 동작 |
|---|---|
| `fixed`에 prefix에 없는 라벨이 포함됨 | `RangeError("Unknown label ...")` |
| `resolve()`/`resolveId()`에서 `free` 라벨이 빠짐 | `RangeError("Missing label ...")` |
| 라벨은 맞지만 entity ID가 해당 label version에 없음 | `EntityNotFoundError` |

추가 규칙:

- `resolve()`는 자유 차원 누락을 허용하지 않는다.
- `resolveId()`는 `resolve()`와 같은 검증을 수행하고 결과 `id`만 반환한다.
- version은 binder 생성 시 결정되며, 이후 `bind()` 체이닝에서도 그대로 유지된다.

### export coverage 매핑

`packages/weighted-index/src/partial-binder.ts`의 공개 표면이 문서에 모두 반영되었는지 확인하는 매핑 표다.

| 소스 export / 멤버 | 문서 위치 |
|---|---|
| `createBinder` | partial-binder-api §createBinder |
| `PartialBinder` | partial-binder-api §PartialBinder |
| `PartialBinder.bound` | partial-binder-api 속성 표 |
| `PartialBinder.free` | partial-binder-math §free 계산 규칙 |
| `PartialBinder.prefix` | partial-binder-api 속성 표 |
| `PartialBinder.version` | partial-binder-api, 이 문서 §에러 |
| `PartialBinder.resolve()` | partial-binder-api, partial-binder-patterns §연동 |
| `PartialBinder.resolveId()` | partial-binder-api, partial-binder-patterns §SDK |
| `PartialBinder.bind()` | partial-binder-api, partial-binder-math §체이닝 |
