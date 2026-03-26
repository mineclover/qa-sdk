---
def:
  id: df-interface-group
  scope: interface
  aspect: api_contract
  depth: overview
  lifecycle: approved
  svc: decision-flow
  tags: [structural, decision]
  links:
    - target: df-cli-persistence
      type: contains
    - target: df-cli-query
      type: contains
    - target: df-ingest-emission
      type: contains
---
# Decision Flow 외부 인터페이스

## 목적 ^purpose

CLI 영속화, CLI 조회, ingest 이벤트 전송 — decision-flow가 외부 시스템과 통신하는 인터페이스 계층.

## 구성 ^overview

- `df-cli-persistence`: SQLite 기반 FlowInstance 영속화 (세션 간 결정 이력 유지).
- `df-cli-query`: CLI에서 과거 의사결정 이력 조회, 검색, 통계.
- `df-ingest-emission`: gate 선택/플로우 완료 이벤트를 ingest-server로 전송.
