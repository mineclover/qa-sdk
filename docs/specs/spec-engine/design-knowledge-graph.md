---
def:
  id: dkg-original
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: deprecated
---

# Design Knowledge Graph — 설계 시점 메타데이터 그래프

## 목적 ^purpose

고정 축을 정의하고, 운용하고, 운용에서 새 기능을 발견하는 설계 시점 메타데이터 그래프. (deprecated — dkg-system/ 문서로 분할됨)

기반: [README.md](README.md) · [core-types.md](core-types.md) · [../indexing/coordinate-states.md](../indexing/coordinate-states.md) · [../indexing/ontology-evaluation.md](../indexing/ontology-evaluation.md)

---

## 정체성

이것은 범용 지식그래프가 아니다.

좌표 시스템이 "주소를 부여"하듯, 이 그래프는 **"주소 체계의 설계 결정에 추적성을 부여"**한다.

```
좌표 시스템:  유한한 조합 → 유일한 정수 (주소)
DKG:         설계 결정 → 구조적 근거 (추적성)
```

### 핵심 원리: 누적적 성장 나선

DKG의 핵심은 유지보수 사이클이 아니라 **누적적 성장 나선**이다.

```
고정 축 정의 → 운용 → 기능 발견/정의 → 그 기능이 새 고정 축이 됨 → 운용 → ...
```

각 회전이 시스템에 새 구조를 더한다:

1. **고정 축을 정의한다** — role, action, resource 같은 차원을 닫는다
2. **닫힌 축으로 기능을 운용한다** — qa-sdk가 encode/decode, 권한, 이벤트를 처리한다
3. **운용 과정에서 새 기능이 정의된다** — "사용자 행동 추적이 필요하다", "이벤트 관계를 표현해야 한다"
4. **정의된 기능이 새 고정 축이 된다** — trackAction, page, userType 축 → tracking prefix로 고정
5. **새 고정 축이 기존 축과 합류하여 다시 운용된다** — 더 풍부한 좌표 체계로 성장

이 나선의 매 회전에서 DKG는 두 가지를 한다:
- **탐색**: 새 기능이 기존 구조와 어떤 관계인지 그래프로 파악한다
- **보존**: 왜 이것을 고정 축으로 만들었는지 Decision으로 남긴다

```
              회전 1               회전 2               회전 3
              ──────               ──────               ──────
고정 축:      role, action,       + trackAction,       + subjectKind,
              resource, env...     page, userType...    predicate, objectKind...

prefix:       permission,         + tracking            + relational
              service, event

기능:         권한 관리,           + 사용자 행동 추적     + 관계 모델
              이벤트 발행

DKG 기록:     DEC-001~003         DEC-004~006          DEC-007~009
              (왜 이 축인가)       (왜 추적이 필요한가)   (왜 관계를 축으로 닫는가)
```

닫힌 세계는 제약이 아니라 목적이다. 그리고 닫힌 세계를 만들어가는 과정 자체가 시스템의 성장이다.

### 왜 DKG가 필요한가

이 성장 나선에서 DKG 없이도 축을 추가하고 prefix를 만들 수 있다. 그러나:

- 축을 정의할 때 — "이 차원이 기존 축과 겹치지 않는가?" → **composes/references 엣지 탐색**
- 기능을 고정 축으로 만들 때 — "왜 이것을 닫았는가? 대안은?" → **Decision 노드 보존**
- 운영 중 — "이 두 축은 실은 병합할 수 있지 않은가?" → **Observation → Decision 순환**
- 3회전째 — "1회전의 결정이 아직 유효한가?" → **Decision.reversalConditions 검토**

성장 나선이 반복될수록 구조가 복잡해지고, 과거 결정의 맥락은 잊혀진다. DKG는 이 맥락을 **구조적으로 보존**하여 나선의 매 회전이 과거를 훼손하지 않게 한다.

### 이것이 하지 않는 것

| 하지 않는 것 | 이유 |
|---|---|
| 런타임 데이터 저장 | 데이터 저장 계층의 책임 |
| encode/decode 연산 | indexing 레이어의 책임 |
| OWL 수준의 자동 추론 | 설계자의 판단을 보조하되 대체하지 않음 |
| 좌표 시스템의 닫힌 세계를 열기 | 닫힌 세계는 목적이다 |
| constraint 자동 강제 | 경고와 정보 제공. 강제는 spec-engine 검증 |
| 마이그레이션 실행 | indexing 레이어의 책임 |

---

## DKG와 qa-sdk의 역할 경계

DKG와 qa-sdk는 동일한 좌표 체계에 대해 **설계 시점과 운영 시점의 다른 관심사**를 담당한다.

### 서비스 경계와 연결

qa-sdk는 서비스 간 경계를 좌표 체계로 정의하고, 트래커를 통해 경계면을 실제로 연결한다:

```
DKG (설계 시점):
  "auth-service와 payment-service는 permission prefix를 공유하도록 설계했다"
  "이 공유의 의도: 동일한 role 체계로 권한을 검증하기 위함"
  "이 연결이 깨지면 안 되는 이유: ..."
      │
      │  설계 의도가 좌표 체계로 고정됨
      ▼
qa-sdk (운영 시점):
  · prefix로 서비스 경계 정의 (encode/decode + export surface)
  · registry로 버전 관리 (어떤 서비스가 어떤 version을 쓰는지)
  · tracker로 경계면 연결 (이벤트 발행 → 수신, 권한 인코딩 → 검증)
  · 런타임 호환성 검증 (버전 차이, 마이그레이션 필요성)
```

### 역할 분담

| 관심사 | DKG (설계 시점) | qa-sdk (운영 시점) |
|---|---|---|
| **서비스 경계** | 어떤 서비스가 어떤 prefix를 쓰도록 설계했는가 (Consumer + consumes) | prefix로 경계 실체화, registry로 등록/조회 |
| **연결 의도** | 왜 이 서비스들이 이 prefix를 공유하는가 (IntentLink) | 트래커가 경계면을 실제로 연결 |
| **버전 관리** | 왜 이 버전으로 전환했는가 (VersionEvent + Decision) | 어떤 서비스가 어떤 버전을 실행 중인가 |
| **호환성** | 이 변경이 의도적 연결을 깨뜨리는가 (IntentLink.invariant) | 런타임 호환성 검증 + 마이그레이션 실행 |
| **발견** | 운영 관찰을 기록하고 다음 결정으로 연결 (Observation → Decision) | 런타임 메트릭/로그에서 이슈 감지 |

### 정보 흐름

```
DKG → qa-sdk:  설계 의도 (어떤 연결이 존재해야 하는가)
qa-sdk → DKG:  운영 관찰 (연결이 실제로 어떻게 동작하는가, 무엇이 발견되었는가)
```

DKG가 설계 의도를 제공하면, qa-sdk는 그 의도에 따라 경계를 정의하고 연결을 실행한다. qa-sdk가 운영 중 발견한 것은 Observation으로 DKG에 돌아와 다음 성장 나선의 씨앗이 된다.

