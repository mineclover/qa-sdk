---
def:
  id: dkg-growth-spiral
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: approved
  layer: domain
  svc: spec-core
  tags: [tier-system]
  links:
    - target: dkg-queries
      type: refines
    - target: dkg-skills-spec
      type: refines
---
# DKG 성장 나선

## 목적 ^purpose

고정 축 정의 → 운용 → 새 기능 발견 → 새 고정 축 순환의 성장 모델. 매 회전에서 과거를 보존하며 누적적으로 성장한다.

## 구성 ^overview

성장 나선은 4단계 회전, 3종 자동 피드백 루프, lifecycle 전이 메커니즘으로 구성된다.

## 나선 4단계

```
정의(define)  → 축/prefix를 카탈로그에 고정
운용(operate) → 실 트래픽에서 좌표 인코딩/디코딩
발견(discover) → 운용 데이터에서 반복 패턴/이상 감지
닫힘(close)   → 패턴을 새 고정 축/prefix로 승격 → 다음 회전
```

### 1단계: 정의 (define)

카탈로그에 축과 prefix를 등록한다. `bootstrapDkg()`가 이를 DKG 그래프로 파생한다.

- AxisNode: 유한 값 집합을 가진 차원
- PrefixNode: 차원 조합으로 정의된 주소 접두사
- capacity는 `nextPowerOf2(entries.length * 2)` 이상으로 설정
- 새 축/prefix 추가 시 `scaffoldDecision()`으로 Decision 노드를 생성하여 근거를 기록

### 2단계: 운용 (operate)

실 트래픽에서 좌표를 사용한다. 이 단계에서 DKG는 관측을 수집한다.

- `serviceHealthCheck()`: 서비스 상태 관측
- `eventCoverageCheck()`: prefix 커버리지 관측
- `traceFlows()`: IntentLink invariant 위반 감지
- `validateDslInvariants()`: DSL 번들 불변조건 검증

### 3단계: 발견 (discover)

관측 데이터에서 패턴을 자동 발견한다.

- `analyzeHeadroom()`: headroom 위험 축 감지 → Decision 자동 생성
- `scanAxisOverlaps()`: 축 entries 중복 발견 → 병합/분리 Decision
- `comparePrefixes()`: prefix 구조 유사도 → 병합 후보 식별
- `discoverCausality()`: 인과 관계 발견 → IntentLink 후보
- `analyzeDeploymentSkew()`: 배포 스큐 감지 → Observation
- `analyzeAllVersionSkew()`: DSL 멤버 간 버전 격차 → Observation + Decision

### 4단계: 닫힘 (close)

발견된 패턴을 새 구조로 승격한다.

- ObservationNode → `prompts` → DecisionNode: 관측이 의사결정을 촉발
- Decision의 `alternatives`와 `reversalConditions`가 선택지를 구조화
- 승격 결과: 새 축 추가, prefix 병합/분할, capacity 확장, entry 비활성화
- `lifecycle-transition.ts`로 노드 상태를 전이하고 `evolves-from`/`supersedes` 엣지로 이력 기록

## 자동 피드백 루프

### 관측 루프 (Observation Loop)

```
열림(open) → 연결됨(linked) → 닫힘(closed)
```

- **열림**: ObservationNode 생성. resolution 없음.
- **연결됨**: `prompts` 엣지로 DecisionNode에 연결.
- **닫힘**: resolution 설정 (outcome: accepted/deferred/rejected).
- intent별 의무: action-needed → 반드시 닫아야 함, monitoring → 닫기 의무 없음, completed → 닫아야 함.
- metric 기반 observation은 metric ok 복귀 시 자동 resolve.

### Headroom Decision 자동 생성

`analyzeHeadroom()`이 축별 headroom을 분석하고, 위험 축에 대해 Decision을 자동 생성한다. `applyHeadroomDecisions()`가 DKG 그래프에 기록.

### DSL 버전 스큐 관측

`analyzeAllVersionSkew()`가 DSL 번들 내 멤버 간 버전 격차를 분석하고, severity에 따라 Observation + Decision을 자동 생성. severity ok로 복귀하면 기존 Observation을 자동 해소.

## Lifecycle 전이

소스 위치: `packages/spec-core/src/dkg/skills/lifecycle-transition.ts`

| 노드 | 허용 전이 |
|------|-----------|
| Prefix | draft → active → deprecated → archived |
| DslBundle | draft → active → deprecated |
| Decision | active → superseded/reversed, reversed → active |
| Observation | open → resolved (accepted/deferred/rejected) |

전이 시 VersionEventNode로 이력을 기록하고, `evolves-from` 엣지로 이전 상태를 참조한다.

## 분리 유지 결정

축/prefix 중복이 발견되어도 도메인 컨텍스트가 다르면 분리를 유지한다.

- `recordSeparation()`: 분리 유지를 Decision으로 기록
- `hasActiveSeparationDecision()`: 기존 분리 결정이 있으면 병합 제안을 억제
- Decision의 `lifecycle`이 superseded/reversed가 되면 재검토 허용
