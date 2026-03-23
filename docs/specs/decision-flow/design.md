# Decision Flow — 의사결정 분기 관리 시스템

## 핵심 통찰

index-meta가 **공간의 좌표**를 다뤘다면, decision-flow는 **사고의 좌표**를 다룬다.

의사결정은 일련의 분기점(Gate)을 거치는 경로(Path)다.
각 분기점에서 근거(Evidence)에 따라 선택지(Branch)를 고른다.
이 전체 경로가 하나의 좌표(1D 정수)로 압축된다.

```
의사결정 플로우     ≡  Prefix (N차원 주소 공간)
분기점 (Gate)      ≡  Axis (차원)
선택지 (Branch)    ≡  Entry (차원 내 값)
결정 경로 (Path)   ≡  1D Address (정수)
하위 플로우 참조    ≡  prefix_ref (다른 prefix 주소)
```

## 왜 좌표인가

| 좌표 특성 | 의사결정에서의 의미 |
|-----------|-------------------|
| 압축 | 복잡한 결정 경로를 정수 하나로 저장 |
| 범위 질의 | "risk가 high 이상인 모든 결정" → BETWEEN 구간 |
| 집계 | 가장 빈번한 결정 경로 = 좌표 히스토그램 |
| 패턴 감지 | 비정상 결정 경로 = 좌표 이상치 |
| 합성 | 하위 플로우 = prefix_ref → 재귀 해석 |

## 인지 단계 분류 (Cognitive Phase)

모든 분기점은 인지적 성격을 갖는다. "계획한다"도 하나의 인지 단계다.

```
perceive  → 인지: 정보 수집, 관찰
interpret → 해석: 정보의 의미 파악
evaluate  → 평가: 선택지 비교 분석
decide    → 결정: 분기 선택
plan      → 계획: 실행 방법 구체화
execute   → 실행: 선택 이행
reflect   → 성찰: 결과 회고
```

OODA 루프의 확장:
- Observe → perceive + interpret
- Orient → evaluate
- Decide → decide + plan
- Act → execute + reflect

## 아키텍처

```
┌─────────────────────────────────────────────────────┐
│                    FlowSchema                        │
│  (정적 정의 — 어떤 결정을 어떤 순서로 내리는가)          │
│                                                      │
│  Gate[0]         Gate[1]          Gate[2]            │
│  ┌──────┐       ┌──────┐        ┌──────┐            │
│  │scope │       │plan  │        │exec  │            │
│  │──────│       │──────│        │──────│            │
│  │small │       │spike │ ←ref→ │water │            │
│  │medium│       │detail│  sub  │iter  │            │
│  │large │       │proto │  flow │exper │            │
│  └──────┘       └──────┘        └──────┘            │
│  perceive        plan            decide              │
└─────────────────────────────────────────────────────┘
         │              │               │
         ▼              ▼               ▼
┌─────────────────────────────────────────────────────┐
│                   FlowEngine                         │
│  (런타임 — 실제 결정을 실행하고 기록한다)                 │
│                                                      │
│  start → selectBranch(evidence) → ... → complete     │
│                                                      │
│  Evidence ──→ Policy 평가 ──→ 자동/수동 선택           │
│                                                      │
│  FlowInstance { selections, coordinateAddress }      │
└─────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│                Coordinate Layer                      │
│  (좌표 인코딩 — 경로를 정수로 압축한다)                  │
│                                                      │
│  FlowSchema → shape [3, 3, 3] → WeightedIndex       │
│  selections → encode → 1D address (0..26)            │
│  address → decode → { scope: "large", ... }          │
│                                                      │
│  선택 사항: flowToPrefixDef() → Catalog 통합           │
└─────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│              Analytics / Integration                 │
│  (분석 — 결정 패턴을 관찰하고 최적화한다)                 │
│                                                      │
│  - 결정 경로 빈도 히스토그램                             │
│  - 비정상 결정 패턴 감지                                │
│  - 분기점별 소요 시간 분석                               │
│  - 근거 유형별 결정 품질 상관                            │
│  - DKG 통합 (FlowSchemaNode)                         │
│  - Convergence 연동 (사용량 기반 스키마 최적화)           │
└─────────────────────────────────────────────────────┘
```

## 하위 플로우 합성 (Sub-flow Composition)

"계획한다"가 의사결정의 하위 플로우인 것처럼, 모든 분기점은 다른 플로우를 참조할 수 있다.

```typescript
// 메인 플로우: 기능 승인
const approvalFlow: FlowSchema = {
  id: "feature-approval",
  gates: [
    { id: "risk", phase: "perceive", branches: ["low", "medium", "high", "critical"] },
    { id: "planning", phase: "plan", subFlowId: "detailed-planning" },  // ← 하위 플로우
    { id: "approval", phase: "decide", branches: ["auto", "lead", "director", "vp"] },
  ],
};

// 하위 플로우: 상세 계획
const planningFlow: FlowSchema = {
  id: "detailed-planning",
  gates: [
    { id: "architecture", phase: "evaluate", branches: ["extend", "refactor", "new"] },
    { id: "timeline", phase: "plan", branches: ["1sprint", "2sprints", "epic"] },
    { id: "resources", phase: "decide", branches: ["solo", "pair", "team"] },
  ],
};
```

