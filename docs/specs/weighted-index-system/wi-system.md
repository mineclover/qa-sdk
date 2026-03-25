---
def:
  id: wi-system
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: approved
  tags: [entry-point]
  links:
    - target: wi-math
      type: contains
    - target: wi-api
      type: contains
    - target: wi-codec
      type: contains
    - target: wi-constraint
      type: contains
    - target: wi-traceability-spec
      type: contains
    - target: partial-binder-spec
      type: contains
    - target: wi-pack-format
      type: contains
    - target: range-query-spec
      type: contains
---
# Weighted-Index 시스템

## 목적 ^purpose

가중진법(weighted positional notation) 기반 다차원 인덱스 ↔ 정수 변환 라이브러리. 레이블 조합(역할, 액션, API 등)을 단일 정수 ID로 인코딩/디코딩하고, 버전 관리를 통해 DB 연결성을 유지한다.

## 구성 ^overview

4개 정의: 핵심 수학(mixed-radix 공식, stride 계산), 퍼블릭 API(WeightedIndex/LabelRegistry), PrefixCodec(시맨틱 주소 직렬화), 제약(검증 규칙, 에러 계층).
