---
def:
  id: df-narrative-proofs
  scope: feature
  aspect: scenario
  depth: validation
  lifecycle: approved
  tags: [decision, testing]
  links:
    - target: df-narrative-group
      type: member_of
    - target: df-narrative-context
      type: traces_to
---
# Decision Flow — 서사 증명

## 목적 ^purpose

서사 증명 11장. 축 압축, 반복 패턴, 벡터 차이, 코어 gate, 직교성 검증, 축 선택 근거, 서사 조립, 컨텍스트 제공, 계층 통합, 실제 판단, 세션 영속.


---


## 참조

증명 코드: `packages/decision-flow/src/proof.test.ts` (125 tests)

## 장 1: 축은 결정의 구조를 압축한다

### 질문

소프트웨어 설계에서 반복되는 결정은 수십 개의 변수가 얽혀 있다.
이 복잡함을 소수의 축으로 줄일 수 있는가?

### 증명

`component-design` 플로우를 3개 축(scope, architecture, testing)으로 정의.
3×3×3 = 27 경로 → 1D 정수 주소 공간.

- 같은 선택 → 항상 같은 주소 (결정론적)
- 다른 선택 → 다른 주소 (식별력)
- 주소 → 원래 선택 복원 (라운드트립)

### 결론

**3개 축이 27가지 결정 경로를 정수 하나로 압축한다.**
나머지 변수(일정, 팀 역량 등)는 축이 아니라 *근거(Evidence)*로 기록된다.
축은 결정의 "구조"를 결정하고, 근거는 축 위의 "위치"를 결정한다.

---

## 장 2: 반복 결정에서 패턴이 드러난다

### 질문

개별 결정은 일회성처럼 보인다.
축으로 투영하면 반복 패턴이 보이는가?

### 증명

infra 팀 5회 반복: 매번 extend → integrated → integration.
PatternDetector가 감지: 빈도 5, 평균 confidence > 0.7.
정책 후보 자동 생성.

같은 기간 frontend 팀: 다양한 경로 → 패턴 없음.

### 결론

**같은 좌표에 반복 투영되는 점은 자동 정책 후보가 된다.**
축이 없으면 패턴을 볼 수 없다. 축이 있으면 "infra 팀은 항상 여기로 온다"가 보인다.

---

## 장 3: 두 결정의 차이를 축으로 설명한다

### 질문

"왜 A 팀은 new를, B 팀은 extend를 선택했는가?"

### 증명

두 FlowInstance 비교.
divergencePoint: scope (첫 번째 분기점, core gate).
evidence diff: A는 data 근거("신규 요구"), B는 precedent 근거("기존 패턴").

### 결론

**벡터 차이 = "어느 축에서 갈렸고, 근거가 어떻게 달랐는가".**
코어 gate에서 갈리면 후속 결정 전체에 cascade된다.

---

## 장 4: 코어 gate가 구조적 영향을 결정한다

### 질문

모든 결정이 동등한가?

### 증명

scope: weight=core, directImpact=2.
architecture: weight=structural, directImpact=1.
testing: weight=tactical, directImpact=0.

identifyCoreGates → scope만 코어.

### 결론

**scope(범위 결정)가 코어다.** "무엇을 만들 것인가"가 "어떻게 만들 것인가"를 결정하고,
"어떻게 만들 것인가"가 "어떻게 검증할 것인가"를 결정한다. 역방향은 에스컬레이션.

이것은 소프트웨어 설계의 보편적 패턴이다.

---

## 장 5: 직교성은 선언만으로 보장되지 않는다

### 질문

"cognitive_phase와 evidence_kind는 독립적이다"라는 사전 선언이 실제로도 성립하는가?

### 증명

**유지 케이스**: 다양한 조합 30건 → Cramér's V < 0.3 → 직교.
**위반 케이스**: evaluate→항상 data, decide→항상 rule → V > 0.7 → 직교성 의심.

### 결론

