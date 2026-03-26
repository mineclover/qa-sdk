---
def:
  id: conv-acceleration
  scope: constraint
  aspect: tech_constraint
  depth: specification
  lifecycle: approved
  svc: weighted-index
  tags: [performance]
  links:
    - target: range-query-spec
      type: constrains
    - target: resolver-spec
      type: constrains
    - target: cq-relational-engine
      type: constrains
---
# conv-acceleration

## 목적 ^purpose

가속 지향 설계 규칙. Snapshot Supply 전략, 캐시 친화적 구조, 불필요한 계산 회피.

## 구성 ^overview

- **분기 금지**: encode/decode 연산 경로에 조건 분기, 예외 처리, 동적 dispatch 삽입 금지 — 검증은 진입 전에 수행
- **불변성 유지**: shape/weights/entries는 확정 후 Object.freeze — 변경 시 새 version 생성
- **정수 전달 원칙**: 문자열→정수 변환은 스키마 레이어에서 완결, 수학 레이어는 정수 좌표만 수신
- **결정론적 packed key**: encode 결과에 난수/타임스탬프 혼합 금지, 동일 입력 = 동일 key (INV-1)

가속 지향 설계 규칙. Snapshot Supply 전략, 캐시 친화적 구조, 불필요한 계산 회피.

그룹: [conventions-system.md](conventions-system.md)
원본: `docs/specs/indexing/conventions.md` SS6

> 근거: `acceleration.md` — 하드웨어 가속 비전

인덱싱 시스템의 연산 특성이 하드웨어 가속에 적합한 상태를 유지하기 위한 규칙이다. 이 규칙은 FPGA 없이도 CPU 성능 최적화에 유효하다.

## 상태

implemented

## 1. encode/decode에 분기를 넣지 않는다

WeightedIndex.encode/decode는 순수 곱셈/나눗셈/모듈러 연산이다. 조건 분기, 예외 처리, 동적 dispatch를 연산 경로에 삽입하면 가속 적합성이 깨진다.

**규칙**: 검증은 encode/decode 진입 전에 수행한다. 연산 경로 자체는 분기 없는 산술만.

```ts
// 검증 후 산술
this._validateCoords(coords);  // 경계 검사 (encode 전)
return this._encodeCore(coords); // 순수 산술 (분기 없음)

// 산술 중 검증 (금지)
for (let i = 0; i < d; i++) {
  if (coords[i] < 1 || coords[i] > shape[i]) throw ...; // 연산 경로에 분기
  result += (coords[i] - 1) * weights[i];
}
```

## 2. shape/weights/entries 불변성을 깨지 않는다

shape 확정 후 weights는 `Object.freeze`된 배열이다. entries 확정 후 LabelRegistry는 불변 Map이다. 이 불변성이 캐시 안전성, 병렬 접근 안전성, FPGA configuration 안정성의 기반이다.

**규칙**: 런타임에 shape이나 entries를 변경하지 않는다. 변경이 필요하면 새 version을 생성한다.

## 3. 정규화된 정수만 하위 레이어에 전달한다

문자열 -> 정수 변환(Axis Normalize)은 스키마 레이어에서 완결한다. 수학 레이어는 정수 좌표만 받는다. 이 경계가 CPU/가속기 경계와 일치한다.

**규칙**: WeightedIndex, calc, bitmask 등 수학 유틸은 문자열 입력을 받지 않는다. 문자열 처리가 필요하면 상위 레이어(MetaCodec, LabelRegistry)에서 변환 후 전달한다.

## 4. packed key를 identity로 취급한다

packed key는 캐시 키, DB PK, 비교 연산의 기반이다. key의 결정론성(동일 입력 = 동일 key)이 깨지면 시스템 전체의 정합성이 무너진다.

**규칙**:
- encode 결과에 난수, 타임스탬프 등 비결정론적 요소를 혼합하지 않는다
- obfuscation은 별도 레이어(`obfuscate/`)에서 수행하며, encode 자체에 포함하지 않는다
- 동일 schema + 동일 coords는 반드시 동일 packed key를 생성해야 한다 (INV-1)