---

## 기존 체계와의 관계

### 계층 구조

```
┌─────────────────────────────────────────────────────────┐
│  Design Knowledge Graph (이 문서)                        │
│  · 설계 시점 관계 탐색 (열린 세계)                        │
│  · closure 근거 보존                                     │
│  · 변경 영향 분석                                        │
│  · 운영 피드백 수용                                      │
├─────────────────────────────────────────────────────────┤
│  Spec Engine (기존, 확장)                                │
│  · ExportSurface, Schema, SpecDocument                  │
│  · 구조 검증 (Layer 2)                                   │
│  · prefix ↔ spec 연결                                    │
├─────────────────────────────────────────────────────────┤
│  Indexing Layer (기존, 변경 없음)                         │
│  · encode/decode, stride, shape, version                 │
│  · DEMO_CATALOG (SSOT)                                   │
└─────────────────────────────────────────────────────────┘

의존 방향: DKG → Spec Engine → Indexing (역방향 금지)
```

### spec-engine과의 분담

| 관심사 | Spec Engine | DKG |
|---|---|---|
| **"이 prefix는 밖에서 뭘 보나"** | ExportSurface | — |
| **"이 구조는 유효한가"** | SchemaValidator | — |
| **"이 prefix는 왜 존재하는가"** | SpecDocument.rationale (텍스트) | Decision + Constraint (그래프 구조) |
| **"이걸 바꾸면 어디까지 영향이 가나"** | — | composes/references 엣지 순회 |
| **"운영 중 발견한 이슈를 어디에 기록하나"** | — | Observation 노드 |
| **"이전 결정을 왜 뒤집었나"** | — | supersedes 엣지 + Decision 계보 |

SpecDocument는 DKG의 Spec 노드로 승격된다. 기존 SpecRelation 5종은 DKG 엣지로 승계된다.

---

## 성장 나선 모델

### 한 회전의 구조

```
  ┌─ DKG 탐색 (열린 세계) ──────────────────────────────────────┐
  │  · 기존 그래프에서 관계 탐색                                   │
  │  · 새 기능과 기존 축의 영향 분석                               │
  │  · 대안 비교, constraint 확인                                 │
  │                                                              │
  │  산출: Decision ("왜 이것을 고정 축으로 만드는가")               │
  │        Constraint ("이 축은 어떤 규칙을 따라야 하는가")          │
  ├──────────────────────────────────────────────────────────────┤
  │                                                              │
  │  DEMO_CATALOG 고정 (닫힌 세계)                                │
  │  · 새 축/prefix 등록, version seal, capacity 확정             │
  │  · 기존 축과 합류하여 좌표 체계 확장                            │
  │                                                              │
  ├──────────────────────────────────────────────────────────────┤
  │                                                              │
  │  qa-sdk 운영                                                  │
  │  · 확장된 좌표 체계로 기능 실행 (encode/decode, 권한, 이벤트)    │
  │  · 기능 간 관계 발견, 개념 병합 검토, 새 기능 필요성 인식         │
  │                                                              │
  │  산출: Observation ("운영에서 발견한 것 / 새로 필요한 것")       │
  └──────────────────── 다음 회전으로 ───────────────────────────┘
```

### 나선의 누적

각 회전은 이전 회전의 결과 위에 쌓인다. 시스템은 돌아가는 것이 아니라 **올라간다**.

```
회전 3 ──→ 관계 모델 (subjectKind × predicate × objectKind)
  │         기능: 이벤트 간 관계 추적, 관계 기반 질의
  │         DKG: DEC-007~009 + OBS-003~004
  │
회전 2 ──→ 사용자 행동 추적 (trackAction × page × userType)
  │         기능: 행동 분석, 퍼널 추적
  │         DKG: DEC-004~006 + OBS-001~002
  │
회전 1 ──→ 핵심 인프라 (role × action × resource, service, event)
            기능: 권한 관리, 이벤트 발행, 서비스 식별
            DKG: DEC-001~003

시간 ──────────────────────────────────────────────────→
```

회전 2의 tracking prefix는 회전 1의 service prefix를 `prefix_ref`로 참조할 수 있다. 회전 3의 relational prefix는 회전 1~2의 축을 subjectKind/objectKind로 참조할 수 있다. **이전 회전의 고정 축이 다음 회전의 재료가 된다.**

### 각 단계의 역할

| 단계 | 세계관 | 행위 | 산출물 |
|---|---|---|---|
| **DKG 탐색** | 열린 세계 (OWA) | 기존 그래프에서 관계 탐색, 새 축의 영향 분석, 대안 비교 | Decision, Constraint |
| **CATALOG 고정** | 닫힌 세계 (CWA) | 새 axis/prefix 등록, 기존 체계와 합류, version seal | 확장된 좌표 체계 |
| **qa-sdk 운영** | 닫힌 세계 실행 | encode/decode, 권한, 이벤트, 검증, 개념 병합 검토, 새 기능 정의 | 운영 데이터 + 새 기능 후보 |
| **관측 피드백** | 열린 세계 (OWA) | 기능 후보 구체화, 기존 구조 문제 발견, 병합/분리/폐기 제안 | Observation |

### 열린 세계와 닫힌 세계의 경계

DKG는 열린 세계(OWA)로 동작한다 — 새 노드, 새 엣지, 새 관계를 자유롭게 추가한다. 이 탐색의 결과가 확정되면 DEMO_CATALOG에 반영되어 닫힌 세계(CWA)로 굳는다.

**"굳힘"의 근거가 Decision 노드로 DKG에 남는다.** 이것이 나선의 매 회전을 연결하는 접착제다. 3회전째에 "왜 1회전에서 role을 이렇게 닫았지?"라는 질문에 DEC-001이 답한다.

qa-sdk가 닫힌 세계를 운영하면서 발견한 것 — 새로운 기능의 필요성, 기존 개념의 병합 가능성, 불필요한 차원 — 은 Observation 노드로 DKG에 돌아와 다음 회전의 씨앗이 된다.

---

## 노드 (Node Types)

### 기존 승계 (4종)

spec-engine의 기존 타입을 그래프 노드로 승격한다.

#### Axis

DEMO_CATALOG의 축. 1D 차원 정의.

```typescript
interface AxisNode {
  kind: "axis";
  id: string;            // "role", "env", "action" — catalog axis ID
  name: string;          // "역할", "환경"
  currentVersions: string[];  // ["v1", "v2", "v3", "v4"]
}
```

DKG에서의 역할: 변경 영향의 출발점. "이 축이 바뀌면 어떤 prefix가 영향받나?"

#### Prefix

DEMO_CATALOG의 주소 공간. N-D 차원 조합.

```typescript
interface PrefixNode {
  kind: "prefix";
  id: string;            // "permission", "service", "cart_event"
  name: string;          // "권한", "서비스"
  dimLabels: string[];   // ["perm_svc", "role"]
}
```

DKG에서의 역할: 영향 분석의 중심. 축 변경과 참조 변경이 여기서 합류.

#### Spec