**사전 설계(a priori) + 사후 검증(a posteriori)의 균형.**
축은 아키텍트가 사전 설계하되, 데이터가 쌓이면 직교성을 검증하고 필요하면 축을 수정한다.

---

## 장 6: 축 선택의 근거가 코드에 산다

### 질문

11개 축은 어디서 왔는가? 그 근거가 6개월 후에도 읽을 수 있는가?

### 증명

AXIS_META 레지스트리: 11축 전부에 explains, designRationale, orthogonalTo.
Primary 3개 / Secondary 4개 / Contextual 4개.
직교 선언이 대칭 (A→B이면 B→A).

각 축에 "왜 대안 축 대신 이 축인가" 기술:
- cognitive_phase: "decision_speed보다 설명력이 높은 이유: 속도는 phase의 파생값"
- evidence_kind: "evidence_count보다 설명력이 높은 이유: 수가 아니라 종류가 품질을 좌우"

### 결론

**축 설계의 근거가 코드 안에 영구 보존된다.**
축을 바꿔도 "왜 바꿨는가"를 새 근거로 추가하면 서사가 이어진다.

---

## 장 7: 개별 결정이 모여 서사가 된다

### 질문

개별 gate 선택은 단편적이다. 이것들이 모여서 하나의 "이야기"가 되는가?

### 증명

`buildNarrative()`가 FlowInstance에서 서사를 추출한다:

```
배경:   "기존 모듈의 응답 시간이 SLA를 초과" (source: performance-alert)
여정:   scope=new (data: "성능 요구사항 불충족", confidence: 0.8, ★코어)
        architecture=layered (rule: "관심사 분리 원칙", confidence: 0.9)
        testing=integration (data: "API 경계 검증", confidence: 0.8)
도달:   address=정수, selections={scope:new, arch:layered, test:integration}
        coreSelections={scope:new}
산출:   module → packages/new-component
```

`extractPivotPoints()` → scope만 추출 (코어 전환점).
`summarizeNarrative()` → 한 줄 요약.
`findNarrativeDivergence()` → 두 서사의 분기점과 이유 차이.

회고(reflection)는 나중에 추가할 수 있다:
```
패턴: "신규 기능은 항상 standalone + unit으로 시작하는 경향"
교훈: "standalone이 맞지만 인터페이스를 먼저 정의할 것"
열린 질문: ["standalone에서 integrated로 전환하는 비용은?"]
```

### 결론

**서사의 구조: 배경 → 여정 → 도달 → 산출 → 회고.**

개별 결정은 여정의 한 걸음이다. 걸음이 모이면 결정 공간의 한 점에 도달한다.
도달한 점은 정수 하나로 압축되고, 여정의 기억은 서사로 기록된다.

서사는 지워지지 않는다.
같은 점에 다른 근거로 도달하면 다른 서사다.
서사가 쌓이면 "이 영역은 어떤 상황에서, 어떤 이유로 도달하는가"가 드러난다.

그것이 패턴이고, 패턴이 모이면 정책이 되고, 정책이 검증되면 자동화가 된다.

```
결정 → 서사 → 패턴 → 정책 → 자동화
              ↑                    │
              └────── 회고 ────────┘
```

---

## 장 8: 시스템의 역할은 결정을 쉽게 만드는 것이다

ContextProvider가 이력+패턴+정책+모델힌트를 한 번에 표면화. 기록이 아니라 컨텍스트 제공이 핵심 가치. 결정할수록 다음 결정의 컨텍스트가 풍부해짐 (축적 사이클 검증).

---

## 장 9: 시스템 구조를 관통하여 맥락을 조합한다

assembleHierarchicalContext()가 5개 레벨(Domain→DSL→Category→Prefix→Dim)을 수직으로 관통. prefix 이름 하나로 도메인 경계, DSL 불변조건, 차원 headroom까지 한 번에 표면화.

---

## 장 10: 실제 의사결정 — Auto IntentLink 안정화 판단

### 배경

