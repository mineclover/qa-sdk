---
def:
  id: df-system
  tier: layout
  address: def_document:v2:68625
  scope: feature
  aspect: func_def
  depth: overview
  lifecycle: approved
  layer: domain
  svc: decision-flow
  tags: [structural, decision, entry-point]
  links:
    - target: df-constraint
      type: refs
    - target: axis-decision-guide
      type: refs
    - target: df-dev-decisions
      type: refs
    - target: df-gate-integration
      type: refs
    - target: decision-flow-store
      type: refs
---

# Decision Flow 시스템

## 목적 ^purpose

인간의 복잡한 결정 과정을 사전 설계된 직교 축으로 투영하여, "왜 이 결정을 했는가"를 좌표 주소로 증명하는 다차원 벡터 공간 모델. qa-sdk의 좌표 인코딩과 동형 — 데이터 이벤트의 "어디서"를 좌표로 표현하듯, 의사결정의 "왜"를 좌표로 표현한다.

## 구성 ^overview

- `df-model-group`: 축 정의, 관측 공간, 상태 전이, 직렬화 — 핵심 모델 계층.
- `df-analysis-group`: 벡터 비교, 시간 패턴, 인과 매핑 — 분석 계층.
- `df-interface-group`: CLI 영속화, CLI 조회, ingest 전송 — 외부 인터페이스 계층.
- `df-constraint`: 게이트 무게, 인과 그래프, 결정 계층, 컨텍스트 바운더리.
- `df-taxonomy`: decision-flow가 소유하는 분류 체계의 중심 문서.
- `decision-standard-group`: 표준 프로세스 + 체크리스트.
- `df-narrative-group`: 서사 구조 + 컨텍스트 + 증명.
- `axis-decision-guide`: 축 판단 프레임워크 (범용 재사용 가능).
- `df-dev-decisions`: 5개 일상 결정 FlowSchema + 자동 정책 + 라우터.
- `df-gate-integration`: GateEngine 4-state × decision prefix 연동.

## 구현 상태

P0~P11 전부 완료 (2026-03-25).

| Phase | 내용 | 상태 |
|-------|------|:----:|
| P0 | 코어 타입 + 엔진 | ✅ |
| P1 | DEMO_CATALOG 통합 | ✅ |
| P2 | 수집 파이프라인 연동 | ✅ |
| P3 | 런타임 자동화 | ✅ |
| P4 | 학습·비교·DKG 통합 (21 US) | ✅ |
| P5 | 정보 체계 정체성 (축 메타/직교성/서사) | ✅ |
| P6 | gstack 약점 해소 (mentalModels/Build/Reflect) | ✅ |
| P7 | 후속 과제 해소 (벡터 프레이밍/패턴 분류/DecisionUnit) | ✅ |
| P8 | CLI 영속 + 조회 (SQLite/lookup/history/verdict/judge) | ✅ |
| P9 | 안정화 + 시간축 + 라우터 (9 bugfix + durationMs + architecture-decision) | ✅ |
| P10 | ingest 전송 (FlowIngestEmitter, fail-open) | ✅ |
| P11 | GateEngine 연동 (4-state × decision prefix) | ✅ |

테스트: 188 decision-flow + 141 CLI + 852 demo-tests.
QG: `pnpm --filter decision-flow typecheck && pnpm --filter decision-flow test && pnpm --filter @qa-sdk/cli build && pnpm --filter demo-tests test`

## 관련 소스

| 패키지 | 역할 | 주요 파일 |
|--------|------|----------|
| `packages/decision-flow/` | 코어 엔진 + 모델 + 분석 | `engine.ts`, `schema.ts`, `types.ts`, `coordinate.ts` |
| `packages/decision-flow/src/observe.ts` | prefix 인코딩 (5종) | decision_event, decision_path, escalation_event, forcing_response, model_apply |
| `packages/decision-flow/src/context-provider.ts` | 컨텍스트 공급 | ContextProvider, hierarchical lookup |
| `packages/decision-flow/src/core-analysis.ts` | 벡터 비교 + 시간 패턴 | comparison, temporal analysis |
| `packages/decision-flow/src/narrative.ts` | 서사 구조 | narrative context |
| `packages/decision-flow/src/dev-decisions.ts` | 일상 결정 FlowSchema | 5종 dev decision |
| `packages/decision-flow/src/policy.ts` | 정책 학습 + 라우터 | policy learning |
| `packages/decision-flow-store/` | SQLite 영속화 | InstanceStore |
| `packages/cli/src/commands/dkg.ts` | CLI 조회/판정 | dkg decide, dkg flow-schema |