spec-engine의 SpecDocument. 설계 근거 문서.

```typescript
interface SpecNode {
  kind: "spec";
  id: string;            // "FEAT-003", "REQ-001"
  type: SpecType;        // "req" | "feat" | "uc" | "evt" | "ls" | "adr"
  title: string;
  lifecycle: "draft" | "active" | "deprecated";
}
```

spec-engine의 SpecDocument를 그대로 승격. 기존 SpecRelation 5종은 DKG 엣지로 승계.

#### Schema

spec-engine의 SchemaDef. 구조 정의.

```typescript
interface SchemaNode {
  kind: "schema";
  id: string;            // "event.base", "policy.permission"
  category: SchemaCategory;
  version: string;
}
```

### 신규 (8종)

#### Decision — closure provenance의 핵심

특정 시점의 설계 결정. **"무엇을 왜 닫았는가"**를 기록한다.

```typescript
interface DecisionNode {
  kind: "decision";
  id: string;                     // "DEC-001"
  date: string;                   // "2026-03-20"
  title: string;                  // "role capacity를 8로 설정"

  /** 결정 당시 상황 */
  context: string;

  /** 왜 이렇게 결정했는가 */
  rationale: string;

  /** 검토했으나 선택하지 않은 대안 */
  alternatives?: string[];

  /** 이 결정을 뒤집어야 하는 조건 (ADR reversal conditions과 동일 개념) */
  reversalConditions?: string[];

  lifecycle: "active" | "superseded" | "reversed";
}
```

**예시:**
```yaml
DEC-001:
  title: "role axis capacity를 8로 설정"
  date: "2026-03-15"
  context: "v1~v3에서 5→6→6으로 증가. 현재 7개 사용 중 (auditor 추가 예정)"
  rationale: "8 = 2^3, bitmask 연산에 최적. 1 슬롯 여유로 즉시 추가 가능"
  alternatives:
    - "16 — 과도한 headroom, 낭비"
    - "7 — 여유 없음, 다음 추가 시 즉시 stride-break"
  reversalConditions:
    - "8개 역할이 모두 사용되고 9번째가 필요할 때"
    - "bitmask 정렬보다 주소 밀도가 더 중요해질 때"
  lifecycle: active
```

#### VersionEvent — 진화의 기록

버전 전환 이벤트. **"무엇이 바뀌었고 왜"**를 기록한다.

```typescript
interface VersionEventNode {
  kind: "version-event";
  id: string;                    // "VE-role-v3-v4"
  subjectId: string;             // "role" (axis) 또는 "permission" (prefix)
  subjectKind: "axis" | "prefix";
  fromVersion: string;           // "v3"
  toVersion: string;             // "v4"
  date: string;

  /** 구체적 변경 내용 */
  changes: VersionChange[];

  /** 영향 범위 요약 */
  impact: string;
}

interface VersionChange {
  kind:
    | "entry-added"       // 새 entry 등록
    | "entry-deactivated" // entry 비활성화
    | "capacity-changed"  // capacity 변경 (stride-break 가능)
    | "dim-added"         // prefix에 차원 추가
    | "ref-changed";      // prefix_ref 대상 변경
  detail: string;
}
```

**예시:**
```yaml
VE-role-v3-v4:
  subject: role (axis)
  from: v3
  to: v4
  date: "2026-03-15"
  changes:
    - kind: entry-added
      detail: "position 6에 'auditor' 추가 (ko: 감사자)"
  impact: "capacity 8 → 8 (불변). shape 변경 없음. permission prefix에 no-impact"
```

#### Constraint — 구조적 불변 규칙

축/prefix 간 지켜져야 하는 규칙. **위반 시 경고**를 발생시킨다.

```typescript
interface ConstraintNode {
  kind: "constraint";
  id: string;                    // "CON-001"

  /** 자연어 규칙 서술 */
  rule: string;

  /** 선택적 formal expression (검증 자동화용) */
  formal?: string;

  /** 적용 대상 ID 목록 */
  scope: string[];

  lifecycle: "active" | "suspended" | "retired";
}
```

**예시:**
```yaml
CON-001:
  rule: "rbac_role과 role은 별개 도메인이다. 같은 prefix에 동시 사용 금지"
  formal: "NOT EXISTS(prefix p WHERE p.dims HAS 'rbac_role' AND p.dims HAS 'role')"
  scope: [rbac_role, role]
  lifecycle: active

CON-002:
  rule: "이벤트 prefix의 action 차원은 반드시 해당 도메인의 *_action 축을 사용해야 한다"
  formal: "event_prefix.action.axisId ENDS_WITH '_action'"
  scope: [cart_event, auth_event, order_event]
  lifecycle: active
```

#### Observation — 운영 피드백

qa-sdk 운영 중 발견한 사실. **DKG 순환의 역방향 입구.**

```typescript
interface ObservationNode {
  kind: "observation";
  id: string;                      // "OBS-001"
  date: string;
  source:
    | "runtime"     // 런타임 메트릭/로그에서 발견
    | "review"      // 코드 리뷰/설계 검토에서 발견
    | "metric"      // 주소 공간 사용률 분석에서 발견
    | "manual";     // 개발자가 직접 기록

  /** 관련 axis/prefix ID */
  subjects: string[];

  /** 발견한 사실 */
  finding: string;

  /** 제안 (있으면) */
  suggestion?: ObservationSuggestion;

  /** 처리 결과 (나중에 채움) */
  resolution?: {
    decisionId: string;
    outcome: "accepted" | "deferred" | "rejected";
    note?: string;
  };
}

type ObservationSuggestion =
  | { kind: "merge"; targets: string[]; into: string }
  | { kind: "split"; target: string; into: string[] }
  | { kind: "deprecate"; target: string; reason: string }
  | { kind: "add-entry"; axis: string; entry: string }
  | { kind: "add-constraint"; rule: string }
  | { kind: "revise-decision"; decisionId: string; reason: string };
```

**예시:**
```yaml
OBS-001:
  date: "2026-03-18"
  source: review
  subjects: [rbac_role, role]
  finding: "코드 리뷰 중 rbac_role과 role의 entry가 부분 중복 발견 (admin 공통)"
  suggestion:
    kind: revise-decision
    decisionId: DEC-003
    reason: "동명이의어 혼동 방지를 위해 naming convention 정비 필요"
  resolution:
    decisionId: DEC-005
    outcome: accepted
    note: "rbac_role entries에 'rbac_' prefix 추가는 기각. 대신 축 description 강화"

OBS-002:
  date: "2026-03-20"
  source: metric
  subjects: [permission]
  finding: "permission prefix v4의 주소 공간 사용률 12% — 80개 중 10개만 활성"
  suggestion:
    kind: revise-decision
    decisionId: DEC-001
    reason: "capacity headroom이 과도한지 검토 필요"
  resolution: null  # 아직 미처리
```

#### Consumer — 좌표 체계의 의도된 소비자

좌표 시스템을 사용하도록 **설계된** 서비스/시스템. "누가 이 prefix를 쓰도록 설계했는가"를 기록한다.

