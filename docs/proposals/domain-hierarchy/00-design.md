---
def:
  id: domain-hierarchy-00-design
  type: knowledge
  knowledge_kind: proposal
  lifecycle: review
  owner_system: definition-catalog
  projection_plane: intent
  scope: meta
  aspect: proposal_design
  tier: system
  depth: specification
  links:
    - target: domain-hierarchy-readme
      type: depends_on
status: implemented
date: 2026-04-20
part_of: domain-hierarchy
role: overview
supersedes: -
superseded_by: -
sources:
  - docs/proposals/aspect-evolution-index.md
  - docs/proposals/domain-hierarchy/reviews/2026-04-20-phase0-simulation.md
  - docs/proposals/domain-hierarchy/reviews/2026-04-20-phase0b-q2-resim.md
  - docs/proposals/domain-hierarchy/reviews/2026-04-20-phase0c-owner-heuristic.md
  - docs/proposals/domain-hierarchy/reviews/2026-04-20-phase2-impl.md
  - docs/proposals/domain-hierarchy/reviews/2026-04-20-phase6-impl.md
  - docs/proposals/domain-hierarchy/reviews/2026-04-21-subdoc-rollup-impl.md
  - docs/proposals/domain-hierarchy/reviews/2026-04-21-final-cleanup.md
  - packages/definition-catalog/src/domain-root.ts
  - packages/definition-catalog/src/domain-root.test.ts
  - packages/definition-catalog/src/validate.ts
  - packages/cli/src/commands/def.ts
---

# Domain Hierarchy — 설계 개요

## 목적 ^purpose

서로 다른 도메인에 속한 시스템들이 같은 `(tier, scope, layer, aspect)` 좌표를 공유해 `duplicate-coordinate` 경고가 30건 발생한다. 도메인 축을 신규 스키마 필드로 도입하지 않고 **기존 링크 그래프에서 파생**하여 중복 판정을 정확하게 만들고, 내용상 진짜 중복만 드러낸다.

## 현재 증거 표면 ^evidence

- Phase 0/0b/0c 시뮬레이션과 Phase 2/6 실행 기록은 본 제안의 부모 선택 규칙, validator 적용, CLI listing surface를 고정한다.
- `packages/definition-catalog/src/domain-root.ts`는 현재 알고리즘 SSoT다. 구현은 `refines`/`depends_on` walk, `refines > depends_on` 우선순위, visited/depth guard, component sub-doc rollup을 포함한다.
- `packages/definition-catalog/src/validate.ts`는 duplicate-coordinate 키를 `tier:scope:layer:aspect:domain_root`로 구성하고 proposal/co-location 예외를 적용한다.
- `packages/cli/src/commands/def.ts`와 `packages/cli/src/workflow-smoke.test.ts`가 `def list --domain-root`와 topdown member union을 현재 운영 surface로 검증한다.

## 1. 핵심 원칙 ^defines

### 1.1 시스템 = 도메인

모든 시스템(`tier: system`)은 도메인이다. 별도 `domain` 필드가 필요하지 않다. 도메인 루트는 다른 시스템에 대한 상위 의존 관계를 갖지 않는 시스템이며, 서브시스템은 의존 링크 경로로부터 루트가 결정된다.

### 1.2 관점은 "의존성 관리"다

"독립성 vs 소속성"으로 보는 대신 **의존성 관리** 관점으로 본다. 시스템 A가 시스템 B에 `depends_on` 관계를 선언하는 순간:
- A는 B가 제공하는 **특정 기능**을 기대한다
- 이 기대 내용이 의존성의 **의미론**이 된다
- 링크 타입(`depends_on`, `refines`)은 기대의 **형태**만 표시할 뿐, 기대의 **내용**은 별도 문서/테스트로 정의해야 한다

즉, `depends_on` 링크는 "A→B 의존"이라는 토폴로지 정보만 주고, "A가 B에 기대하는 시나리오"는 `.test.md` / `.cases.md` 문서가 담는다.

