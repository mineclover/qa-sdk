---
def:
  tier: component
  id: coord-acceleration-design
  address: def_document:v2:414857
  scope: constraint
  aspect: tech_constraint
  depth: specification
  svc: weighted-index
  lifecycle: approved
  layer: domain
  tags: [performance]
  links:
    - target: coord-foundation
      type: refines
sources:
  - packages/weighted-wasm/src/lib.rs
  - packages/weighted-wasm/js/index.ts
  - packages/weighted-wasm/js/index.test.ts
  - packages/weighted-wasm/js/bench.ts
  - scripts/package-surfaces.mjs
  - packages/weighted-index/src/index.ts
  - packages/weighted-index/src/math/weighted-index.ts
  - packages/weighted-index/src/math/weighted-index.test.ts
  - packages/weighted-index/src/math/calc.ts
  - packages/weighted-index/src/math/calc.test.ts
  - packages/weighted-index/package.json

---

# 가속 지향 설계 원칙

## 목적 ^purpose

인덱싱 시스템이 하드웨어 가속에 구조적으로 적합한 이유를 정의한다. 문자열 경계, ref_id 수렴, packed key identity, 불변성이 가속의 전제 조건임을 명시한다.

> 상세: [`acceleration.md`](acceleration.md) — 하드웨어 가속 비전 및 로드맵

인덱싱 시스템의 연산 특성은 하드웨어 가속(FPGA/PCIe 등)에 구조적으로 적합하다. 이 적합성은 부수적 결과가 아니라, 아래 원칙에서 **자연스럽게 도출되는 성질**이다.

## 문자열은 아래로 내려가지 않는다

모든 도메인 값(역할 이름, 액션 이름 등)은 스키마 레이어(MetaCodec)에서 정수 좌표로 변환된다. 수학 레이어(WeightedIndex)는 오직 정수만 다룬다. 이 경계가 곧 가속 경계다.

```
문자열 도메인  →  정수 좌표  →  packed key
                    ↑
              가속 경계 (이 아래는 정수만)
```

## 모든 것은 ref_id로 수렴한다

각 axis의 도메인 값은 DimSnapshot의 position(1-based 정수)으로 수렴한다. 이 position이 ref_id이며, encode/decode의 유일한 입력이다. 문자열 → position 변환은 CPU에서 수행하고, position → packed key 변환만 가속한다.

## packed key는 계산 결과가 아니라 identity다

packed key는 단순 인코딩 결과물이 아니다. 그것이 곧 데이터의 정체성(identity)이다. schema가 불변이고 key가 결정론적이므로, **동일한 의미는 항상 동일한 key로 표현된다.** 이것이 packed key를 캐시 키, DB PK, 비교 연산의 기반으로 사용할 수 있는 근거이며, 하드웨어 lookup table의 안정성을 보장한다.

## 불변성이 가속의 전제 조건이다

shape 확정 → weights 불변. entries 확정 → lookup table 불변. 이 불변성 덕분에:
- FPGA configuration을 런타임에 변경할 필요가 없다 (version 변경 시만 재로드)
- 캐시 일관성 문제가 없다
- 병렬 접근이 안전하다
