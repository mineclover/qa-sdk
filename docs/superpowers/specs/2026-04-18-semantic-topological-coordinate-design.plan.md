---
def:
  id: semantic-topological-coordinate-plan
  level: leaf
  scope: data
  aspect: domain_data
  depth: overview
  lifecycle: draft
  layer: domain
  tags: [entry-point, structural, cross-scope]
---

# Semantic Topological Coordinate System — 설계 방향

## 목적 ^purpose

문서와 시스템을 중복 없이 좌표로 표현하기 위한 5-tier 위상 좌표계를 정의한다.
기존 `level(group/module/leaf)` 체계를 ECS 원칙 기반의 `tier` 체계로 전환하고,
Layout을 System 소비 + 생성의 컨텍스트로 분리한다.

---

## 1. 핵심 원칙 ^defines

### 1.1 데이터는 여러 System에 공유된다

Entry/Component는 여러 System이 의존한다.
이 공유 의존성 때문에 Axis를 고정하고 버전 관리한다 — Axis가 흔들리면 모든 의존 System이 무효화된다.

### 1.2 System은 독립적이다

System은 다른 System에 포함(contains)되지 않는다.
System 간 관계는 소비(`depends_on`) / 구체화(`refines`) / 구현(`implements`)으로만 표현한다.

### 1.3 Layout은 생성적 소비 컨텍스트다

Layout은 수동적 뷰가 아니다.
Layout 안에서 System을 소비하고, 새 Entry/Component를 정의하고, 새 System이 생성될 수 있다.
이 재귀가 깊이 제한 없는 계층을 만든다.

---

## 2. 5-Tier 체계 ^defines

```
Component  →  Entry  →  FSM  →  System  →  Layout
  (데이터)    (투영)    (전이)    (기능)    (배치+생성)
```

### Component
데이터 정의. 속성, 스키마, shape.
여러 System이 공유하므로 변경이 어려워야 한다.

```
예: LabelRecord { id, state, ontologyPackId, ... }
예: EventRecord { prefix, coord, timestamp, ... }
```

### Entry
Component에서 투영(projection)되는 구체화 단위.
실제 인스턴스, DB 레코드, 렌더링 단위.

```
예: 특정 label의 DRAFT 상태 인스턴스
예: 특정 이벤트의 coord 주소
```

### FSM
Entry의 생명주기 — 어떤 상태를 거치고 어떤 전이가 유효한지 정의.
System이 가진 기능이 데이터를 어떻게 이동시키는지의 계약.

```
예: DeterministicLabelRecord: DRAFT → LINTED → RESOLVED → ACTIVE
예: GateState: PENDING → PASSING | FAILING → BLOCKED
```

### System
기능의 집합. Entry CRUD + 다른 System 소비.
독립 운용 가능한 단위. 명시적 인터페이스(API, 이벤트)를 가진다.

```
예: deterministic-label-system
  - buildDeterministicLabelInventory()    ← 조회
  - dryRunDeterministicLabelTransition()  ← 전이 검증
  - depends_on: ontology-pack-system, fsm-system
```

### Layout
System을 도메인/서비스/목적에 맞게 배치하는 소비 컨텍스트.
System을 참조(ref)하며, 내부에서 새 Entry/Component/System을 정의할 수 있다.

```
예: QA-SDK Services Layout
  refs: ingest-system, decode-system, gate-system, registry-system

예: Definition Catalog Layout
  refs: deterministic-label-system, ontology-pack-system
  defines: new Entry (HarnessInstance)
```

---

## 3. 좌표 공식 ^defines

```
doc_coordinate = tier × scope × layer
```

| 차원 | 값 | 역할 |
|------|----|------|
| `tier` | component / entry / fsm / system / layout | 이 문서가 무엇인가 |
| `scope` | data / feature / flow / constraint / interface / state / ui | 어떤 종류의 관심사인가 |
| `layer` | domain / operation / mediation / experience | 왜 존재하는가 |

**중복 감지 규칙**: 같은 `(tier, scope, layer, aspect)` 좌표를 가진 문서가 둘 이상이면 중복 신호.

**깊이 표현**: `contains` 링크 체인이 System 내부 구조를 표현한다. 별도 depth 필드 불필요.

---

## 4. 기존 level → tier 전환 기준 ^method

| 기존 level | 전환 tier | 판단 기준 |
|------------|-----------|----------|
| `leaf` | `component` | 데이터/스키마 정의 |
| `leaf` | `entry` | 구체화 인스턴스 단위 |
| `leaf` | `fsm` | 상태 전이 정의 |
| `module` | `system` | 기능 집합 (CRUD, operations) |
| `module` | `component` | 데이터 집합이지만 기능 없음 |
| `group` | `layout` | 다른 system을 나열/배치 |
| `group` | `system` | 독립 기능 경계 (배치 아닌 기능) |

모호한 경우 판단 질문:
- "이 문서가 CRUD 또는 operation을 정의하는가?" → `system`
- "이 문서가 상태 전이를 정의하는가?" → `fsm`
- "이 문서가 다른 system을 나열/참조하는가?" → `layout`
- "이 문서가 데이터 shape을 정의하는가?" → `component`

---

## 5. System 독립성과 Layout 재귀 ^defines

### System 독립성

```
# 틀린 구조 (System이 System을 contains)
ingest-system
  └─ contains → ingest-api-system   ← X

# 올바른 구조 (System 간 소비)
ingest-api-system
  └─ depends_on: ingest-core-system

# Layout이 System을 나열
ingest-layout
  └─ refs: ingest-api-system, ingest-core-system, ingest-infra-system
```

### Layout 재귀

Layout이 새 System을 생성하면, 그 System은 다시 독립적으로 존재한다.
다른 Layout이 그 System을 소비할 수 있다.

```
Layout[QA-SDK]
  refs: ingest-system, decode-system
  defines: monitoring-entry      ← 새 Entry 정의
  → derives: monitoring-system   ← 새 System 생성

monitoring-system  ← 독립 System으로 존재
  ← Layout[Ops] refs monitoring-system   ← 다른 Layout이 소비
```

---

## 6. 현재 system-root 재해석

현재 `system-root → system-infra → ingest-system` 구조는 **QA-SDK Layout** 문서다.

```
system-root (Layout)
  refs(layout):
    - system-infra-layout      ← 서비스 배치 Layout
    - system-libraries-layout  ← 라이브러리 배치 Layout
    - system-design-tools-layout
    - system-frontend-layout
    - system-support-layout

system-infra-layout (Layout)
  refs: ingest-system, decode-system, gate-system, ...

ingest-system (System, 독립)
  component: EventRecord, TransmissionEnvelope
  fsm: IngestSessionState
  depends_on: registry-system, codec-system
```

---

## 7. 미결 사항

- [ ] `tier` 필드를 def frontmatter에 추가하는 스키마 변경 범위 확정
- [ ] 기존 1,045개 문서의 tier 자동 분류 규칙 및 수동 검토 대상 추출
- [ ] Layout의 `refs` 링크 타입 정의 (`contains`와 구분되는 새 LinkType 필요 여부)
- [ ] FSM tier 문서와 System tier 문서 간의 링크 규칙 정의
- [ ] `level` 필드 deprecated 처리 시점 및 마이그레이션 전략