### 1.3 기대 시나리오는 테스트로 정의한다

개발 과정에서 구현 품질을 유지하려면:
- 각 의존성마다 **기대 시나리오**를 미리 정의한다
- 이 시나리오는 `.test.md` 또는 `.cases.md` 문서로 명세화되고, 실제 테스트 코드(`*.test.ts`)와 연결된다
- 테스트 통과 = 기대 충족 = 의존성이 약속을 지킴
- 테스트 미통과 = 구현이 기대를 어김 → 공급자 시스템 수정 또는 소비자 쪽 기대 재조정

이는 Design by Contract / Consumer-Driven Contracts 패턴의 변형으로, qa-sdk의 tier/scope/aspect 체계 위에서 돌아간다.

### 1.4 링크 타입은 기대의 형태를 구분한다

`contains`는 금지(패키지 소유 개념은 과도함)되지만, 의존 관계는 맥락에 따라 다르게 표기한다:
- `depends_on` — 런타임/컴파일 타임에 B의 기능을 소비. 기대 시나리오 필수
- `refines` — 특화/구체화 관계. 상위 정의를 더 정밀하게 재서술 (같은 맥락 유지)
- `traces_to` — 직접 의존 아닌 추적 관계. 기대 시나리오 불필요
- `verifies` — 테스트 문서가 대상 스펙을 검증함을 명시 (기대 시나리오 연결점)

### 1.5 도메인은 링크 그래프에서 파생된다

신규 스키마 필드 없이 기존 링크를 사용한다:

```
domain_root(doc):
  current = doc
  while True:
    parents = outgoing(current, ["depends_on", "refines"])
              .filter(t => t.tier == "system" || t.tier == "layout")
    if parents.empty: return current       # self가 루트
    current = select_primary(parents)       # 단일 부모 선택 규칙
```

### 1.6 멘탈 모델 (병렬 비유)

| 분야 | 독립 단위 | 의존 관계 | 기대 검증 |
|------|----------|----------|----------|
| 패키지 관리 | npm 패키지 | `"dependencies"` 필드 | 단위/통합 테스트 |
| 함수형 프로그래밍 | 순수 함수 | 함수 컴포지션 (호출) | 타입 시그니처 + 테스트 |
| ECS 게임 | Component/System | System이 Component 읽고 씀 | 프레임 테스트/리플레이 |
| **qa-sdk** | `tier: system` 문서 | `depends_on` / `refines` | `.test.md` 시나리오 + `*.test.ts` |

세 분야 모두 공통 패턴: **독립 단위를 의존 관계로 조합하며, 기대 충족은 테스트로 검증**. qa-sdk도 같은 구조를 좌표계 위에서 구현한다.

---

## 2. 설계 상세

### 2.1 `domain_root` 파생 로직

```typescript
function deriveDomainRoot(doc: DefDoc, registry: Registry): string {
  const visited = new Set<string>();
  let current = doc;

  while (!visited.has(current.id)) {
    visited.add(current.id);
    const outgoing = registry.getLinks(current.id, "outgoing");
    const candidates = outgoing.filter(l =>
      (l.linkType === "depends_on" || l.linkType === "refines")
      && isDomainTier(registry.get(l.targetId))
    );

    if (candidates.length === 0) return current.id; // self is root

    // Primary parent selection rules:
    // 1. prefer target with no outgoing domain link (higher in hierarchy)
    // 2. prefer depends_on over refines (more canonical)
    // 3. lexicographic (deterministic tiebreak)
    const primary = selectPrimaryParent(candidates, registry);
    current = registry.get(primary.targetId);
  }
  return current.id;
}

function isDomainTier(doc: DefDoc | undefined): boolean {
  return doc?.tier === "system" || doc?.tier === "layout";
}
```

