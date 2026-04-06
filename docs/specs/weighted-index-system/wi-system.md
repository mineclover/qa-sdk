---
def:
  id: wi-system
  level: module
  address: def_document:v2:68648
  scope: feature
  aspect: func_def
  depth: overview
  lifecycle: approved
  layer: domain
  svc: weighted-index
  tags: [structural, entry-point]
  links:
    - target: wi-math
      type: contains
    - target: wi-api
      type: contains
    - target: wi-codec
      type: contains
    - target: wi-constraint
      type: contains
    - target: wi-trace-group
      type: contains
    - target: partial-binder-spec
      type: contains
    - target: wi-pack-format-system
      type: contains
    - target: range-query-spec
      type: contains
    - target: wi-hardware-acceleration
      type: contains
    - target: weighted-index-explorer-spec
      type: contains
    - target: weighted-gpu-spec
      type: contains
    - target: weighted-wasm-spec
      type: contains
---

# Weighted-Index 시스템

## 목적 ^purpose

가중진법(weighted positional notation) 기반 다차원 인덱스 ↔ 정수 변환 라이브러리. 레이블 조합(역할, 액션, API 등)을 단일 정수 ID로 인코딩/디코딩하고, 버전 관리를 통해 DB 연결성을 유지한다.

## 구성 ^overview

- `wi-math`: mixed-radix 기반 좌표 인코딩의 수학적 기반.
- `wi-api`: WeightedIndex(encode/decode/encodeFromRecord/decodeToRecord), LabelRegistry(레이블 관리), PrefixCodec(시맨틱 주소 직렬화/파싱)의 퍼블릭 API.
- `wi-codec`: 시맨틱 주소(prefix:version:address)를 다양한 포맷으로 직렬화/파싱하는 코덱.
- `wi-constraint`: WeightedIndex 좌표 인코딩의 안전성을 보장하기 위한 검증 규칙, 용량 한계, 에러 경계를 정의한다.
- `wi-trace-group`: weighted-index 변경 전파의 추적성 축, 전파 경로, 수정 프로토콜을 묶는 subgroup overview.
- `partial-binder-spec`: `PartialBinder`는 `PrefixCodec` 위에서 동작하는 차원 부분 바인딩(curried encoder) 레이어다.
- `wi-pack-format-system`: PackFormat 정의, 레지스트리, hex 연산, capacity 계획, SemanticAddress/레이아웃 프로토콜을 묶는 subgroup overview.
- `range-query-spec`: `calcAddressRanges` — 부분 좌표 제약에서 주소 구간 계산.
