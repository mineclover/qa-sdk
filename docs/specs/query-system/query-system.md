---
def:
  id: query-system
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: approved
  svc: query-service
  tags: [entry-point]
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

3개 정의: 질의 API(resolve/match/compose), 규칙 영속화(PolicyRule CRUD + 충돌 전략), Gate 통합(gateMode/withGate).