**엣지 케이스**:
- **다중 부모**: 복수 `depends_on`이 모두 도메인 티어를 가리키면 `multi-domain` 경고
- **순환 참조**: visited set으로 감지, 기존 `circular-ref` 에러로 처리
- **부모 없음**: `domain_root === self`, 이것이 도메인 루트
- **비시스템 부모**: component/entry로 가리키면 무시 (도메인은 시스템만)

### 2.2 duplicate-coordinate 재정의

```typescript
// before
const key = `${tier}:${scope}:${layer}:${aspect}`;

// after
const domainRoot = deriveDomainRoot(entry, registry);
const key = `${tier}:${scope}:${layer}:${aspect}:${domainRoot}`;
```

같은 `domain_root` 내 같은 좌표 = 진짜 중복 의심 (예: 같은 도메인에서 같은 역할의 두 시스템 → 합병 또는 계층화 검토).

### 2.3 신규 경고 타입: `missing-domain-root`

`tier: system`이면서 `domain_root === self`이지만 **실제 도메인 루트가 아닌 경우** 감지:
- 휴리스틱: id가 특정 도메인 접두사를 가지면서 부모 링크가 없음 (예: `apm-codegen-system`인데 `apm-system` 참조 없음)
- 수정 방향: 부모 시스템에 `depends_on` 링크 추가

### 2.4 신규 경고 타입: `multi-domain`

한 시스템이 서로 다른 도메인 루트로 향하는 `depends_on` 여러 개를 가짐:
- 의도된 cross-domain 소비라면 tag `cross-domain` 부여하여 경고 억제
- 비의도적이라면 주 도메인 1개로 정규화

### 2.5 기대 시나리오 문서 정책

각 의존 관계에 대해 다음 원칙이 적용된다.

**원칙**:
- `depends_on` 링크는 **소비자가 기대하는 시나리오**를 정의하는 문서로 뒷받침되어야 한다
- 이 문서는 공급자 시스템의 `.test.md` 또는 소비자 시스템의 `.cases.md`로 작성
- 테스트 코드(`*.test.ts`)가 시나리오를 구현한다

**세 종류의 위치**:

| 위치 | 소유자 | 역할 |
|------|--------|------|
| 공급자의 `.test.md` | 공급 시스템 | "나는 이 시나리오를 보장한다" (self-verification) |
| 소비자의 `.cases.md` | 소비 시스템 | "나는 공급자에게 이걸 기대한다" (consumer-driven) |
| 공유 `.test.md` | cross-domain tag | 여러 소비자가 공유하는 계약 |

**링크 규칙**:
```yaml
# consumer-system.spec.md
links:
  - target: provider-system
    type: depends_on

# provider-system.test.md  (또는 consumer-system.cases.md)
links:
  - target: provider-system
    type: verifies
  - target: consumer-system     # 이 테스트의 소비 맥락
    type: traces_to
```

**validator 확장 후보** (Phase 2):
- `dependency-without-scenario` 경고: `tier: system`이 `depends_on` 링크를 가졌는데 그 대상에 대한 `verifies` 또는 `traces_to` 테스트 문서가 그래프 상 존재하지 않음
- `lifecycle: approved` 상태에서는 경고, `draft`에서는 억제 (초기 설계 단계 허용)

**테스트 품질 점수** (Phase 3+):
- `def audit --coverage <domain-root>` 명령이 도메인 내 의존 관계 중 시나리오 문서가 붙은 비율을 리포트
- 목표 커버리지는 DKG CON-004와 일관성 유지 (≥ 80%)

---

## 3. 기존 체계와의 관계

### 3.1 STC 제안과의 정합성

[tier-redesign](../tier-redesign/) 제안과 공존 가능:
- STC의 "System은 다른 System에 contains 안 됨" 원칙 유지
- 본 제안은 `depends_on`/`refines`를 소속 관계로 허용한다는 해석만 추가
- `tier: system`과 `tier: layout`은 모두 도메인 루트가 될 수 있다
- component/entry는 도메인을 가질 수 없음 (이들은 속성으로 참조됨)

