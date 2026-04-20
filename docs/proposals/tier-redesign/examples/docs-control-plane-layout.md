---
def:
  id: tier-redesign-examples-docs-control-plane-layout
  type: knowledge
  knowledge_kind: proposal
  lifecycle: draft
  owner_system: definition-catalog
  projection_plane: intent
  scope: meta
  aspect: proposal_design
  tier: component
  depth: specification
  links:
    - target: tier-redesign-readme
      type: depends_on
status: pilot-draft
date: 2026-04-18
part_of: tier-redesign
role: layout-example
supersedes: -
superseded_by: -
---

> **Pilot Draft — STC Layout tier 예시.**
>
> 기존 `docs-control-plane.spec.md`의 일부를 **Layout으로 재해석**한 초안. 현재는 하나의 large System 문서이지만, STC 전환 후 ["어떤 Systems가 docs control plane에 참여하는가"](../tiers/layout.md)를 보는 Layout surface로 분리 가능.
>
> 연관: [Layout tier 정의](../tiers/layout.md) · [System 독립성 규칙](../rules/system-independence.md) · [System 예시](./deterministic-label-system.md)
>
> **D-17 Pivot 반영**: FSM Pilot 제거. 상태 관리는 System의 `lifecycle_ref`로 meta-semantic 참조.

# Docs Control Plane — Layout

## 목적 ^purpose

`qa-sdk docs`가 소비하는 read-only document adapters + projections + readiness를 조직하는 **Layout**이다. 각 System은 독립 문서로 존재하며, 본 Layout은 "어떤 Systems가 함께 이 도메인을 구성하는가"를 나열한다.

본 Layout은 **카탈로그** 성격 — Consumer는 Systems 간 경계를 파악하고 필요한 System 문서로 이동한다. 상세 operations는 각 System 문서에서 확인. 상태 관리가 있는 System은 `lifecycle_ref`를 통해 meta-semantic 체계 참조.

## Inline 정의 금지 선언

본 Layout은 **Systems 참조만** 담는다. 새 Component / Entry / System은 각자 독립 tier 문서로 존재. 본 문서에서 정의하지 않는다 ([system-independence 규칙 3](../rules/system-independence.md) 준수).

---

## Systems

### deterministic-label-system ^ref:deterministic-label-system

- **역할**: 문서/pack/artifact의 좌표 label을 read-only projection + readiness + 전이 dry-run으로 조합
- **이 Layout에 포함되는 이유**: `qa-sdk docs` 명령 체계의 핵심 데이터 모델 제공
- **상세**: [examples/deterministic-label-system.md](./deterministic-label-system.md) (Pilot) / State Component: `deterministic-label-record-state` (미작성)

### doc-envelope-system ^ref:doc-envelope-system

- **역할**: `DocumentEnvelope` 타입 + family/scope/completed-record 감지 + TODO 파싱
- **이 Layout에 포함되는 이유**: 다른 Systems가 공통 소비하는 문서 envelope을 제공
- **상세**: `packages/doc-envelope/src/` (구현) / Layout 관점: [docs-control-plane.spec.md 참조](../../../specs/definition-catalog/docs-control-plane.spec.md)

### ontology-pack-validate-system ^ref:ontology-pack-validate-system

- **역할**: Ontology pack load + validation + docs reader DI
- **이 Layout에 포함되는 이유**: Label projection 중 pack 계층의 validation 결과 공급
- **상세**: `packages/ontology-pack-validate/src/`

### docs-graph-system ^ref:docs-graph-system

> **⚠️ 가설적 System** — 현재 실제 System 문서로 존재하지 않음. Phase 3에서 실제로 분해 시 명명 조정 가능.

- **역할**: 문서 그래프 traversal + ranking + filtering + summary
- **이 Layout에 포함되는 이유**: Consumer가 문서 간 관계를 탐색하는 표면
- **상세**: `packages/cli/src/lib/docs-control-plane/graph-*.ts` (현재 구현 위치)

### prd-completion-sync-system ^ref:prd-completion-sync-system

> **⚠️ 가설적 System** — 현재 실제 System 문서로 존재하지 않음. Phase 3에서 실제로 분해 시 명명 조정 가능.

- **역할**: PRD completion을 검출하고 TODO/spec/roadmap/scenario-matrix 후보 dry-run
- **이 Layout에 포함되는 이유**: PRD 실행 문서의 write-candidate 산출 (dry-run만, write 아님)
- **상세**: `packages/cli/src/lib/docs-control-plane/prd-completion-sync.ts`

---

## Systems 간 관계

```
Consumer (qa-sdk docs CLI)
  ↓
docs-control-plane-layout
  ↓ refs
  ├── deterministic-label-system
  │     ├── lifecycle_ref → deterministic-label-record-state (Component, state-enum sub-type, D-18)
  │     └── depends_on → doc-envelope-system, ontology-pack-validate-system
  ├── doc-envelope-system            ← Component 주도
  ├── ontology-pack-validate-system  ← Validate operations 제공
  ├── docs-graph-system              ← depends_on: doc-envelope-system
  └── prd-completion-sync-system     ← depends_on: doc-envelope-system, docs-graph-system
```

본 Layout은 참조만 한다. System 간 `depends_on` 관계는 각 System 문서가 자체 선언.

---

## Consumer 빠른 참고

| 사용 목적 | 참조 System |
|----------|------------|
| 문서 inventory / readiness / 좌표 label 계산 | [deterministic-label-system](./deterministic-label-system.md) |
| `DocumentEnvelope` 파싱 / family scope | doc-envelope-system |
| Ontology pack 검증 | ontology-pack-validate-system |
| 문서 그래프 탐색 / 시각화 | docs-graph-system |
| PRD completion detection → cleanup candidate | prd-completion-sync-system |

---

## 경계

### 포함

- Read-only document adapters + projections + readiness 계산
- PRD/scenario-matrix dry-run **detection** (결과 표시만)

### 제외

- **Write-mode controller** — 문서/PRD/label 실제 수정. STC stability plan (보류)의 후속 PRD로 연기.
- **Persistence layer** — append-only label registry 등. 미정.
- CLI command descriptor 자체 (별도 Layout: cli-commands-layout 가설)

---

## Layout 재귀 주의

본 Layout이 새로 System 필요성을 발견하면:

- Inline 정의 금지 — 새 System은 별도 문서로 작성
- 본 Layout의 `refs`에 추가
- 각 System은 자체 operations / lifecycle_ref / depends_on 선언

실제 사례: write-mode controller 필요성이 드러날 때 (stability plan accept 이후), 별도 `deterministic-label-transition-controller-system` 문서를 만들고 본 Layout이 refs에 추가할 수 있음.

---

## Pilot 관찰

- [ ] 기존 `docs-control-plane.spec.md` (single large System)과 본 Layout 분리 시 중복 감지 — 어느 쪽이 승계할지 결정
- [ ] `docs-graph-system`과 `prd-completion-sync-system` 같은 명명은 본 Pilot 초안. 실제로는 더 작은 Systems로 분해될 가능성
- [ ] Layout heading mirror 패턴(`^ref:<id>`)이 실제 작성 시 자연스러운가 — [Layout tier 정의](../tiers/layout.md) § 구조 제안 검증
- [ ] Consumer 빠른 참고 표가 효과적인 navigation surface 역할을 하는가
