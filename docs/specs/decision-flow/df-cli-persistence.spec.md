---
def:
  id: df-cli-persistence
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: approved
  svc: qa-sdk-cli
  tags: [decision, persistence]
  links:
    - target: df-state-model
      type: depends_on
    - target: df-system
      type: implements
---
# CLI SQLite 영속

## 목적 ^purpose

FlowInstance를 `~/.qa-sdk/decision-flow.sqlite`에 저장하여 CLI 세션 간 상태를 유지한다. WAL 모드 + busy_timeout으로 동시 접근 안전. active 인스턴스 복원, verdict 영속, 마이그레이션 포함.

## 구성 ^overview

- **SqliteInstanceStore**: InstanceStore 인터페이스의 SQLite 구현 (CLI 전용)
- **영속 범위**: active/completed 인스턴스 + verdict + address_context
- **동시 접근**: WAL 모드 + busy_timeout 3초 — 여러 CLI 프로세스 동시 사용 가능
- **마이그레이션**: 기존 DB에 verdict 컬럼 없으면 자동 추가
- **JSON 안전**: safeJsonParse로 손상 행 크래시 방지
- **라이브러리 순수성**: decision-flow 패키지는 SQLite 의존 없음. 영속은 CLI의 책임
