---
def:
  id: decision-standard
  scope: constraint
  aspect: biz_constraint
  depth: specification
  lifecycle: approved
  tags: [decision]
---

# 의사결정 표준 프로세스

## 목적 ^purpose

새로운 요구사항이 들어왔을 때,
기존 prefix를 재사용할지 새 prefix를 만들지를 판단하고,
DSL(prefix)을 정의하여 비즈니스 로직의 경우의 수를 제어하는 표준 프로세스.

기반: [README.md](README.md) · [design-knowledge-graph.md](design-knowledge-graph.md) · [dkg-skills.md](dkg-skills.md) · [convergence-layer.md](convergence-layer.md)

---

## 시스템 정체성

이 시스템은 **차원 압축 기반 DSL DB**다.

- enum, 이벤트 유형, 권한 유형 같은 고정 조합을 전문으로 다룬다
- 비즈니스 로직의 경우의 수를 차원 교차로 제어한다
- prefix = 의사결정의 결과 단위 (DSL 하나 = 결정 하나)

**의사결정이 DSL(prefix)을 만든다.** 이 문서는 그 의사결정의 표준 경로를 정의한다.

---

## 두 가지 상황

### 상황 1: 새 기능 요구 — "이것을 추적해야 한다"

```
요구: "사용자 행동을 추적해야 한다"
     "결제 취소 흐름을 관리해야 한다"
     "새로운 권한 유형이 필요하다"
```

### 상황 2: 기존 변경 요구 — "이것을 바꿔야 한다"

```
요구: "역할을 하나 더 추가해야 한다"
     "이 이벤트 유형이 더 이상 필요없다"
     "두 서비스의 권한 체계를 통합해야 한다"
```

---

## 표준 프로세스

### Step 1. 분기 식별 — 무엇의 경우의 수인가

```
요구사항에서 차원을 추출한다:

"사용자 행동을 추적" → 차원: 행위(click/view/scroll), 페이지, 사용자유형
"결제 취소 흐름"     → 차원: 주문행위(cancel/refund), 서비스 컨텍스트
"새 권한 유형"       → 차원: 역할, 액션, 리소스 (이미 있는 것과 같은가?)

질문: 이 차원들의 교차가 새로운 의사결정 단위인가?
```

### Step 2. 기존 평가 — 이미 있는 prefix로 충분한가

```
checkExisting(요구사항의 차원들):

  1. 기존 축에서 같은 entries를 찾는다
     → scanAxisOverlaps로 중복 확인
     → "admin"이 이미 role에 있다 → 새 축 불필요

  2. 기존 prefix에서 같은 차원 조합을 찾는다
     → comparePrefixes로 유사도 확인
     → permission이 이미 role × action을 다룬다

  3. 판정:
     a. 기존 prefix가 완전히 커버 → 재사용 (entry 추가만)
     b. 기존 prefix가 부분 커버  → 확장 vs 분리 결정 필요
     c. 기존에 없는 차원 조합    → 새 prefix 필요
```

### Step 3. 결정 — 재사용 / 확장 / 신규

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  기존 커버?    ──YES──→  entry 추가                          │
│     │                    (기존 축에 append)                  │
│     NO                   → 문자열 고정, position 자동 부여    │
│     │                    → capacity 내면 stride 불변         │
│     ▼                                                       │
│  부분 커버?   ──YES──→  결정: 확장 vs 분리                    │
│     │                                                       │
│     │              확장: 기존 prefix에 차원 추가              │
│     │              → ⚠ 이건 기존 prefix의 정체를 바꾸는 것    │
│     │              → 보통 잘못된 선택                         │
│     │                                                       │
│     │              분리: 새 prefix 생성                      │
│     │              → ✓ 기존은 그대로, 새 의사결정 단위 생성   │
│     │              → prefix_ref로 기존과 연결 가능            │
│     │                                                       │
│     NO                                                      │
│     │                                                       │
│     ▼                                                       │
│  새 prefix 생성                                              │
│  → 새 축 정의 (entries + capacity)                           │
│  → 차원 교차 결정 (어떤 축을 조합하는가)                       │
│  → Domain 배치 (어떤 바운더리에 속하는가)                      │
│  → Decision 기록 (왜 이 교차인가)                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Step 4. 정의 — prefix를 구체화한다

```
새 prefix를 만들 때:

  1. 축 정의
     각 차원의 entries를 나열한다
     문자열 식별자를 고정한다 (영원히 바뀌지 않는다)
     capacity를 넉넉하게 잡는다 (optimalCapacity)

  2. prefix 구성
     축들의 교차를 정의한다 (dims)
     어떤 축이 외부에 보이는가 (export surface)
     다른 prefix를 참조하는가 (prefix_ref)
     테이블 인스턴스가 필요한가 (table_ref)

  3. 메타 기록
     Decision: 왜 이 prefix인가, 대안은 무엇이었나
     Domain: 어떤 바운더리에 속하는가
     IntentLink: 다른 prefix와의 연결 의도는 무엇인가
```