**런타임 상태(현재 어떤 버전인지, 배포 상태, 마이그레이션 진행도)는 qa-sdk가 운영 시점에 관리한다.** DKG에는 설계 의도만 남긴다.

```typescript
interface ConsumerNode {
  kind: "consumer";
  id: string;                    // "auth-service", "payment-service", "platform-demo"

  /** 소비자 유형 */
  type:
    | "service"      // 백엔드 서비스
    | "client"       // 프론트엔드/SDK 클라이언트
    | "tool"         // CLI, 빌드 도구
    | "external";    // 외부 시스템

  /** 이 소비자가 사용하도록 설계된 prefix 목록 */
  intendedPrefixes: string[];    // ["permission", "service", "event"]

  /** 설계 시점 참고 — 왜 이 소비자가 이 prefix를 쓰는가 */
  rationale?: string;
}
```

DKG에서의 역할: **영향 분석의 종착점.** 축 변경 → prefix 영향 → 이 prefix를 쓰도록 설계된 consumer까지 cascade를 추적한다. 실제 런타임 버전 호환성 검사는 qa-sdk의 registry/decode 서비스가 수행한다.

**예시:**
```yaml
auth-service:
  kind: consumer
  type: service
  intendedPrefixes: [permission, service]
  rationale: "인증 서비스는 서비스별 역할 권한을 검증해야 한다"

payment-service:
  kind: consumer
  type: service
  intendedPrefixes: [permission, service, event]
  rationale: "결제 서비스는 권한 + 이벤트 발행 + 서비스 컨텍스트를 모두 사용한다"

platform-demo:
  kind: consumer
  type: client
  intendedPrefixes: [permission, service, tracking, rbac]
  rationale: "데모 클라이언트는 전체 prefix를 시뮬레이션한다"
```

#### IntentLink — 기능 간 연결 의도

두 prefix(또는 axis)가 공유되는 것이 **의도적**임을 명시한다. 구조적 참조(prefix_ref)만으로는 "왜 이 둘이 연결되어 있는가"를 알 수 없다.

```typescript
interface IntentLinkNode {
  kind: "intent-link";
  id: string;                    // "IL-001"

  /** 연결되는 대상 2개 이상 */
  endpoints: string[];           // ["permission", "event"] 또는 ["auth-service", "payment-service"]

  /** 공유 매개체 */
  via: string;                   // "service" (prefix), "role" (axis)

  /** 연결 의도 */
  intent: string;                // "권한과 이벤트가 동일한 서비스 컨텍스트를 공유해야 한다"

  /** 이 연결이 끊어지면 안 되는 이유 */
  invariant?: string;            // "서비스 주소가 다르면 이벤트와 권한의 대응이 깨진다"
}
```

**예시:**
```yaml
IL-001:
  kind: intent-link
  endpoints: [permission, event]
  via: service
  intent: "권한과 이벤트가 동일한 서비스 컨텍스트를 공유한다"
  invariant: "service prefix_ref가 같은 service 주소 공간을 가리켜야 이벤트 발생 시 해당 서비스의 권한을 조회할 수 있다"

IL-002:
  kind: intent-link
  endpoints: [auth-service, payment-service]
  via: permission
  intent: "두 서비스가 동일한 권한 체계를 공유한다"
  invariant: "role axis의 entries가 두 서비스에서 같은 의미여야 한다"
```

#### Domain — prefix 그룹의 바운더리/컨텍스트

관련된 prefix들을 묶는 바운더리. 개별 prefix보다 큰, Consumer보다 작은 **중간 스케일**의 구조 단위.

```typescript
interface DomainNode {
  kind: "domain";
  id: string;                    // "shopping-domain", "tracking-domain"
  name: string;                  // "쇼핑 서비스 도메인"

  /** 이 도메인에 포함된 prefix 목록 */
  prefixes: string[];            // ["permission", "event", "service"]

  /** 도메인 내 prefix들이 공유하는 축 */
  sharedAxes: string[];          // ["env", "region", "svc_name", "namespace"]

  /** 바운더리 정의 — 외부 노출 vs 내부 전용 */
  boundary: {
    exports: string[];           // 외부에 노출하는 prefix
    internal: string[];          // 도메인 내부에서만 직접 참조
  };

  rationale?: string;
}
```

DKG에서의 역할: **스케일 재귀의 중간 단위.** 개별 prefix 변경이 같은 도메인의 다른 prefix에 미치는 영향을 도메인 단위로 파악한다. Consumer는 도메인 단위로 소비할 수 있다.

**예시:**
```yaml
shopping-domain:
  kind: domain
  name: "쇼핑 서비스 도메인"
  prefixes: [permission, event, service]
  sharedAxes: [env, region, svc_name, namespace]
  boundary:
    exports: [permission, event]
    internal: [service]
  rationale: "권한과 이벤트가 동일한 서비스 컨텍스트를 공유하는 도메인"

tracking-domain:
  kind: domain
  name: "행동 추적 도메인"
  prefixes: [tracking, content]
  sharedAxes: [channel, locale]
  boundary:
    exports: [tracking]
    internal: [content]
  rationale: "사용자 행동과 콘텐츠가 같은 채널/로케일 컨텍스트를 공유"

event-domain:
  kind: domain
  name: "이벤트 도메인"
  prefixes: [cart_event, auth_event, order_event]
  sharedAxes: []
  boundary:
    exports: [cart_event, auth_event, order_event]
    internal: []
  rationale: "table_ref 기반 이벤트 prefix 그룹. 각각 독립적이지만 동일한 이벤트 패턴을 공유"
```

### 노드 요약

| 노드 | 출처 | 닫힌 세계 대응 | 열린 세계 역할 |
|---|---|---|---|
| Axis | DEMO_CATALOG | entries, capacity, version | 변경 영향의 출발점 |
| Prefix | DEMO_CATALOG | dims, prefix_ref, version | 영향 분석의 중심 |
| **Domain** | DKG 고유 | — | **prefix 그룹 바운더리** |
| Spec | spec-engine | SpecDocument | 설계 근거 문서 |
| Schema | spec-engine | SchemaDef | 구조 카테고리 + 제약 |
| **Decision** | DKG 고유 | — | **closure provenance** |
| **VersionEvent** | DKG 고유 | version diff | **진화 기록** |
| **Constraint** | DKG 고유 | — | **구조적 불변 규칙** |
| **Observation** | DKG 고유 | — | **운영 피드백** |
| **Consumer** | DKG 고유 | — | **설계된 소비자** |
| **IntentLink** | DKG 고유 | — | **연결 의도 명시** |
| **DslBundle** | DKG 고유 | — | **DSL 번들 (prefix 그룹 패키징)** |

---

## 엣지 (Edge Types)

### 승계: spec-engine SpecRelation (5종)

기존 SpecRelation을 그대로 승계. Spec ↔ Spec 간 관계.

