---
def:
  id: wi-trace-group
  scope: data
  aspect: domain_data
  depth: overview
  lifecycle: approved
  layer: domain
  svc: weighted-index
  tags: [structural, testing]
  links:
    - target: wi-trace-axes
      type: contains
    - target: wi-trace-propagation
      type: contains
    - target: wi-trace-protocol
      type: contains
---

# weighted-index 추적성 그룹

## 목적 ^purpose

weighted-index의 추적성. 변경 유형별 전파 경로, 버전 고정, 수정 프로토콜.

## 구성 ^overview

- `wi-trace-axes`: 추적성의 3축: 역할(producer/consumer/auditor), 변경 유형(additive/reductive/structural), 고정(stride/capacity/shape).
- `wi-trace-propagation`: 변경 유형별 전파 경로.
- `wi-trace-protocol`: 수정의 프로토콜.

| 문서 | 내용 |
|------|------|
| [wi-trace-axes.spec.md](wi-trace-axes.spec.md) | 주소 항등성, 버전 격리, 변경 감지 + 3-tier 핀 구조 |
| [wi-trace-propagation.spec.md](wi-trace-propagation.spec.md) | 변경 유형별 전파 경로 + 시나리오 |
| [wi-trace-protocol.spec.md](wi-trace-protocol.spec.md) | 수정 프로토콜 + 상위 계층 계약 + 불변식 |
