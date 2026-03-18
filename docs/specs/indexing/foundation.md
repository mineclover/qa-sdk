# 인덱싱 시스템 기반 원리

> 시스템이 **무엇인가**를 정의하는 근본 원리.
> 사용 패턴은 [`patterns.md`](patterns.md), 프로젝트 관례는 [`conventions.md`](conventions.md)를 참조한다.

관련 스펙:
- [`weighted-index/`](weighted-index/README.md)
- [`index-meta/`](index-meta/README.md)

---

## 1. 닫힌 조합 공간

WeightedIndex는 **설계 시점에 상한이 고정된 유한 차원**에만 적용한다.

| 차원 종류 | 적합 | 이유 |
|---|---|---|
| 역할 수, 액션 수, 환경 수 | ✅ | 설계 시 고정된 유한 집합 |
| API 리소스 × 테넌트 조합 | ✅ | 차원 수가 사전에 확정됨 |
| 타임스텝 t (무한 증가) | ❌ | 상한 불명. 외부 Map으로 관리 |
| UUID, 레코드 ID | ❌ | 상한이 2^128 → size 초과 |

> **판단 기준**: 차원의 최댓값이 코드 작성 시점에 확정되지 않으면 WeightedIndex 차원이 아니다. 확정되지 않는 값은 외부에서 키로 관리하고, 그 키마다 독립된 WeightedIndex 공간을 운용한다.

### 전단사(bijection) 보장

모든 인코딩은 겹침 없고 빈 값 없는 전단사다. `[0, size-1]` 범위의 정수가 가능한 모든 조합에 1:1로 대응한다.

이것이 가능하게 하는 것:
- 역변환이 항상 가능하다 — 정수만 있으면 원래 좌표를 복원할 수 있다
- 비트마스크와 호환된다 — 조합 집합을 Uint8Array로 표현할 수 있다
- 범위 쿼리가 가능하다 — 특정 차원을 고정하면 나머지 차원의 조합을 계산할 수 있다

---

## 2. 버전화된 닫힌 공간의 계열

"닫힌 공간"이라는 제약은 **단일 버전 수준에서만 성립하면 충분하다.**

```
perm:iv1:13  →  iv1 기준 닫힌 공간(3×3×3)에서의 13번
perm:iv2:13  →  iv2 기준 닫힌 공간(4×3×3)에서의 13번  ← 완전히 다른 의미
```

`indexId + versionId`가 "어떤 닫힌 공간 기준인가"를 명시한다. 공간 자체가 바뀌어도 저장된 값은 해당 버전으로 항상 decode 가능하다.

실제로 관리하는 것은 **버전화된 닫힌 공간들의 계열**이다:
- `indexId` = 어떤 조합 스키마 (어떤 축들이 어떤 순서로)
- `versionId` = 그 스키마의 특정 시점 스냅샷 (각 축의 entries가 확정된 닫힌 공간)
- `value` = 그 닫힌 공간 내의 정수

### entries append-only 원칙

DimSnapshot의 entries 배열은 append-only다. 기존 위치를 건드리지 않고 끝에 추가하면, **공간이 확장되는 신규 버전**을 만들면서도 이전 버전 값들이 유효하게 유지된다.

---

## 3. 레이어 분리

| 레이어 | 패키지 | 관심사 | 예시 |
|---|---|---|---|
| **수학** | `weighted-index` | 정수 ↔ n-차원 좌표 변환 | `encode([3,2,1]) → 42` |
| **스키마** | `index-meta` | 축의 의미, 각 위치의 엔티티 정의 | `"role" 축 3번 위치 = "admin"` |
| **데이터** | 사용자 구현 | 실제 값 저장, versionId 추적 | DB에 `"perm:iv1:13"` 저장 |

각 레이어의 경계:

- **수학 레이어는 의미를 모른다.** `WeightedIndex`는 shape(숫자 배열)만 알고, 그 숫자가 역할인지 액션인지 모른다.
- **스키마 레이어는 저장을 모른다.** `MetaRegistry`는 entries와 버전 정보를 들고 있지만, 실제로 DB에 어떻게 저장되는지 모른다. `versionId`가 `DimKind` 정의에 없는 이유: 어떤 버전과 함께 저장할지는 데이터 레이어의 관심사다.
- **데이터 레이어는 구조를 모른다.** DB에는 `"perm:iv1:13"` 문자열만 저장된다. 이 값의 의미를 풀려면 스키마 레이어가 필요하다.

### weighted-index 내부 레이어

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
> 검증: [`format-adapter.test.ts`](../../packages/weighted-index/src/format-adapter.test.ts) §1–§7

`PrefixCodec`와 `MetaRegistry`는 구조적으로 유사하다. `MetaRegistry`가 기능적 상위 호환이지만, `PrefixCodec`는 컴파일 타임 타입 안전성(`InferLabelSchema`)을 제공하고 `weighted-index` 자체를 독립 사용할 수 있는 경로를 유지한다.

---

## 4. 가속 지향 설계 원칙

> 상세: [`acceleration.md`](acceleration.md) — 하드웨어 가속 비전 및 로드맵

인덱싱 시스템의 연산 특성은 하드웨어 가속(FPGA/PCIe 등)에 구조적으로 적합하다. 이 적합성은 부수적 결과가 아니라, 아래 원칙에서 **자연스럽게 도출되는 성질**이다.

### 문자열은 아래로 내려가지 않는다

모든 도메인 값(역할 이름, 액션 이름 등)은 스키마 레이어(MetaCodec)에서 정수 좌표로 변환된다. 수학 레이어(WeightedIndex)는 오직 정수만 다룬다. 이 경계가 곧 가속 경계다.

```
문자열 도메인  →  정수 좌표  →  packed key
                    ↑
              가속 경계 (이 아래는 정수만)
```

### 모든 것은 ref_id로 수렴한다

각 axis의 도메인 값은 DimSnapshot의 position(1-based 정수)으로 수렴한다. 이 position이 ref_id이며, encode/decode의 유일한 입력이다. 문자열 → position 변환은 CPU에서 수행하고, position → packed key 변환만 가속한다.

### packed key는 계산 결과가 아니라 identity다

packed key는 단순 인코딩 결과물이 아니다. 그것이 곧 데이터의 정체성(identity)이다. schema가 불변이고 key가 결정론적이므로, **동일한 의미는 항상 동일한 key로 표현된다.** 이것이 packed key를 캐시 키, DB PK, 비교 연산의 기반으로 사용할 수 있는 근거이며, 하드웨어 lookup table의 안정성을 보장한다.

### 불변성이 가속의 전제 조건이다

shape 확정 → weights 불변. entries 확정 → lookup table 불변. 이 불변성 덕분에:
- FPGA configuration을 런타임에 변경할 필요가 없다 (version 변경 시만 재로드)
- 캐시 일관성 문제가 없다
- 병렬 접근이 안전하다