좌표 매핑:
```
feature-approval = risk(4) × planning(prefix_ref→detailed-planning) × approval(4)
detailed-planning = architecture(3) × timeline(3) × resources(3) = 27 경로

메인 플로우에서 planning 차원의 값 = 하위 플로우의 1D 주소 (0..26)
```

이것은 기존 index-meta의 `prefix_ref`와 정확히 같은 구조다.

## 정책 엔진 (Policy Engine)

반복되는 결정은 자동화할 수 있다. 정책(Policy)은 조건 → 분기 매핑이다.

```typescript
const autoApproveSmall: FlowPolicy = {
  id: "auto-approve-small",
  flowId: "feature-approval",
  priority: 100,
  conditions: [
    { field: "risk.branch", op: "eq", value: "low" },
    { field: "context.estimated_hours", op: "lt", value: 8 },
  ],
  action: { gateId: "approval", branchId: "auto" },
  rationale: "위험도 낮고 8시간 미만 작업은 자동 승인",
};
```

정책 평가 순서:
1. 현재 gate에 적용 가능한 정책 탐색
2. 조건 평가 (이전 선택 + 컨텍스트)
3. priority 기반 충돌 해소
4. 자동 선택 또는 수동 대기

## 근거 체계 (Evidence System)

모든 분기 선택에는 근거가 붙는다. 근거 유형:

| 유형 | 설명 | 예시 |
|------|------|------|
| data | 정량적 데이터 | "성능 테스트 결과 latency 200ms 초과" |
| rule | 규칙/정책 기반 | "보안 정책상 external API는 director 승인 필요" |
| precedent | 선례 기반 | "지난 분기 유사 건에서 동일 경로 선택" |
| intuition | 직관/경험 | "팀 리소스 상황 고려하면 iterative가 적절" |
| external | 외부 입력 | "고객사 요청으로 납기 2주 이내" |

근거는 weight(0-1)를 가지며, 분기 선택의 confidence를 산출하는 데 사용된다.

## 좌표 인코딩 예시

```
FlowSchema: "feature-approval"
  Gate 0: risk      → [low, medium, high, critical]  capacity: 4
  Gate 1: planning  → subFlow("detailed-planning")    capacity: 27
  Gate 2: approval  → [auto, lead, director, vp]      capacity: 4

Shape: [4, 27, 4] → 432 유효 경로
Strides: [108, 4, 1]

구체적 결정:
  risk = "high" (index 2)
  planning = detailed-planning 주소 14 (architecture:refactor, timeline:2sprints, resources:pair)
  approval = "director" (index 2)

Address = 2×108 + 14×4 + 2×1 = 274

"feature-approval:v1:274" → 전체 결정 경로가 정수 하나로 압축
```

## 기존 시스템과의 관계

```
                    ┌─────────────────┐
                    │   Catalog       │
                    │ (도메인 좌표)     │
                    └────────┬────────┘
                             │ axes, prefixes
                    ┌────────▼────────┐
                    │   index-meta    │
                    │ (인코딩 엔진)    │
                    └────────┬────────┘
                             │ WeightedIndex
              ┌──────────────┼──────────────┐
              │              │              │
     ┌────────▼───┐  ┌──────▼─────┐  ┌─────▼──────────┐
     │ permission │  │ event      │  │ decision-flow   │
     │ -engine    │  │ -catalog   │  │ (NEW)           │
     │ (권한)     │  │ (이벤트)    │  │ (의사결정 분기)   │
     └────────────┘  └────────────┘  └────────────────┘
```

decision-flow는 WeightedIndex를 직접 사용하되, Catalog 통합은 선택적이다.
- 독립 사용: FlowSchema만으로 좌표 인코딩
- Catalog 통합: flowToPrefixDef()로 기존 인프라(GateEngine, DKG, Convergence) 활용

## 패키지 의존성

```
decision-flow
  ├── weighted-index  (좌표 인코딩)
  └── @qa-sdk/core    (Catalog 통합 시, optional peer)
```

규칙: 수학/인코딩 라이브러리 → unscoped name + tsup dual format

## 향후 확장

1. **FlowSchemaNode** — DKG에 플로우 스키마를 노드로 등록. 의사결정 패턴도 설계 지식
2. **Decision Pattern Classification** — PatternRule 확장으로 결정 경로 분류
3. **Temporal Analysis** — 분기점별 소요 시간 분석 → 병목 감지
4. **A/B Path Comparison** — 동일 컨텍스트, 다른 경로 → 결과 비교
5. **Policy Learning** — 반복 패턴에서 자동 정책 생성
6. **Transition Spec 연동** — 결정 경로가 상태 전이를 트리거
