---
def:
  id: pipeline-error-handling
  scope: constraint
  aspect: tech_constraint
  depth: specification
  lifecycle: approved
  tags: [observability, tier-infra]
  links:
    - target: pipeline-enrichment
      type: constrains
    - target: pipeline-metric-agg
      type: constrains
---
# 파이프라인 에러 처리

## 목적 ^purpose

Phase 1/2 파이프라인의 에러 처리 정책. Phase 1 실패 시 DLQ 격리, Phase 2 실패 시 재시도 큐, 포이즌 메시지 격리 규칙.

## 에러 정책 ^constraint

- Phase 1 실패: DLQ 격리 + 원본 보존 + 수동 재시도
- Phase 2 실패: 3회 재시도 + 백오프 + 포이즌 메시지 격리
- 부분 실패: 성공한 record는 보존, 실패한 record만 DLQ
