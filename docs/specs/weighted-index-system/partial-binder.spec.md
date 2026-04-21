---
def:
  id: partial-binder-spec
  tier: system
  address: def_document:v2:68779
  scope: feature
  aspect: binder_func
  depth: overview
  svc: weighted-index
  lifecycle: approved
  layer: domain
  tags: [runtime, structural, entry-point]
  links:
    - target: wi-api
      type: contains
    - target: wi-math
      type: contains
    - target: partial-binder-api
      type: contains
    - target: partial-binder-math
      type: contains
    - target: partial-binder-patterns
      type: contains
    - target: partial-binder-validation
      type: contains
---

# weighted-index partial-binder

## 목적 ^purpose

`PartialBinder`는 `PrefixCodec` 위에서 동작하는 차원 부분 바인딩(curried encoder) 레이어다.
전체 경로 중 고정 차원은 부트 시점에 캐시하고, 런타임에는 남은 차원만 받아 같은 1D address space 안에서 최종 주소를 계산한다.

## 구성 ^overview

- **공개 API 2종**: `createBinder(codec, prefix, fixed, version?)` 팩토리 함수와 `PartialBinder` 인터페이스 (bound/free/prefix/version 속성 + resolve/resolveId/bind 메서드)
- **free 계산 규칙**: `codec.getLabels(prefix)`에서 bound를 뺀 나머지를 원래 순서대로 유지하며, resolve 시 free 라벨 전부 필수
- **mixed-radix 분리**: `address = fixedBase + remainingBase` — 고정 차원 기여분을 캐시하고 자유 차원만 런타임에 계산
- **불변 체이닝**: `bind()`는 새 PartialBinder를 반환 (원본 불변). prefix/version은 체이닝 전체에서 유지
- **EntityId 기반 입력**: raw ordinal이 아닌 문자열 라벨 값을 받아 내부적으로 LabelRegistry를 통해 1-based 인덱스로 변환

### 관련 소스

- `packages/weighted-index/src/partial-binder.ts`
- `packages/weighted-index/src/partial-binder.test.ts`
- `packages/weighted-index/src/calc.ts` — `partialQueryBase`
- `packages/weighted-index/src/prefix-registry.ts` — `PrefixCodec.encodeFromIds()`
