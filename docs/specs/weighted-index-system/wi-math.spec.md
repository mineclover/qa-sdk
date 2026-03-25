---
def:
  id: wi-math
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  tags: [tier-infra]
  links:
    - target: coord-foundation
      type: depends_on
---
# Weighted-Index 핵심 수학

## 목적 ^purpose

mixed-radix 기반 좌표 인코딩의 수학적 기반. shape(차원별 크기), strides(가중치), encode(좌표→정수), decode(정수→좌표) 공식을 정의한다.

## 공식 ^overview

address = Σ (coord[i] - 1) × strides[i].
strides[i] = Π shape[j] for j > i.
size = Π shape[i] (총 주소 공간 크기).
decode: 정수를 strides로 나누어 각 차원 좌표 복원.
