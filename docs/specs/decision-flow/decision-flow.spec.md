---
def:
  id: decision-flow-spec
  scope: state
  aspect: domain_state
  depth: specification
  lifecycle: deprecated
  svc: decision-flow
  tags: [decision]
---
# Decision Flow — 의사결정 좌표계 (레거시)

## 목적 ^purpose

이 문서는 분할되었습니다. SSOT는 df-system과 그 멤버 문서입니다.

## 이관 대상

| 이관 전 (이 파일) | 이관 후 (SSOT) |
|------------------|---------------|
| 모델 정체성 | df-system.md |
| 축 설계 | df-axis-model.spec.md |
| 관찰 공간 | df-observation-space.spec.md |
| X↔Y 매핑 | df-causal-mapping.spec.md |
| 벡터 공간 분석 | df-vector-analysis.spec.md |
| 구조적 제약 | df-constraint.spec.md |
| 직렬화 | df-serialization.spec.md |
| 구현 현황 (P0~P11) | df-system.md 하단 |
| CLI 영속 | df-cli-persistence.spec.md |
| CLI 조회 | df-cli-query.spec.md |
| ingest 전송 | df-ingest-emission.spec.md |
| 일상 결정 | df-dev-decisions.spec.md |
| 시간축 분석 | df-time-analysis.spec.md |
| GateEngine | df-gate-integration.spec.md |

조회: `qa-sdk def topdown df-system`
