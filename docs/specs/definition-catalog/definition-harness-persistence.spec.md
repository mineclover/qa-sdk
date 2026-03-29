---
def:
  id: definition-harness-persistence
  level: leaf
  scope: data
  aspect: system_data
  depth: specification
  lifecycle: draft
  layer: operation
  svc: definition-service
  tags: [tier-system]
  links:
    - target: definition-harness
      type: refines
    - target: definition-state-model
      type: depends_on
---
# Harness Persistence — 상태 인스턴스 영속화

## 목적 ^purpose

StateMachineInstance를 def-config.json에 저장하여, 프로세스 종료 후에도 문서별 상태와 전이 이력을 유지한다. 별도 저장소를 만들지 않고 기존 config 파일을 확장한다.

## 저장 구조 ^inputs

def-config.json 확장:

```json
{
  "addressVersion": "v2",
  "prefixVersion": "v1",
  "lastSyncedAt": "...",
  "documentCount": 549,
  "checksums": { ... },
  "states": {
    "doc-lifecycle": {
      "gate-api": { "current": "approved", "history": [...] },
      "old-spec": { "current": "deprecated", "history": [...] }
    },
    "spec-impl": {
      "error-handling-convention": { "current": "source-referenced", "history": [...] }
    },
    "convention-compliance": {
      "error-handling-convention": { "current": "compliant", "history": [...] }
    }
  }
}
```

## 제약 조건 ^constraint

- 전체 인스턴스를 저장하지 않음 — 기본 상태(initial)가 아닌 것만 저장
- history는 최근 10건만 유지 (오래된 것은 자동 정리)
- config 파일 크기가 1MB를 초과하면 warning
