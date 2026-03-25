---
def:
  id: query-system
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: approved
  svc: query-service
  tags: [entry-point, tier-infra]
  links:
    - target: query-api
      type: contains
    - target: query-rules
      type: contains
    - target: query-gate-integration
      type: contains
---

# Query 시스템

## 목적 ^purpose

관계형 질의, 정책 해소, gate 통합을 제공하는 중앙 질의 서비스. 규칙 관리 + 질의 실행 + gate 상태 합성을 단일 진입점으로 제공한다.

## 구성 ^overview

overview: 총 3개 멤버.
- `query-api`: 좌표 질의를 수행하는 REST 엔드포인트.
- `query-rules`: PolicyRule의 CRUD와 충돌 전략을 정의한다.
- `query-gate-integration`: 질의 결과에 gate 상태를 합성하는 통합 경로.