| 엣지 | from → to | 의미 |
|---|---|---|
| `satisfies` | Spec → Spec | 요구사항을 충족 |
| `implements` | Spec → Spec | 기능을 구현 |
| `tests` | Spec → Spec | 검증 |
| `traces-to` | Spec → Spec | 추적 연결 |
| `depends-on` | Spec → Spec | 의존 |

### 설계 순방향 (5종)

설계 결정이 구조에 영향을 미치는 방향.

#### `composes` — Prefix → Axis

prefix가 이 축을 차원으로 사용한다.

```
Prefix(permission) ──composes──→ Axis(role)
Prefix(permission) ──composes──→ Axis(action)
Prefix(order_event) ──composes──→ Axis(order_action)
```

용도: **영향 분석의 기본 엣지.** `Axis(role)` 변경 시 `←composes── Prefix(*)` 역순회로 영향받는 모든 prefix를 찾는다.

DimRef kind에 따른 composes 구분:

| DimRef kind | composes 속성 | 의미 |
|---|---|---|
| `axis` | `dimKind: "axis"` | 축을 직접 차원으로 사용 |
| `prefix_ref` | `dimKind: "prefix_ref"` | 다른 prefix의 주소 공간을 차원으로 편입 |
| `table_ref` | `dimKind: "table_ref"` | 테이블 인스턴스 참조 (인코딩에서 제외) |

#### `references` — Prefix → Prefix

prefix_ref를 통한 주소 공간 참조.

```
Prefix(permission) ──references──→ Prefix(service)    # perm_svc → service
Prefix(event) ──references──→ Prefix(service)          # evt_svc → service
Prefix(order_event) ──references──→ Prefix(service)    # service_ctx → service
```

용도: **참조 체인 추적.** `Prefix(service)` 변경 시 그것을 참조하는 모든 prefix를 찾는다.

#### `governs` — Spec → Axis | Prefix

이 spec이 이 구조의 설계 근거를 제공한다.

```
Spec(FEAT-003) ──governs──→ Prefix(permission)
Spec(REQ-001)  ──governs──→ Axis(role)
```

용도: **근거 역추적.** "이 prefix가 존재하는 이유는?" → `←governs── Spec(*)`.

#### `justifies` — Decision → Axis | Prefix | VersionEvent

이 결정이 이 구조를 정당화한다.

```
Decision(DEC-001) ──justifies──→ Axis(role)           # capacity=8 결정
Decision(DEC-001) ──justifies──→ VersionEvent(VE-role-v3-v4)  # 이 결정이 v4를 만든 이유
Decision(DEC-002) ──justifies──→ Prefix(permission)   # 이 prefix 구성 결정
```

용도: **closure provenance.** "왜 이 capacity인가?" → `←justifies── Decision(*)`.

#### `constrains` — Constraint → Axis | Prefix

이 규칙이 이 구조를 제약한다.

```
Constraint(CON-001) ──constrains──→ Axis(rbac_role)
Constraint(CON-001) ──constrains──→ Axis(role)
Constraint(CON-002) ──constrains──→ Prefix(cart_event)
```

용도: **변경 전 안전 검사.** 축/prefix 변경 시 관련 constraint를 확인.

### 운영 역방향 (2종)

qa-sdk 운영에서 DKG로 돌아오는 피드백 방향.

#### `observes` — Observation → Axis | Prefix

운영 중 이 구조에 대해 발견했다.

```
Observation(OBS-001) ──observes──→ Axis(rbac_role)
Observation(OBS-001) ──observes──→ Axis(role)
Observation(OBS-002) ──observes──→ Prefix(permission)
```

#### `prompts` — Observation → Decision

이 관찰이 새로운 결정을 유발했다.

```
Observation(OBS-001) ──prompts──→ Decision(DEC-005)
```

### 진화 추적 (2종)

시간에 따른 변화를 추적하는 엣지.

#### `evolves-from` — VersionEvent → VersionEvent

버전 계보. 이전 전환에서 이 전환이 이어진다.

```
VersionEvent(VE-role-v2-v3) ──evolves-from──→ VersionEvent(VE-role-v1-v2)
VersionEvent(VE-role-v3-v4) ──evolves-from──→ VersionEvent(VE-role-v2-v3)
```

#### `supersedes` — Decision → Decision

이 결정이 이전 결정을 대체한다.

```
Decision(DEC-005) ──supersedes──→ Decision(DEC-003)
```

superseded된 Decision의 lifecycle은 `"superseded"`로 변경.

### 도메인/소비/연결 추적 (4종)

도메인 바운더리, 소비 의도, 연결 의도를 추적하는 엣지.

#### `contains` — Domain → Prefix

이 도메인이 이 prefix를 포함한다.

```
Domain(shopping-domain) ──contains──→ Prefix(permission)
Domain(shopping-domain) ──contains──→ Prefix(event)
Domain(shopping-domain) ──contains──→ Prefix(service)
Domain(tracking-domain) ──contains──→ Prefix(tracking)
Domain(tracking-domain) ──contains──→ Prefix(content)
```

용도: **도메인 단위 영향 분석.** prefix 변경 시 같은 도메인 내 다른 prefix를 즉시 찾는다. Consumer가 도메인 단위로 소비할 때 `Consumer ──consumes──→ Domain ──contains──→ Prefix(*)` 경로로 전체 의존성을 파악한다.

#### `bridges` — Domain → Domain

두 도메인 간 의도적 연결. `via` 속성으로 연결을 매개하는 prefix/axis를 지정한다.

```
Domain(shopping-domain) ──bridges {via: "service"}──→ Domain(event-domain)
  # shopping의 service prefix를 event-domain의 order_event가 참조
```

용도: **도메인 간 경계 추적.** 한 도메인의 변경이 다른 도메인에 전파되는 경로를 파악한다.

#### `consumes` — Consumer → Prefix | Domain

이 소비자가 이 prefix 또는 도메인을 **사용하도록 설계**되었다.

```
Consumer(auth-service) ──consumes──→ Domain(shopping-domain)
Consumer(platform-demo) ──consumes──→ Prefix(rbac)   # 도메인 밖 개별 prefix도 가능
```

용도: **설계 시점 영향 분석.** 도메인/prefix 변경 시 영향받는 소비자를 파악한다. 실제 런타임 호환성과 마이그레이션은 qa-sdk가 수행한다.

#### `binds` — IntentLink → Prefix | Axis | Consumer | Domain

이 연결 의도가 이 구조를 엮는다.

```
IntentLink(IL-001) ──binds──→ Prefix(permission)
IntentLink(IL-001) ──binds──→ Prefix(event)
IntentLink(IL-001) ──binds──→ Prefix(service)        # 매개체

IntentLink(IL-002) ──binds──→ Consumer(auth-service)
IntentLink(IL-002) ──binds──→ Consumer(payment-service)
IntentLink(IL-002) ──binds──→ Domain(shopping-domain) # 도메인 단위 연결도 가능
```

용도: **연결 안정성 검사.** 변경 시 `←binds── IntentLink(*)` 역순회로 의도적 연결 파괴 여부를 확인한다.

### 엣지 요약

