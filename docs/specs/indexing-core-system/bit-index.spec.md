---
def:
  id: bit-index
  type: spec
  level: leaf
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  layer: domain
  svc: bit-index
  tags: [coordinate, indexing, performance]
  links:
    - target: indexing-core-system
      type: refines
  source: packages/bit-index/src/index.ts
---

# bit-index — 차원별 bit-packing 인덱스

## 목적 ^purpose

좌표를 비트 단위로 패킹해 shift+mask O(1) 연산으로 차원 값을 추출하는 인코딩 라이브러리. `weighted-index → bit-index → permission-engine` 인코딩 체인의 중간 레이어. 축당 비트 폭을 `nextPowerOf2(entries × 2)` 이상으로 유지하는 capacity 계약을 소유한다.
