---
def:
  id: df-system
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: approved
  tags: [decision, entry-point]
  links:
    - target: df-axis-model
      type: contains
    - target: df-observation-space
      type: contains
    - target: df-vector-analysis
      type: contains
    - target: df-constraint
      type: contains
    - target: df-state-model
      type: contains
    - target: df-serialization
      type: contains
    - target: df-causal-mapping
      type: contains
    - target: decision-standard-group
      type: contains
    - target: df-narrative
      type: contains
    - target: axis-decision-guide
      type: contains
    - target: df-narrative-group
      type: contains
    - target: df-cli-persistence
      type: contains
    - target: df-cli-query
      type: contains
    - target: df-ingest-emission
      type: contains
    - target: df-dev-decisions
      type: contains
    - target: df-time-analysis
      type: contains
    - target: df-gate-integration
      type: contains
---

# Decision Flow 시스템

## 목적 ^purpose

인간의 복잡한 결정 과정을 사전 설계된 직교 축으로 투영하여, "왜 이 결정을 했는가"를 좌표 주소로 증명하는 다차원 벡터 공간 모델. qa-sdk의 좌표 인코딩과 동형 — 데이터 이벤트의 "어디서"를 좌표로 표현하듯, 의사결정의 "왜"를 좌표로 표현한다.

## 구성 ^overview

overview: 총 17개 멤버.

코어:
- `df-axis-model`: 의사결정 도메인의 11개 축 정의.
- `df-observation-space`: 5개 prefix가 의사결정의 관찰 가능한 좌표 공간을 구성한다.
- `df-constraint`: 게이트 무게, 인과 그래프, 결정 계층, 컨텍스트 바운더리.
- `df-state-model`: FlowInstance 생명주기 + 서사 구조.
- `df-serialization`: 의사결정 좌표의 직렬화 형식.

분석:
- `df-vector-analysis`: 투영된 결정 벡터들의 분포, 차이, 이동, 패턴 분석.
- `df-causal-mapping`: 비즈니스 요구(X) ↔ 기술 구현(Y) 인과 매핑.
- `df-time-analysis`: gate별 소요 시간, 완료→판정 지연, 시간 기반 패턴.

응용:
- `df-dev-decisions`: 5개 일상 결정 FlowSchema + 자동 정책 + 라우터.
- `df-gate-integration`: GateEngine 4-state × decision prefix 연동.
- `df-narrative-group`: 서사 구조 + 컨텍스트 + 증명.
- `decision-standard-group`: 표준 프로세스 + 체크리스트.

CLI:
- `df-cli-persistence`: SQLite 영속 (WAL + active 복원 + verdict).
- `df-cli-query`: lookup/history/verdict/judge 조회 명령.
- `df-ingest-emission`: ingest-server 이벤트 전송 (fail-open).

서사:
- `df-narrative`: 서사가 쌓이는 문서 (구현 변경과 무관).

가이드:
- `axis-decision-guide`: 축 판단 프레임워크 (범용 재사용 가능).