```
설계 순방향 (5종):
  Prefix ──composes──→ Axis              축 사용
  Prefix ──references──→ Prefix           주소 공간 참조
  Spec ──governs──→ Axis | Prefix        설계 근거
  Decision ──justifies──→ Axis | Prefix | VersionEvent  정당화
  Constraint ──constrains──→ Axis | Prefix               제약

spec-engine 승계 (5종):
  Spec ──satisfies──→ Spec
  Spec ──implements──→ Spec
  Spec ──tests──→ Spec
  Spec ──traces-to──→ Spec
  Spec ──depends-on──→ Spec

도메인/소비/연결 추적 (4종):
  Domain ──contains──→ Prefix                              도메인 포함
  Domain ──bridges {via}──→ Domain                         도메인 간 연결
  Consumer ──consumes──→ Prefix | Domain                   설계된 소비 관계
  IntentLink ──binds──→ Prefix | Axis | Consumer | Domain  연결 의도

운영 역방향 (2종):
  Observation ──observes──→ Axis | Prefix   운영 발견
  Observation ──prompts──→ Decision          결정 유발

진화 추적 (2종):
  VersionEvent ──evolves-from──→ VersionEvent   버전 계보
  Decision ──supersedes──→ Decision              결정 대체
```

총 **18종**. 모든 엣지는 방향이 있다.

---

## 설계 시점 질의 (Design-time Queries)

DKG가 답해야 하는 질문들.

### 영향 분석

| 질의 | 순회 경로 |
|---|---|
| "role 축을 바꾸면 어떤 prefix가 영향받나?" | `Axis(role) ←composes── Prefix(*)` |
| "service prefix를 바꾸면 어떤 prefix가 참조로 영향받나?" | `Prefix(service) ←references── Prefix(*)` |
| "role 축의 cascade: prefix → 그 prefix를 참조하는 prefix까지" | `Axis(role) ←composes── Prefix(P) ←references── Prefix(*)` |

#### 예시: role 축 변경 영향

```
Axis(role)
  ←composes── Prefix(permission)     직접 영향
  ←composes── Prefix(rbac)           직접 영향

Prefix(permission)
  ←references── (없음)               참조하는 prefix 없음

결과: role 변경 시 permission, rbac 2개 prefix가 직접 영향
```

### Closure Provenance

| 질의 | 순회 경로 |
|---|---|
| "이 capacity가 8인 이유는?" | `Axis(role) ←justifies── Decision(*)` |
| "permission prefix가 존재하는 근거는?" | `Prefix(permission) ←governs── Spec(*) ←satisfies── Spec(*)` |
| "이 결정의 맥락은? 대안은?" | `Decision(DEC-001).context, .alternatives` |
| "이 결정이 아직 유효한지?" | `Decision(DEC-001).reversalConditions` 검토 |

### 운영 피드백 추적

| 질의 | 순회 경로 |
|---|---|
| "이 축에 대한 운영 관찰이 있나?" | `Axis(role) ←observes── Observation(*)` |
| "미처리 관찰은?" | `Observation(*) WHERE resolution IS NULL` |
| "이 관찰이 어떤 결정으로 이어졌나?" | `Observation(OBS-001) ──prompts──→ Decision(*)` |

### 진화 추적

| 질의 | 순회 경로 |
|---|---|
| "role 축의 버전 계보는?" | `VersionEvent(VE-role-*) ──evolves-from──→ *` 체인 |
| "이 버전 전환이 어떤 결정에 의한 것인가?" | `VersionEvent(VE-role-v3-v4) ←justifies── Decision(*)` |
| "이 결정은 어떤 이전 결정을 대체했나?" | `Decision(DEC-005) ──supersedes──→ Decision(DEC-003)` |

### 도메인 단위 분석

| 질의 | 순회 경로 |
|---|---|
| "permission이 속한 도메인은?" | `Prefix(permission) ←contains── Domain(*)` |
| "이 도메인의 모든 prefix는?" | `Domain(shopping) ──contains──→ Prefix(*)` |
| "이 도메인과 연결된 다른 도메인은?" | `Domain(shopping) ──bridges──→ Domain(*), Domain(*) ──bridges──→ Domain(shopping)` |
| "이 도메인의 외부 노출 prefix는?" | `Domain(shopping).boundary.exports` |
| "shopping 도메인 변경의 전체 영향은?" | `Domain(shopping) ──contains──→ Prefix(*) ──composes──→ Axis(*)` + `Domain(shopping) ←consumes── Consumer(*)` |

### 소비자 영향 분석

| 질의 | 순회 경로 |
|---|---|
| "이 prefix를 쓰도록 설계된 서비스는?" | `Prefix(permission) ←consumes── Consumer(*)` |
| "role 축 변경의 전체 cascade는?" | `Axis(role) ←composes── Prefix(*) ←consumes── Consumer(*)` |
| "auth-service에 영향 주는 축은?" | `Consumer(auth) ──consumes──→ Prefix(*) ──composes──→ Axis(*)` |

### 연결 안정성 검사

| 질의 | 순회 경로 |
|---|---|
| "이 prefix를 바꾸면 깨지는 의도적 연결은?" | `Prefix(permission) ←binds── IntentLink(*)` |
| "auth-service와 payment-service를 연결하는 의도는?" | `Consumer(auth) ←binds── IntentLink(*) ──binds──→ Consumer(payment)` |
| "이 IntentLink의 invariant는 아직 유효한가?" | `IntentLink(IL-001).invariant` 검토 |

### Constraint 검사

| 질의 | 순회 경로 |
|---|---|
| "이 축을 변경하면 깨지는 constraint는?" | `Axis(role) ←constrains── Constraint(*)` |
| "이 constraint가 아직 유효한가?" | `Constraint(CON-001).lifecycle` |
| "활성 constraint 전체 목록" | `Constraint(*) WHERE lifecycle = "active"` |

---

## DEMO_CATALOG에서의 초기 그래프 파생

DKG의 초기 상태는 DEMO_CATALOG에서 자동 파생된다. composes와 references 엣지는 카탈로그 구조에서 결정론적으로 추출 가능하다.

### 파생 규칙

```typescript
// DEMO_CATALOG에서 Axis 노드 추출
for (const [id, axis] of Object.entries(catalog.axes)) {
  addNode({ kind: "axis", id, name: axis.name });
}

// DEMO_CATALOG에서 Prefix 노드 + composes/references 엣지 추출
for (const [id, prefix] of Object.entries(catalog.prefixes)) {
  addNode({ kind: "prefix", id, name: prefix.name, dimLabels: prefix.labels });

  for (const [label, dimRef] of Object.entries(prefix.dims)) {
    if (dimRef.kind === "axis") {
      addEdge("composes", id, dimRef.axisId, { dimKind: "axis", label });
    }
    if (dimRef.kind === "prefix_ref") {
      addEdge("references", id, dimRef.prefixId, { label });
      addEdge("composes", id, dimRef.prefixId, { dimKind: "prefix_ref", label });
    }
    if (dimRef.kind === "table_ref") {
      addEdge("composes", id, dimRef.table, { dimKind: "table_ref", label });
    }
  }
}
```

