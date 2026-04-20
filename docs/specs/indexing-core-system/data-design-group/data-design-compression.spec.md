---
def:
  tier: component
  id: data-design-compression
  address: def_document:v2:342155
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  layer: domain
  svc: weighted-index
  tags: [data, performance, structural]
  links:
    - target: coord-foundation
      type: depends_on
    - target: data-design-group
      type: refines
---

# 좌표 데이터 설계 - 압축과 범위 제어

## 목적 ^purpose

닫힌 조합 공간을 정수 주소로 압축하고 상위 차원에 편입하며 주소 구간으로 범위를 제어하는 데이터 설계 원리를 정리한다.

## 주소 압축

- 차원 압축은 유한한 각 축의 선택지를 stride 기반 1D 주소로 바꾸는 단계다.
- 차원 편입은 압축된 결과를 더 큰 prefix나 상위 레이어에 다시 넣어 합성 주소를 만든다.
- 이 단계는 `coord-foundation`의 닫힌 공간 가정과 stride 공식을 그대로 따른다.

## 범위와 캐싱

- 주소 구간은 집합을 다시 열거하지 않고도 정책, 버전, 상태 범위를 표현하는 최소 단위다.
- 자주 쓰는 조합은 사전 계산해 cache-friendly 구조로 두고, 드문 질의만 런타임 계산으로 넘긴다.
- 상위 서비스는 "모든 조합을 기억"하는 대신 "구간을 계산"하는 방식으로 읽기 성능을 확보한다.

## 적용 경계

- 이 문서는 압축/편입/범위 제어의 데이터 원리를 다룬다.
- entity 이름, prefix 카탈로그, 운영 절차는 `data-design-catalog`로 분리한다.