### 3.2 `owner_system` 필드와의 관계

`owner_system`은 `type: design` 문서가 소유하는 시스템을 가리킨다. `domain_root`는 시스템 자체의 상위 도메인을 가리킨다. 둘은 보완적:

| 필드 | 대상 | 답하는 질문 |
|------|------|-----------|
| `owner_system` | design/spec 문서 | "이 스펙은 어느 시스템이 소유하나?" |
| `domain_root` (파생) | system 문서 | "이 시스템은 어느 도메인에 속하나?" |

`owner_system`이 `domain_root` 파생의 fallback으로 쓰일 수 있음 (링크가 없는 초기 단계).

### 3.3 `svc` 필드와의 관계

`svc` 필드는 서비스 소속을 표기하고, 서비스는 대체로 도메인 루트의 하위 단위다. 따라서:
- 같은 `svc`를 가지면 같은 `domain_root` 후보
- 파생 로직 fallback: 링크가 불완전하면 `svc` 기반으로 추론

---

## 4. 기대 효과

| 지표 | 현재 | 목표 |
|------|------|------|
| `duplicate-coordinate` | 30건 | ≤ 8건 (진짜 내용 중복만) |
| `orphan` (root 문서) | 18건 | ≤ 5건 (의도된 standalone만) |
| 도메인별 탐색 (`def list --domain-root apm-system`) | 불가 | 가능 |
| 좌표 기반 네비게이션 정확도 | 낮음 (32개가 같은 좌표) | 높음 (domain_root로 세분) |
| 의존성별 기대 시나리오 커버리지 | 측정 불가 | `def audit --coverage`로 측정 가능 (목표 ≥ 80%) |
| `depends_on` 링크의 의미론 명시 | 암묵적 | 소비자 `.cases.md` 또는 공급자 `.test.md`로 명시 |

---

## 5. 미결 사항

### P1 — Phase 1 선결

- [ ] `depends_on` vs `refines` 우선순위 규칙 확정
- [ ] 다중 부모 발생 시 primary 선택 규칙 (lex / weight / tag)
- [ ] fallback 순서 (링크 → `owner_system` → `svc` → 자기 자신)

### P2 — Phase 3 실행 검증

- [ ] 1,119건 문서에 파생 로직 적용 시 domain_root 분포
- [ ] `missing-domain-root` 휴리스틱 정확도
- [ ] Cross-domain 정당한 케이스 (예: logger-contract가 apm과 log-ingest에 걸침) 식별 기준

### P2-b — 기대 시나리오 정책

- [ ] `.cases.md` (소비자 기대) vs `.test.md` (공급자 보장) 파일 배치 관습 확정
- [ ] `verifies` vs `traces_to` 링크 타입 사용 기준
- [ ] `dependency-without-scenario` 경고의 발동 조건 (lifecycle, depth 별)
- [ ] 기존 의존성 중 시나리오 문서 부재인 건수 파악 → Phase 5에 작업 범위 편입

### P3 — Skill/CLI 확장

- [ ] `qa-sdk def list --domain-root <id>` 구현
- [ ] `def audit --by-domain` 리포트
- [ ] `def-explore`, `def-topdown` skill에서 domain_root 필터

### P4 — proposals 통합

- [ ] [02-proposals-integration.md](./02-proposals-integration.md) 적용 후 proposal 문서의 `duplicate-coordinate` 경고 해소

---

## 다음 읽기

- [01-migration.md](./01-migration.md) — Phase 0~5 실행 계획
- [02-proposals-integration.md](./02-proposals-integration.md) — proposals 문서 관리체계 편입
- [tier-redesign/00-design.md](../tier-redesign/00-design.md) — STC 기초 제안 (병행 제안)