Auto IntentLink 발견 기능이 CLAUDE.md에 추가됨.
session 기반 prefix 공출현 분석 + IL 자동 제안. 출시 1주.
안정화가 필요한가?

### 과정

```
stabilization flow 실행:
  버그 빈도   = low    (issue tracker 0건, 에러율 0%)
  성능 상태   = healthy (P99 45ms, SLA 250ms)
  코드 품질   = acceptable (동작하지만 session 로직 분리 후보)
  판정       = stable (현 상태 유지)

좌표 주소: 100
평균 confidence: 0.80
모니터 알림: 없음
```

### 결론

```
[주제] 이 기능을 안정화해야 하는가
[목적] 버그/성능/코드품질 기반으로 안정화 필요성 판단
[결정] 버그빈도=low (코어 gate)
[결론] deferred (3/4 기준 충족)
  ✅ 버그 빈도 정확히 측정됨
  ✅ 성능이 SLA 대비 정확히 평가됨
  ✅ 판정 결과가 실제 상태에 비례함
  ⏳ 1개월 내 인시던트 없음 — 아직 1주밖에 안 됨, 추후 검증 필요
```

**deferred**: 3/4 기준 충족이지만 시간 기반 기준(1개월)이 아직 미충족.
이것이 과정과 결론의 시간축 분리의 실제 사례.
3주 후에 4번째 기준을 재검증하면 success 또는 failure로 전환.

### 관찰

1. **코어 gate(버그빈도=low)가 결정을 빠르게 만든다** — low이면 나머지 gate는 확인만
2. **bezos-doors가 실제로 작동** — "two-way door이므로 나중에 분리해도 됨" → stable 판정 근거
3. **deferred는 실패가 아니다** — 시간이 필요한 기준이 있으면 정직하게 보류
4. **모니터가 침묵하는 것이 좋은 신호** — confidence 0.80, 알림 0건

---

## 장 11: 세션을 넘어서 — 결정 이력이 영속된다

### 질문

CLI는 매 명령마다 새 프로세스다. 결정을 시작하고, 중간에 생각하고, 다음 프로세스에서 이어서 선택할 수 있는가?
그리고 완료된 결정을 다음 달에도 조회할 수 있는가?

### 증명

`~/.qa-sdk/decision-flow.sqlite`에 모든 FlowInstance를 영속.

```
프로세스 1: flow start test-needed     → SQLite INSERT (active)
프로세스 2: flow status                → SQLite에서 active 복원 → 진행 상태 표시
프로세스 3: flow select new-feature    → 복원 → 선택 → SQLite UPDATE
프로세스 4: flow select module         → 복원 → 선택 → SQLite UPDATE
프로세스 5: flow select partial        → 복원 → 선택 → SQLite UPDATE
프로세스 6: flow select add-integration → 복원 → 완료 → SQLite UPDATE (completed)
프로세스 7: flow history               → SQLite에서 완료 이력 조회
```

7개 프로세스에 걸쳐 하나의 결정이 진행되고 완료됨.

### 결론

**결정은 프로세스 수명에 묶이지 않는다.**

- active 인스턴스: 프로세스 종료 → SQLite에 보존 → 다음 프로세스에서 복원
- completed 인스턴스: 영구 보존 → history/lookup/verdict로 조회
- decision-flow 라이브러리 자체는 순수 유지 (SQLite 의존 없음). 영속은 소비자(CLI)의 책임

이것은 "시스템의 역할은 결정을 쉽게 만드는 것"의 또 다른 측면:
생각하는 시간이 CLI 프로세스의 수명에 제한받지 않는다.

---

> **다음 장을 위한 열린 질문:**
> - 서사 간의 인과 관계를 DKG 그래프로 표현할 수 있는가?
> - 서사의 회고가 다음 서사의 축 설계에 피드백되는 경로는?
> - 다른 도메인(인프라 운영, 데이터 파이프라인)에 같은 축이 적용되는가?
> - 컨텍스트 제공의 "적정 수준"은 어디인가? (너무 많으면 노이즈, 너무 적으면 가치 없음)
