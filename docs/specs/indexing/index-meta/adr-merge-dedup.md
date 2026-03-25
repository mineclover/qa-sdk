---
def:
  id: adr-merge-dedup
  scope: constraint
  aspect: tech_constraint
  depth: specification
  lifecycle: approved
  tags: [decision]
  links:
    - target: dimension-operations
      type: constrains
---

# ADR: 의미적 중복 제거 — Indexing Merge Plan

## 목적 ^purpose

상태: **구현 완료** (2026-03-18)

관련 계획: [tasks/indexing-merge-plan.md](../../../../tasks/indexing-merge-plan.md)
계약 테스트: `packages/demo-tests/src/merge-contract/`
영향 패키지: weighted-index, permission-engine, index-meta, decode-service

---

## 맥락

`permission-engine`, `index-meta`, `weighted-index`에 걸쳐 **같은 의미의 연산이 다른 구현**으로 존재하는 지점이 식별되었다. 코드 분석으로 확인된 5가지 의미적 중복:

| ID | 중복 | 위치 |
|---|---|---|
| D-1 | String→1-based index 맵 구축 | `PermissionCodec._buildMap()` ↔ `LabelRegistry._buildCache()` |
| D-2 | Shape 배열 중복 구성 | `meta-registry.ts` 내 5곳에서 독립적으로 `dims.map(d => entries.length)` |
| D-3 | Capacity 곱셈 경로 분기 | `compileSchema` 직접 곱셈 ↔ `MetaRegistry` WeightedIndex 경유 |
| D-4 | Stride 공식 중복 | `calcWeights()` ↔ `WeightedIndex` 생성자 각각 구현 |
| D-5 | Unresolved ref 개념 | `decode-service` 라우트에서만 수집, 라이브러리 미제공 |

동시에 **의도적 분리**로 확인된 항목도 있었다:

| 항목 | 판단 이유 |
|---|---|
| MetaRegistry vs defineTable/compileSchema | 역할 상이: 런타임 엔진 vs 빌드타임 authoring DSL |
| MetaRegistry vs PrefixRegistry | 역할 상이: 중앙 SSOT vs 분산 소비용 최소 레코드 |
| decode-service 라우트 로직 | 이미 transport only |
| PermissionCodec vs MetaCodec | 도메인 상이: 고정 4D 권한 vs 임의 N-D 스키마. index-meta 의존 추가 금지 |

---

## 결정

**같은 의미가 다른 코드로 표현되면, 하나가 바뀔 때 나머지가 drift한다.** 의미적 중복은 제거하되, 역할이 다른 모듈을 무리하게 합치지 않는다.

### D-1: PermissionCodec → LabelRegistry 위임

`PermissionCodec`이 `_buildMap()`을 자체 구현하는 대신 `LabelRegistry`를 사용한다.

- `_buildMap()` + 4개 private Map 제거
- `LabelRegistry`의 양방향 맵 + -0 정규화가 자동 적용
- 의존은 `weighted-index`에만 유지 (index-meta 추가하지 않음)
- public API 불변

### D-2: `_buildShape()` 추출

`meta-registry.ts` 내에서 shape 배열을 중복 구성하던 5곳을 `private _buildShape(def, iv)` 메서드로 단일화.

### D-3: 계약 테스트로 경로 간 일치 보장

`compileSchema`와 `MetaRegistry`는 입력이 다르므로 (refs vs entries) 단일 함수로 합칠 수 없다. 대신 `d3-capacity-parity.test.ts`로 결과 일치를 계약으로 보장.

### D-4: `calcWeights()` canonical 승격

`calcWeights()`를 stride 공식의 canonical 구현으로 지정하고, `WeightedIndex` 생성자가 이를 호출하도록 변경.

### D-5: `decodeDeepDetailed()` 추가

`PrefixDecoder`가 unresolved ref 수집을 직접 제공. decode-service 라우트에서 `dim.kind.type === "index_ref"` 순회를 제거하고 메서드 호출로 대체.

---

## 의도적 분리 근거

아래 항목은 중복처럼 보이지만 **역할이 다르므로 분리를 유지**한다:

### MetaRegistry vs defineTable/compileSchema

- MetaRegistry: 런타임 스키마 엔진 (1417줄, full validation, encode/decode/serialize)
- defineTable/compileSchema: 빌드타임 authoring DSL (diff 추적, registry sync)
- `schema-authoring-contract.test.ts`가 산출물 일관성을 검증

### PermissionCodec vs MetaCodec

- PermissionCodec: 고정 4D (services×types×resources×actions), `weighted-index`만 의존
- MetaCodec: 임의 N-D, `DecodeMap` 기반, `index-meta` 패키지 소속
- `compat-contract.test.ts`가 주소 공간 동등성을 검증
- permission-engine에 index-meta 의존을 추가하면 **역의존** 발생

---

## 검증

전체 quality gate 2,429 tests 통과:

| 패키지 | 테스트 수 |
|---|---|
| weighted-index | 934 |
| index-meta | 837 |
| permission-engine | 53 |
| decode-service | 39 |
| demo-tests | 566 |