### 초기 그래프 시각화 (DEMO_CATALOG 기준)

```
Axis(env) ←── Prefix(service)
Axis(region) ←── Prefix(service)
Axis(svc_name) ←── Prefix(service)
Axis(namespace) ←── Prefix(service)

Axis(role) ←── Prefix(permission) ──ref──→ Prefix(service)
Axis(role) ←── Prefix(rbac)

Axis(event_name) ←── Prefix(event) ──ref──→ Prefix(service)
Axis(initiator) ←── Prefix(event)

Axis(cart_action) ←── Prefix(cart_event)
Axis(auth_action) ←── Prefix(auth_event)
Axis(order_action) ←── Prefix(order_event) ──ref──→ Prefix(service)

Axis(subjectKind) ←── Prefix(relational)
Axis(predicate) ←── Prefix(relational)
Axis(objectKind) ←── Prefix(relational)
```

Decision, VersionEvent, Constraint, Observation은 수동 등록. 기존 카탈로그에는 이 정보가 암묵적으로만 존재하므로, 점진적으로 기록해 나간다.

---

## 저장 형식

### 원칙

- DKG는 설계 시점 도구다. 런타임 성능이 아니라 **가독성과 VCS 추적성**이 우선이다.
- 노드와 엣지는 YAML 파일로 저장하여 git 이력으로 변경을 추적한다.
- 복잡한 그래프 DB는 사용하지 않는다. 파일 기반 + 빌드 시점 인덱싱으로 충분하다.

### 디렉토리 구조

```
docs/dkg/
  nodes/
    axes/           ← DEMO_CATALOG에서 자동 파생 (빌드 산출물)
    prefixes/       ← DEMO_CATALOG에서 자동 파생 (빌드 산출물)
    domains/        ← 수동 작성 (prefix 그룹 바운더리)
      shopping-domain.yaml
      tracking-domain.yaml
    consumers/      ← 수동 작성 (설계된 소비자)
      auth-service.yaml
      payment-service.yaml
    intent-links/   ← 수동 작성 (연결 의도)
      IL-001.yaml
    decisions/      ← 수동 작성
      DEC-001.yaml
      DEC-002.yaml
    version-events/ ← 수동 작성 (버전 전환 시)
      VE-role-v3-v4.yaml
    constraints/    ← 수동 작성
      CON-001.yaml
    observations/   ← 수동 작성 (운영 중 발견 시)
      OBS-001.yaml
  edges/
    composes.yaml      ← DEMO_CATALOG에서 자동 파생
    references.yaml    ← DEMO_CATALOG에서 자동 파생
    contains.yaml      ← 수동 작성 (Domain → Prefix)
    bridges.yaml       ← 수동 작성 (Domain → Domain)
    consumes.yaml      ← 수동 작성 (Consumer → Prefix | Domain)
    binds.yaml         ← 수동 작성 (IntentLink → Prefix | Axis | Consumer | Domain)
    governs.yaml       ← 수동 작성
    justifies.yaml     ← 수동 작성
    constrains.yaml    ← 수동 작성
    observes.yaml      ← 수동 작성
    prompts.yaml       ← 수동 작성
    supersedes.yaml    ← 수동 작성
    evolves-from.yaml  ← 수동 작성
    spec-relations.yaml ← spec-engine SpecRelation 승계
  index.yaml           ← 전체 노드/엣지 인덱스 (빌드 시 자동 생성)
```

### 노드 파일 형식 예시

```yaml
# docs/dkg/nodes/decisions/DEC-001.yaml
kind: decision
id: DEC-001
date: "2026-03-15"
title: "role axis capacity를 8로 설정"
context: |
  v1~v3에서 5→6→6으로 증가. 현재 7개 사용 중 (auditor 추가 예정).
  bitmask 연산에서 2의 거듭제곱이 유리.
rationale: |
  8 = 2^3. bitmask 정렬 최적.
  1 슬롯 여유로 즉시 추가 가능.
  16은 과도한 headroom.
alternatives:
  - "16 — 과도한 headroom. Uint8 1바이트에 맞지만 사용률 50% 미만 예상"
  - "7 — 여유 없음. 다음 추가 시 즉시 stride-break"
reversalConditions:
  - "8개 역할이 모두 사용되고 9번째가 필요할 때"
  - "bitmask 정렬보다 주소 밀도가 더 중요해질 때"
lifecycle: active
```

### 엣지 파일 형식 예시

```yaml
# docs/dkg/edges/justifies.yaml
edges:
  - from: DEC-001
    to: role
    note: "capacity=8 결정"

  - from: DEC-001
    to: VE-role-v3-v4
    note: "이 결정이 v4 전환의 근거"

  - from: DEC-002
    to: permission
    note: "perm_svc × role 2차원 구성 결정"
```

### 자동 파생 vs 수동 작성

| 구분 | 출처 | 파생 방식 |
|---|---|---|
| Axis 노드 | DEMO_CATALOG.axes | 빌드 시 자동 추출 |
| Prefix 노드 | DEMO_CATALOG.prefixes | 빌드 시 자동 추출 |
| composes 엣지 | DEMO_CATALOG.prefixes.dims | 빌드 시 자동 추출 |
| references 엣지 | DEMO_CATALOG prefix_ref | 빌드 시 자동 추출 |
| Spec 노드 | spec-engine SpecDocument | spec 파일 로드 시 |
| Schema 노드 | spec-engine SchemaDef | spec 파일 로드 시 |
| spec-relations 엣지 | spec-engine SpecRelation | spec 파일 로드 시 |
| **Domain 노드** | 수동 | 도메인/바운더리 설계 시 작성 |
| **Consumer 노드** | 수동 | 서비스 설계 시 작성 |
| **IntentLink 노드** | 수동 | 연결 설계 시 작성 |
| **Decision 노드** | 수동 | 설계 결정 시 작성 |
| **VersionEvent 노드** | 수동 | 버전 전환 시 작성 |
| **Constraint 노드** | 수동 | 규칙 발견/합의 시 작성 |
| **Observation 노드** | 수동 | 운영 중 발견 시 작성 |
| contains, bridges, consumes, binds, governs, justifies, constrains, observes, prompts, supersedes, evolves-from | 수동 | 해당 노드 작성 시 함께 |

---

## spec-engine 통합

### Phase 배치

DKG는 spec-engine의 기존 phase 구조에 다음과 같이 합류한다:

