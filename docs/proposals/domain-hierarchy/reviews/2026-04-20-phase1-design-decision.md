---
def:
  id: domain-hierarchy-phase1-design-decision
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
status: under-review
date: 2026-04-20
part_of: domain-hierarchy
role: decision
supersedes: -
superseded_by: -
---

# Phase 1 설계 결정 — 시뮬레이션 통합 결론

## 맥락

Phase 0/0b/0c 세 차례 시뮬레이션으로 `deriveDomainRoot` 파생 알고리즘을 측정했다. 모든 케이스에서 duplicate-coordinate 그룹 축소는 **동일한 17/10/3 (resolved/partial/unchanged) 분포**에 수렴했다. 차이가 드러난 지표는 top-root 흡수량이었다.

## 측정 요약

| 구성 | afterDupGroups | top-root 흡수 |
|------|---------------|--------------|
| Phase 0: `depends_on > refines` | 25 | `definition-catalog-spec` 90 |
| Phase 0b: `refines > depends_on` (Q2) | 25 | `definition-catalog-spec` 86 |
| Phase 0c: `owner_system` primary + Q2 fallback | **26** (악화) | `meta-semantic-system` 97, `definition-service` 92 |

## 관찰

1. **알고리즘으로 얻을 수 있는 이득에 상한 있음.** 어떤 priority rule/heuristic 조합이든 17/10/3은 불변. 이는 DB의 link graph 구조 자체가 평평해서 생기는 **데이터 문제**지 **알고리즘 문제가 아니다**.
2. **owner_system primary는 기각.** 15.3% 커버리지가 편중되어 있어, 단지 흡수되는 root의 이름만 바뀔 뿐 집중도는 오히려 증가한다.
3. **Q2 rule (refines > depends_on)이 의미론적 baseline.** 10건 이상의 구체 케이스(`index-meta-*`, `skill-def-*`, `spec-core-*`, `perm-*`)에서 더 명확한 도메인 귀속을 제공.

## 결정

### Phase 1 알고리즘

```typescript
// deriveDomainRoot(doc, registry)
// 1. isDomainTier(doc) && no domain-tier parent → self
// 2. walk up:
//    - primary: refines → domain-tier parent
//    - secondary: depends_on → domain-tier parent  (Q2 Option B)
//    - tiebreak: target with no further domain ancestor > target id localeCompare
// 3. owner_system은 diagnostic 레이어 — walk 결과와 owner_system 불일치 시 경고
// 4. visited set, depth cap 10
```

### Phase 2 보고 항목 추가

- 현행 `duplicate-coordinate` 경고에 더해:
  - `top-root-absorption` (선택 경고): 한 root가 전체 문서의 5% 이상을 흡수하면 info 수준 diagnostic
  - `owner-root-mismatch` (선택 경고): 문서의 owner_system 필드와 derive된 domain_root가 다를 때 info

### 과도 수렴은 Phase 3에서 해결

`definition-catalog-spec`에 86건이 흡수되는 현상은 **하위 도메인 sub-root 부재**로 인한 것. Phase 3의 "소속 관계 보완" 작업이 구조적 해법:

- `skill-def-*`, `spec-core-*` 등을 중간 sub-root로 승격 또는 명시적 부모 링크 추가
- 15개 "new-root-needed" 후보를 사람 리뷰
- Phase 3 후 재시뮬로 top-root 흡수 < 30 목표

### 추가 탐색 생략

Phase 0d (prefix-match gating), Phase 0e (hop-distance penalty)는 **진행하지 않는다**. 근거:
1. 알고리즘 튜닝은 17/10/3 상한에 도달했다
2. Prefix-match는 id 네이밍 규약을 암묵 의존하며, 규약 없는 레거시 문서에 대해 무력
3. Hop-distance는 거리 임계값 튜닝을 필요로 하며 결정론적이지 않음
4. 가장 직접적인 해법은 Phase 3 (구조적 링크 보완)

## Phase 1 산출물

- `packages/definition-catalog/src/domain-root.ts`:
  - `deriveDomainRoot(doc, registry): string`
  - `deriveAllDomainRoots(registry): Map<docId, rootId>`
  - `isDomainTier(doc): boolean`
  - `selectPrimaryParent(candidates, registry): Link`
  - `detectOwnerRootMismatch(doc, derivedRoot): "ok" | "mismatch" | "no-owner"` (신규)
- `packages/definition-catalog/src/domain-root.test.ts`: Phase 0/0b/0c의 fixture 케이스 고정
- `src/index.ts`에서 export

## 성공 기준

- 알고리즘은 Phase 0b와 동일한 숫자 생산 (재현성 확보)
- 단위 테스트 커버리지 ≥ 80%
- 1,119건 전수 파생 < 500ms
- owner-root-mismatch 감지 정확도 100% (샘플 5건 수동 검증)

## 참조

- [2026-04-20-phase0-simulation.md](./2026-04-20-phase0-simulation.md)
- [2026-04-20-phase0b-q2-resim.md](./2026-04-20-phase0b-q2-resim.md)
- [2026-04-20-phase0c-owner-heuristic.md](./2026-04-20-phase0c-owner-heuristic.md)
- [2026-04-20-q2-parent-priority.md](./2026-04-20-q2-parent-priority.md)
- [../00-design.md](../00-design.md) § 1.5, § 2.1
- [../01-migration.md](../01-migration.md) Phase 1 / Phase 3
