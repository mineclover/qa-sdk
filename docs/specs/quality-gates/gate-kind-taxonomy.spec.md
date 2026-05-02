---
def:
  id: gate-kind-taxonomy
  tier: component
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  layer: domain
  tags: [testing]
  links:
    - target: harness-architecture
      type: implements
---


## 탐색 ^navigation

quality-gates-system > **gate-kind-taxonomy**

형제: `gate-tracker-spec` · `harness-model-spec` · `harness-state-model` · `work-domain-quality-bundle` · `definition-quality-gates` · `decision-flow-quality-bundle` · `ingest-quality-bundle` · `query-quality-bundle` · `definition-service-quality-bundle` · `decode-quality-bundle` · `registry-quality-bundle` · `quality-ledger` · `dkg-harness-bridge`

## 목적 ^purpose

품질 게이트의 **유형(kind)**과 **검증 범위(scope)**를 정의한다. "이 검증은 무엇을 어떤 범위에서 확인하는가"에 대한 택소노미. 계약 문서의 scope × aspect에서 필요한 게이트 유형을 자동 도출하는 기반.

## 사용 맥락 ^context

`deriveGateKinds(contractDoc)` 함수가 계약 문서(interface, constraint scope)를 받아 필요한 GateKindId 목록을 반환한다. `buildHarnessPlan()`에서 자동 호출.

## GateScope (7종)

| scope | 대상 | 실행 비용 |
|-------|------|----------|
| static | 소스 코드 텍스트 | 최저 |
| unit | 단일 함수/클래스 | 낮음 |
| integration | 모듈 간 결합 | 중간 |
| system | 전체 시스템/브라우저 | 높음 |
| build | 빌드 산출물 | 중간 |
| audit | 프로젝트/의존성 메타데이터 | 낮음 |
| ai | AI 모델 출력 | 가변 |

## GateKindId (19종)

| scope | kind | 설명 |
|-------|------|------|
| static | typecheck, lint, static-analysis | 타입/스타일/심층 분석 |
| unit | unit-test, snapshot-test | 단위/스냅샷 |
| integration | integration-test, transaction-test, api-contract | 연동/트랜잭션/API 계약 |
| system | e2e-test, visual-check, perf-benchmark | E2E/시각/성능 |
| build | build, build-affected | 단일/영향 범위 빌드 |
| audit | security-audit, a11y-check, doc-build, license-check | 보안/접근성/문서/라이선스 |
| ai | eval-benchmark, cost-track | AI 평가/비용 |

## scope × aspect → GateKind 매핑

| scope | aspect | 도출되는 GateKind |
|-------|--------|-----------------|
| interface | api_contract | typecheck, api-contract |
| interface | cli_contract | typecheck, integration-test |
| interface | event_contract | typecheck, unit-test |
| constraint | tech_constraint | unit-test, static-analysis |
| constraint | biz_constraint | integration-test |
| constraint | infra_constraint | build, integration-test |

concern tag 추가 매핑: `security` → security-audit, `accessibility` → a11y-check, `performance` → perf-benchmark

## 관련 소스

- `work-domain/src/gate-kind.ts` — 19종 정의 + 조회 유틸
- `work-domain/src/harness.ts:deriveGateKinds()` — 자동 도출
