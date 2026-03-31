---
def:
  id: coord-layer-separation
  address: def_document:v2:414856
  scope: feature
  aspect: func_def
  depth: specification
  svc: weighted-index
  lifecycle: approved
  layer: domain
  tags: [runtime, structural, contract]
  links:
    - target: coord-foundation
      type: refines
---

# 레이어 분리

## 목적 ^purpose

좌표 시스템의 3-레이어(수학/스키마/데이터) 분리 원칙과 각 레이어의 경계, weighted-index 내부 모듈 계층을 정의한다.

## 3-레이어 구조

| 레이어 | 패키지 | 관심사 | 예시 |
|---|---|---|---|
| **수학** | `weighted-index` | 정수 ↔ n-차원 좌표 변환 | `encode([3,2,1]) → 42` |
| **스키마** | `index-meta` | 축의 의미, 각 위치의 엔티티 정의 | `"role" 축 3번 위치 = "admin"` |
| **데이터** | 사용자 구현 | 실제 값 저장, versionId 추적 | DB에 `"perm:iv1:13"` 저장 |

각 레이어의 경계:

- **수학 레이어는 의미를 모른다.** `WeightedIndex`는 shape(숫자 배열)만 알고, 그 숫자가 역할인지 액션인지 모른다.
- **스키마 레이어는 저장을 모른다.** `MetaRegistry`는 entries와 버전 정보를 들고 있지만, 실제로 DB에 어떻게 저장되는지 모른다. `versionId`가 `DimKind` 정의에 없는 이유: 어떤 버전과 함께 저장할지는 데이터 레이어의 관심사다.
- **데이터 레이어는 구조를 모른다.** DB에는 `"perm:iv1:13"` 문자열만 저장된다. 이 값의 의미를 풀려면 스키마 레이어가 필요하다.

## weighted-index 내부 레이어

`weighted-index` 안에서도 계층이 있다:

| 모듈 | 역할 | 의존 |
|---|---|---|
| `calc` | stride 공식 canonical 구현 (`calcWeights`) + 범위 연산 유틸 | 없음 (순수 함수) |
| `WeightedIndex` | 순수 수학 엔진 (Number) | `calcWeights` (stride 계산 위임) |
| `WeightedIndexBig` | 순수 수학 엔진 (BigInt, shape product > 2^53) | 없음 (shape만) |
| `LabelRegistry` | 레이블별 entity ID ↔ 1-based index | WeightedIndex 불필요 |
| `PrefixCodec` | 레이블 조합 + 버전 관리 + encode/decode | WeightedIndex + LabelRegistry |
| `bitmask`, `obfuscate` | 독립 유틸 | 아무 것에도 의존하지 않음 |

> **Note**: `WeightedIndex`와 `WeightedIndexBig`은 동일한 알고리즘의 Number/BigInt 구현이다. 둘 다 shape만 알면 동작하며, 직렬화 포맷이나 `numberType` 선택에 관여하지 않는다. 엔진 선택은 상위 레이어(어댑터)가 `shapeProduct`/`maxProductBig` 등 패키지 유틸로 shape product를 사후 분석하여 결정한다.
> 검증: [`format-adapter.test.ts`](../../../packages/weighted-index/src/format-adapter.test.ts) §1–§7

`PrefixCodec`와 `MetaRegistry`는 구조적으로 유사하다. `MetaRegistry`가 기능적 상위 호환이지만, `PrefixCodec`는 컴파일 타임 타입 안전성(`InferLabelSchema`)을 제공하고 `weighted-index` 자체를 독립 사용할 수 있는 경로를 유지한다.