```
Phase 1: spec-core 기반 (✅ 1-1 완료, ○ 1-2, 1-3 진행 중)
  ├── 기존: 타입 + 레지스트리 + 검증기
  ├── 기존: DEMO_CATALOG 브릿지
  └── 기존: spec 파일 로더

Phase 2: 소비 경로
  ├── 기존: CLI 통합
  └── 기존: spec-server (NestJS)

Phase 3: 좌표계 시나리오 검증
  └── 기존: end-to-end 증명

Phase 3.5: DKG 기반 (신규)              ← 여기
  ├── 3.5-1: DKG 코어 타입 (spec-core 내)
  │     노드 12종 + 엣지 18종 타입
  │     GraphRegistry (노드/엣지 등록 + 질의)
  │
  ├── 3.5-2: DEMO_CATALOG → DKG 자동 파생
  │     Axis/Prefix 노드 추출
  │     composes/references 엣지 추출
  │
  ├── 3.5-3: YAML 로더 + 인덱스 빌더
  │     수동 작성 노드/엣지 로딩
  │     전체 그래프 인덱스 생성
  │
  └── 3.5-4: 질의 API
        영향 분석: impactOf(axisId) → Prefix[]
        provenance: whyExists(nodeId) → Decision[]
        미처리 관찰: pendingObservations() → Observation[]

Phase 4: 관측 계층 (기존, 선택적)
Phase 5: 확장 (기존, 선택적)
```

### spec-core 내 DKG 위치

```
packages/spec-core/
  src/
    dkg/                               ← DKG 코어 (순수 TS)
      dkg.types.ts                     ← 노드 12종 + 엣지 18종 타입
      graph-registry.ts                ← 노드/엣지 등록 + 질의
      catalog-derive.ts                ← DEMO_CATALOG → 자동 파생
      yaml-loader.ts                   ← YAML 파일 → 그래프 적재
      queries/
        impact-analysis.ts             ← 영향 분석 질의
        provenance.ts                  ← closure provenance 질의
        observation-tracker.ts         ← 관찰 추적 질의
```

### CLI 연동

```
qa dkg impact role              → role 변경 시 영향받는 prefix 목록
qa dkg why permission           → permission prefix 존재 근거 추적
qa dkg pending                  → 미처리 Observation 목록
qa dkg history role             → role 축의 VersionEvent 계보
qa dkg constraints role         → role 관련 활성 Constraint 목록
qa dkg validate                 → 전체 Constraint 위반 검사
```

---

## 불변식

1. **Decision은 삭제되지 않는다.** lifecycle이 `superseded`로 전환될 뿐. 과거 결정의 추적성은 영구 보존.
2. **Observation의 resolution은 append-only.** 한번 처리된 관찰의 resolution을 수정하지 않는다. 재검토가 필요하면 새 Observation을 만든다.
3. **자동 파생 노드/엣지는 DEMO_CATALOG과 일치해야 한다.** 수동 수정 금지. 카탈로그 변경 시 자동 재파생.
4. **supersedes 엣지의 from은 반드시 to보다 나중에 만들어진 Decision이다.** 시간 역전 금지.
5. **prompts 엣지의 from(Observation)은 반드시 to(Decision)보다 먼저 만들어진다.** 관찰이 결정을 유발하는 것이지 역방향 아님.
6. **Constraint.lifecycle이 active인 규칙만 검증 대상이다.** suspended/retired는 정보 보존용.
7. **역방향 의존 금지.** Indexing Layer → DKG 방향의 import/의존 금지.
8. **런타임 상태는 DKG에 저장하지 않는다.** 현재 배포 버전, 마이그레이션 진행도, 런타임 호환성 상태는 qa-sdk가 관리한다. DKG는 설계 의도만 보존한다.
9. **IntentLink.invariant가 정의되면, 해당 연결을 깨뜨리는 변경은 DKG 질의로 사전 감지되어야 한다.** 감지 여부는 DKG 책임, 강제 여부는 qa-sdk 책임.
10. **Domain.boundary.exports에 명시된 prefix만 도메인 외부에서 직접 참조할 수 있다.** internal prefix는 같은 도메인 내 prefix를 통해서만 간접 접근.

---

## 재귀적 적절성 — 메타 구조

### DKG 자체의 진화를 어떻게 추적하는가

DKG의 노드/엣지 타입은 TypeScript interface로 **고정**한다. DKG 자체의 진화(노드 타입 추가, 엣지 의미 변경)는 DKG가 직접 추적하지 않고, **Spec 체계가 DKG의 메타 레이어 역할**을 한다.

```
Spec (DKG의 설계 근거)
  ↓ governs
DKG (좌표 시스템의 설계 근거)
  ↓ 설계 의도 제공
좌표 시스템 (닫힌 세계)
  ↓ 경계 정의 + 연결
qa-sdk (운영 + 트래커)
```

각 레이어가 한 단계 아래를 기술하고, 위에서 내려다보는 적층 구조. 자기 참조적 순환이 아니다.

### Spec이 DKG를 기술하는 방식

```yaml
# DKG 초기 설계
FEAT-DKG-001:
  type: feat
  title: "Design Knowledge Graph 초기 설계"
  lifecycle: active
  rationale: "좌표 시스템의 성장 나선에서 설계 결정의 추적성 부여"
  relations:
    - { from: FEAT-DKG-001, to: REQ-DKG-001, type: satisfies }

# Consumer/IntentLink/Domain 추가
FEAT-DKG-002:
  type: feat
  title: "소비자·연결 의도·도메인 바운더리 추가"
  lifecycle: active
  rationale: |
    내부 구조만 추적하면 외부 소비자 영향 분석과
    도메인 경계 추적이 불가.
    qa-sdk가 런타임에서 수행하는 경계 연결의
    설계 의도를 DKG에서 보존하기 위함.
  relations:
    - { from: FEAT-DKG-002, to: REQ-DKG-002, type: satisfies }
    - { from: FEAT-DKG-002, to: FEAT-DKG-001, type: depends-on }

# 런타임 상태 분리 결정
ADR-DKG-001:
  type: adr
  title: "런타임 상태는 DKG에 넣지 않는다"
  lifecycle: active
  rationale: "런타임 추적은 qa-sdk 역할. DKG는 설계 의도만."
  reversalConditions:
    - "qa-sdk의 런타임 추적이 설계 의도와 괴리되어 DKG에서 런타임 정합성을 직접 검증해야 할 때"
```

### 스케일별 재귀 커버리지

| 스케일 | 추적 주체 | 방식 |
|---|---|---|
| entry 단위 (axis 내부) | VersionEvent + Decision | entry 추가/비활성화를 VersionEvent.changes로 기록 |
| prefix 단위 | DKG 전체 | composes, references, justifies 등 |
| **domain 단위 (prefix 그룹)** | **Domain 노드** | contains, bridges, boundary 정의 |
| consumer 단위 | Consumer 노드 | consumes, IntentLink.binds |
| DKG 자체 | Spec 체계 | FEAT-DKG-*, ADR-DKG-* |

### 자기 기술 가능성 (유보)

DKG의 노드/엣지 타입을 좌표 시스템의 축으로 등록하여 DKG가 자기 자신을 기술하는 것은 **이론적으로 가능하다** (`dkg_node_kind` axis, `dkg_edge_kind` axis). 이것은 좌표 시스템의 범용성을 증명하는 가치가 있지만, 실용적 이득 대비 형식적 부담이 크다. 별도 증명/데모로 유보하고, DKG의 실용적 구조에는 적용하지 않는다.
