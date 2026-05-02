---
def:
  id: composition-hierarchy
  tier: component
  scope: data
  aspect: domain_data
  depth: overview
  lifecycle: draft
  layer: domain
  tags: [entry-point, cross-scope, structural]
  links:
    - target: system-concepts
      type: depends_on
    - target: architecture-revealing-code-convention
      type: traces_to
    - target: service-definition-standard
      type: traces_to
    - target: coord-foundation
      type: depends_on
    - target: dsl-bundle-spec
      type: depends_on
---

# 조립 계층 원칙 — E/C/I/S + L/P

## 목적 ^purpose

이 시스템의 개념 계층(Entry, Component, Interface/DSL, System, Layout/Pack)과 좌표 표현 수단(Axis, Prefix)이 어떻게 분리되어 적용되는지를 정의한다. 각 계층의 상세는 전문 문서로 위임하고, 이 문서는 연결 고리 역할만 한다.

---

## 1. 개념 계층 ^defines

이 시스템의 구성 단위는 네 책임 평면으로 이루어진다.

```
Entry / Identity
  ↓
Component / Axis vocabulary
  ↓
Interface / DSL Bundle = Taxonomy
  ↓
System
  ↓
Layout / Pack
```

### Entry

유한한 값 집합. 시스템이 인식하고 추적하는 가장 작은 데이터 단위.

- 값의 수가 설계 시점에 상한이 결정된다
- 독립 주소가 필요하면 Prefix가 부여된다
- 상세: [system-concepts.spec.md](system-concepts.spec.md)

### Component

Entry들이 공통 데이터 경계를 형성하면 Component가 된다. Component는 Axis, schema, state enum, evidence shape처럼 수동 참조되는 데이터 vocabulary를 소유한다.

### Interface / DSL Bundle = Taxonomy

Component들이 소비 가능한 문법을 형성하면 DSL Bundle이자 Taxonomy가 된다. 두 이름은 같은 단위를 다른 관점에서 부른 것이다.

| 관점 | 이름 | 강조점 |
|------|------|--------|
| 구현/사용 | DSL Bundle | 공통 서비스 바인딩 + 사용 패턴 + 불변조건 |
| 개념/도메인 | Taxonomy | 이름 붙일 수 있는 도메인 경계 |

둘은 동일 단위다. 관점에 따라 이름이 달라질 뿐이다.

상세: [dsl-bundle.md](../indexing-core-system/dsl-bundle.md) · [meta-taxonomy.spec.md](meta-taxonomy.spec.md)

### System

Interface / DSL Bundle / Taxonomy가 독립 운용과 behavior ownership을 갖추면 System이 된다. System은 변환, 검증, 저장, 배포, projector/writer 같은 runtime 책임을 소유한다.

### Layout / Pack

여러 System 또는 Interface 문법 조각을 조망/배치/배포 묶음으로 조직하면 Layout 또는 Pack이 된다. Layout은 `tier: layout`로 표현하고, Pack은 배포/문서 묶음 이름으로서 layout-like 조직 평면을 뜻한다. 둘 다 세부 behavior/data ownership을 직접 갖지 않는다.

---

## 1.5 행동과 이벤트의 위치

| 대상 | 위치 | 설명 |
|------|------|------|
| operation | Interface / DSL | System의 public 소비 표면 |
| behavior | BDD contract + System | operation/event input에 대한 결정론적 결과 |
| event | Event vocabulary / mapping pack | 발생하거나 관측된 fact key |
| state/data | Component | behavior가 읽고 쓰는 shape |
| id/value | Entry / Identity | 안정 식별자와 유한 값 |

행동을 event로 정의하지 않는다. Event는 behavior 중 발생하거나 관측되는 fact이고, behavior 자체는 BDD contract가 정의한다.

- 최소 단위: 하나의 완전한 DSL Bundle 또는 Taxonomy
- 여러 Taxonomy를 포함할 수 있다
- 서비스(포트, 저장소, API)를 가질 수 있다