### Step 5. 고정 — seal하고 전파한다

```
  publishSpec → draft
  review (analyzeImpact + constraintCheck)
  seal (lock → release)
  activate → 소비자 통지
  codegen → 타입 생성

  문자열 고정, position 고정, prefix 고정.
  이후 바뀌는 것: capacity 내 entry 추가만.
```

---

## 기존 변경 시 프로세스

### entry 추가 (capacity 내)

```
요구: "auditor 역할이 필요하다"

  1. role 축에 "auditor" append → position 자동 부여
  2. capacity 내? → YES → shape 불변, stride 불변
  3. 기존 주소 전부 유효 → 마이그레이션 없음
  4. VersionEvent 기록

  개발자가 할 일: 없음. entry 추가만.
```

### entry 추가 (capacity 초과)

```
요구: capacity가 가득 찬 축에 entry 추가

  1. capacity 확장 Decision
  2. 새 prefix version (shape 변경)
  3. 기존 주소 마이그레이션: decodeToIds(v1) → encodeFromIds(v2)
     → 문자열이 고정이므로 자동 변환
  4. 소비자에게 "v2로 전환" 통지

  개발자가 할 일: resolve()로 자동 마이그레이션. 또는 일괄 배치.
```

### entry 비활성화

```
요구: "이 역할을 더 이상 안 쓴다"

  1. EntryFlagStore에서 비활성화
  2. 좌표 공간에서 제거하지 않음 (position 보존)
  3. 새 인코딩 차단, 기존 디코딩은 가능
  4. VersionEvent 기록

  개발자가 할 일: 없음. 비활성 entry로 encode하면 에러.
```

### prefix 분할

```
요구: "이 prefix가 너무 복잡하다"

  1. SimplificationAdvisor가 split 제안
  2. 새 prefix 2개 생성 (기존 축을 나눠 가짐)
  3. 기존 prefix는 deprecated (비활성화, 삭제 아님)
  4. 기존 주소는 영원히 decode 가능
  5. 새 인코딩은 새 prefix로

  개발자가 할 일: 새 prefix 사용으로 코드 전환.
```

---

## 마이그레이션의 단순함

**문자열이 고정이므로 마이그레이션은 항상 decode → re-encode다.**

```typescript
// 어떤 version에서든:
const ids = codec.decodeToIds(oldAddress);
// → { role: "admin", action: "write" }

// 어떤 version으로든:
const newAddress = codec.encodeFromIds(prefix, ids, newVersion);
// → "admin"은 영원히 "admin"이므로 항상 성공

// migrator 함수 불필요
// 좌표 변환 불필요
// 패턴 추론 불필요
```

유일한 예외: **축이 추가/제거된 prefix** → 이건 새 prefix이므로 마이그레이션이 아니라 전환이다.

---

## 표준 질문 체크리스트

새 요구사항이 올 때마다:

| # | 질문 | 판단 | 행동 |
|---|---|---|---|
| 1 | 이 차원이 기존 축에 있는가? | `scanAxisOverlaps` | YES → 재사용, NO → 새 축 |
| 2 | 이 차원 조합이 기존 prefix에 있는가? | `comparePrefixes` | YES → entry 추가, NO → Step 3 |
| 3 | 기존 prefix를 확장해야 하는가? | "확장 = 정체 변경" 원칙 | 보통 NO → 새 prefix |
| 4 | 어떤 Domain에 속하는가? | `BoundaryRecommender` | 기존 domain 또는 새 domain |
| 5 | 다른 prefix와 연결이 필요한가? | prefix_ref 필요 여부 | YES → IntentLink 기록 |
| 6 | capacity는 충분한가? | `optimalCapacity` | 항상 넉넉하게 |
| 7 | 기존 소비자에게 영향이 있는가? | `analyzeImpact` | 통지 필요 여부 |

이 7개 질문을 순서대로 답하면 의사결정이 완료된다. 각 질문에 대응하는 skill이 이미 구현되어 있다.

---

## skill 매핑

| 프로세스 단계 | 사용하는 skill |
|---|---|
| Step 1. 분기 식별 | (인간 판단) |
| Step 2. 기존 평가 | `scanAxisOverlaps`, `comparePrefixes` |
| Step 3. 결정 | `scaffoldDecision`, `BoundaryRecommender` |
| Step 4. 정의 | `optimalCapacity`, `publishSpec` |
| Step 5. 고정 | `seal`, `activateAndPropagate`, `analyzeImpact` |
| 변경: entry 추가 | `analyzeImpact` (stride-break 여부) |
| 변경: capacity 확장 | `optimalCapacity`, `resolve` (자동 마이그레이션) |
| 변경: 비활성화 | `analyzeImpact`, `versionEventFromDiff` |
| 변경: prefix 분할 | `SimplificationAdvisor`, `scaffoldDecision` |
| 수렴 검토 | `scanAxisOverlaps`, `discoverCausality`, `scanDecisionConflicts` |
