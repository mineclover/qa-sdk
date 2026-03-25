---
def:
  id: wi-trace-group
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: approved
  tags: [testing]
  contains: [wi-trace-axes, wi-trace-propagation, wi-trace-protocol]
---
# weighted-index 추적성 그룹

## 목적 ^purpose

weighted-index의 추적성. 변경 유형별 전파 경로, 버전 고정, 수정 프로토콜.

## 구성 ^overview

3개: 추적성의 3축(역할/변경/고정), 전파 경로, 수정 프로토콜.

| 문서 | 내용 |
|------|------|
| [wi-trace-axes.spec.md](wi-trace-axes.spec.md) | 주소 항등성, 버전 격리, 변경 감지 + 3-tier 핀 구조 |
| [wi-trace-propagation.spec.md](wi-trace-propagation.spec.md) | 변경 유형별 전파 경로 + 시나리오 |
| [wi-trace-protocol.spec.md](wi-trace-protocol.spec.md) | 수정 프로토콜 + 상위 계층 계약 + 불변식 |