---

## 2. 좌표 표현 원칙 ^defines

**Axis와 Prefix는 계층이 아닌 표현 수단이다.**

개념 계층의 각 단위에 Prefix가 부여되면 `Prefix:Axis` 형태로 주소를 갖게 된다.

```
Entry    --[Prefix 부여]--> Prefix:Axis 로 식별
Taxonomy --[Prefix 부여]--> Prefix:Axis 로 식별
```

### Axis = 1D 좌표 표현

하나의 차원으로 구성된 좌표 공간. position이 곧 entry 식별자.

```
Axis "role": [admin, developer, viewer, guest]
  → position 0 = admin
  → position 1 = developer
  → position 2 = viewer
  → position 3 = guest
```

코드 증거 (`packages/index-meta/src/entry-metadata-store.ts`):
```
1D prefix: position이 그대로 키.
```

### Prefix = nD 좌표 표현

여러 Axis를 조합한 곱 공간. mixed-radix로 N차원 좌표를 1D 정수로 압축.

```
Prefix "rbac" = role(4) × action(8) × resource(16)
  → 총 512개 주소
  → address = role_pos × 128 + action_pos × 16 + resource_pos
```

Axis와 Prefix는 동형이다. Axis = Prefix의 1차원 특수 케이스.

상세: [coord-foundation/](../indexing-core-system/coord-foundation/) · [dual-coordinate-system.spec.md](dual-coordinate-system.spec.md)

---

## 3. 판단 기준 ^method

### Entry 판단

다음 조건을 만족하면 Entry로 정의한다.

- [ ] 값의 종류가 유한하고 설계 시점에 열거 가능한가?
- [ ] 같은 값이 여러 Taxonomy에서 공유되는가? (→ 독립 Axis 후보)
- [ ] 단독으로 주소가 필요한가? (→ 독립 Prefix 부여 대상)

### Taxonomy 판단

Entry 집합이 다음 조건을 만족하면 Taxonomy(= DSL Bundle)로 확정한다.

- [ ] 공통 서비스 컨텍스트에서 함께 사용되는가?
- [ ] 불변조건(예: "A 없이 B가 관측되면 안 됨")을 공유하는가?
- [ ] 도메인 이름을 붙일 수 있는가? (예: "결제 흐름", "권한 제어")
- [ ] 경계 밖의 단위와 명확히 구분되는가?

하나라도 미충족이면 DSL Bundle 후보로 보관하고 Taxonomy 확정을 보류한다.

### System 판단

Taxonomy가 다음 조건을 만족하면 System으로 취급한다.

- [ ] 독립적으로 운용(배포, 재시작, 스케일) 가능한가?
- [ ] 자체 데이터 저장소 또는 상태 관리가 있는가?
- [ ] 다른 System과 명시적 인터페이스(API, 이벤트)로만 통신하는가?

단일 Taxonomy가 조건을 충족하지 못하면 상위 System에 포함되거나 Taxonomy 수준에 머문다.

---

## 4. 위임 테이블

| 개념 | 상세 문서 |
|------|---------|
| Entry 정의, 이벤트, 좌표 기초 | [system-concepts.spec.md](system-concepts.spec.md) |
| Axis/Prefix 수학 (mixed-radix, capacity, stride) | [coord-foundation/](../indexing-core-system/coord-foundation/) |
| DSL Bundle 구현 (4개 번들, 멤버 역할, 불변조건) | [dsl-bundle.md](../indexing-core-system/dsl-bundle.md) |
| Taxonomy 분류군 (topological / functional / bridge) | [meta-taxonomy.spec.md](meta-taxonomy.spec.md) |
| 두 좌표 시스템 동형성 (이벤트 ↔ 문서) | [dual-coordinate-system.spec.md](dual-coordinate-system.spec.md) |
| 서비스 정의 표준 구조 | [service-definition-standard.rule.md](service-definition-standard.rule.md) |
