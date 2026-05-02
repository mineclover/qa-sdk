---
def:
  id: domain-hierarchy-subdoc-rollup-simulation
  type: knowledge
  knowledge_kind: proposal
  lifecycle: review
  owner_system: definition-catalog
  projection_plane: intent
  scope: meta
  aspect: proposal_design
  tier: system
  depth: validation
  links:
    - target: domain-hierarchy-readme
      type: depends_on
status: under-review
date: 2026-04-21
part_of: domain-hierarchy
role: review
---

# Sub-document Rollup Simulation — 4 파생 전략 비교

## §1 문제 정의

[`service-todo-review`](./2026-04-21-service-todo-review.md) §5.2 에서 확인된 현상:

> 1차 시도: `qa-sdk def context <doc> | grep 도메인 루트` 로 `deriveDomainRoot` 파생 값 수집.
> → 결과: **32/38이 `self`** (자신이 domain-tier root). 서비스 경계 그룹핑에 부적합.

즉 `.todo.md / .plan.md` 류 sub-document 들은 현재 알고리즘에서 대부분 self-root 로 떨어진다. 이유는 구조적이다:

1. 대부분 `tier: component`.
2. 부모(sibling spec) 와 연결되는 링크는 `traces_to` — 그런데 `deriveDomainRoot` 는 `refines / depends_on` 만 walk.
3. 그나마 있는 `refines/depends_on` 도 사이드웨이로 도메인-타이어가 아닌 다른 sub-doc 을 향하는 경우가 있다.

사용자 확정 요구사항: "sub-document 는 가장 가까운 system ancestor 로 rollup 되어야 한다."

본 문서는 이 갭을 메우기 위한 4 파생 전략을 실증 데이터로 시뮬레이션한 결과다.

## §2 4 전략 정의

| 전략 | 아이디어 | 주된 데이터 |
|------|---------|-------------|
| **E (baseline)** | 현행 알고리즘 — `refines > depends_on` outgoing walk | 기존 `domain-root.ts` |
| **A — contains-inverse** | X 에 대해 `Y contains X` 인 Y 를 찾아 Y 의 rollup 을 위임. Y 다중 시 `system > layout` 우선, `localeCompare` tiebreak. | incoming `contains` edges |
| **B — traces_to 포함 walk** | 기존 walk 에 `traces_to` 추가. 우선순위 `refines > depends_on > traces_to`. | outgoing `refines/depends_on/traces_to` edges |
| **C — file co-location** | `foo.todo.md` 와 같은 디렉토리의 `foo.spec.md` (또는 `foo.md`) 를 형제로 간주해 그 rollup 위임. | `source_path` |
| **D — id-prefix 매칭** | sub-doc id 접미 `-todo/-plan/-memo/-test/-cases/-rule` 를 제거해 DB 에서 정확 매칭. 실패 시 `-system`, `-spec` 접미로 재시도. | `doc_id` 문자열 |

모든 전략은 "부모 찾으면 baseline walk 위임" 패턴으로 최종 root 를 산출한다 (부모의 rollup 결과가 sub-doc 의 rollup 결과). 각 전략은 독립적으로 실행되며, 동일 입력에 동일 출력 (deterministic).

## §3 측정 방법

### 3.1 데이터 소스

- `/Users/junwoobang/workflow/qa-sdk/data/definition-service.sqlite`
  - documents: 1,250 건
  - document_links: 2,898 건
- 시뮬레이션 스크립트: `/tmp/subdoc-rollup-sim.ts`
- 원시 출력: `/tmp/subdoc-rollup-sim-output.json`

### 3.2 대상 집합 (sub-docs)

`source_path LIKE '%.todo.md' OR '%.plan.md' OR '%.memo.md' OR '%.test.md' OR '%.cases.md' OR '%.rule.md'` 조건으로 추출한 **136 건**. 확장자 분포:

| 확장자 | 건수 |
|--------|------|
| `.cases.md` | 44 |
| `.test.md` | 28 |
| `.plan.md` | 22 |
| `.rule.md` | 20 |
| `.todo.md` | 16 |
| `.memo.md` | 6 |

대다수 `tier: component` (127 건). 예외: `plan.md` 4 건은 `tier: system` 으로 부여되어 있어 일부 전략에서 영향 받음.

### 3.3 측정 지표

- **Coverage (%)**: `root !== self` 인 sub-doc 비율. 높을수록 좋음 — 단 정확성 희생 없이.
- **Distribution (top-10)**: 각 전략에서 sub-doc 이 가장 많이 수렴하는 root 10 개 + 건수.
- **Over-absorption**: 단일 root 가 흡수한 sub-doc 최대 비율. **Phase 0 교훈: > 10% 이면 경고, > 20% 이면 거부**.
- **Ambiguity**: 전략이 다중 후보를 가진 sub-doc 수 (deterministic tiebreak 가 있더라도 설계 관점에서 경계 사례).
- **Backward compat**: Strategy B 의 경우 non-component 문서에서 baseline 과 결과가 달라지는 비율.

## §4 Before (Baseline, Strategy E)

| 지표 | 값 |
|------|---|
| Sub-doc 수 | 136 |
| Rollup 성공 | 60 / 136 |
| **Coverage** | **44.1%** |
| Max over-absorption root | `storage-system` (11 건, 8.1%) |
| Ambiguity (다중 후보) | 45 |

top-10 baseline rollup 루트:

| root | count |
|------|-------|
| storage-system | 11 |
| definition-catalog-spec | 9 |
| gate-system | 6 |
| df-system | 5 |
| registry-system | 5 |
| meta-semantic-system | 3 |
| dkg-system | 3 |
| system-support | 3 |
| canvas-viewport-spec | 3 |
| authorization-ontology-system | 2 |

관찰: 기존에도 절반 가까이는 `refines/depends_on` 로 상위 spec 과 연결되어 있어 rollup 이 작동하지만, 56% (76 건) 은 self-root 유지.

## §5 After — 전략별 결과

### 5.1 Strategy A — contains-inverse

| 지표 | 값 |
|------|---|
| **Coverage** | **25.7%** (35/136) |
| Max over-absorption | `rlsc` (10, 7.4%) |
| Ambiguity | 4 |
| 결정론성 | ✓ |

top-10: `rlsc(10), storage-system(8), operational-ontology-system(6), gate-system(3), meta-semantic-system(2), infra-engine-system(2), registry-system(1), realization-service-control-plane(1), scope-nesting-system(1), definition-catalog-spec(1)`.

관찰: 과도흡수 위험 **가장 낮음** (7.4%). 그러나 coverage 가 낮음 — 실제로 `contains` 로 sub-doc 을 직접 가리키는 parent 는 drastically 적다. 단독으로는 부족하지만 **hybrid 1순위 layer** 로 적합.

### 5.2 Strategy B — include `traces_to` in walk

| 지표 | 값 |
|------|---|
| **Coverage** | **69.9%** (95/136) |
| Max over-absorption | **`definition-catalog-spec` (33, 24.3%)** ⚠ |
| Ambiguity | 57 |
| Non-component drift vs baseline | 26 / 319 (8.15%) |

top-10: `definition-catalog-spec(33), storage-system(15), registry-system(7), gate-system(6), df-system(5), dkg-system(4), scope-nesting-system(4), meta-semantic-system(3), infra-engine-system(3), system-support(3)`.

관찰: **Phase 0 가 경계한 `definition-catalog-spec` 과흡수 함정이 그대로 재현**. `authorization-management-roadmap-plan → definition-catalog-spec` 같은 **의미상 잘못된** 흡수가 다수 발생 (roadmap-plan 은 authorization-ontology-system 에 속해야 함). traces_to 는 **목적 관찰/추적** 관계이므로 상위 domain 을 유추하는 용도가 아니다.

또한 non-component 문서 26건의 rollup 을 바꾸므로 backward compatibility 위반. Strategy B 단독 채택은 **거부**.

### 5.3 Strategy C — file co-location

| 지표 | 값 |
|------|---|
| **Coverage** | **66.2%** (90/136) |
| Max over-absorption | `definition-catalog-spec` (13, 9.6%) |
| Ambiguity | 0 (결정적 file pattern) |
| 결정론성 | ✓ |

top-10: `definition-catalog-spec(13), storage-system(11), gate-system(10), rlsc(10), registry-system(6), scope-nesting-system(6), system-support(4), meta-semantic-system(4), df-system(4), canvas-viewport-spec(3)`.

관찰: 과도흡수 10% 이하로 안전, ambiguity 없음. 한계: `{stem}.spec.md` sibling 이 없는 경우 (e.g. `work-topic-schema.plan.md`, `event-taxonomy-roadmap.plan.md` — spec 파일 없음) 커버 못함.

### 5.4 Strategy D — id-prefix matching

| 지표 | 값 |
|------|---|
| **Coverage** | **71.3%** (97/136) |
| Max over-absorption | `definition-catalog-spec` (14, 10.3%) |
| Ambiguity | 0 |
| 결정론성 | ✓ |

top-10: `definition-catalog-spec(14), storage-system(11), gate-system(10), rlsc(10), registry-system(6), scope-nesting-system(6), operational-ontology-system(6), meta-semantic-system(5), system-support(4), df-system(4)`.

관찰: 단독 최고 coverage. 과도흡수 10.3% — Phase 0 임계선에 근접하지만 `definition-catalog-spec` 14건은 실제로 그 디렉토리 산하 rule/cases/test/memo 들이라 의미상 정당. `-system`, `-spec` fallback 접미 덕분에 보다 로버스트.

## §6 비교 테이블

| 전략 | Coverage | Over-absorption | Ambiguity | Backward compat | Deterministic | 종합 |
|------|----------|----------------|-----------|-----------------|---------------|------|
| E baseline | 44.1% | 8.1% | 45 | — (기준) | ✓ | 기준 |
| A contains-inv | 25.7% | **7.4%** | 4 | ✓ (walk 미변경) | ✓ | 정밀 보완용 |
| B traces_to | 69.9% | **24.3%** ⚠ | 57 | ✗ (26건 변경) | ✓ | **거부** |
| C co-location | 66.2% | 9.6% | 0 | ✓ | ✓ | 안정 후보 |
| D id-prefix | 71.3% | 10.3% | 0 | ✓ | ✓ | **최강 단독** |
| Hybrid A+D+C+B | 94.9% | 20.6% ⚠ | — | 부분 위반 | ✓ | 거부 |
| **Hybrid D>A>C** | **75.7%** | **11.0%** | 매우 낮음 | ✓ | ✓ | **추천** |

가중치 점수 (Coverage ×1 + (30 − maxAbsorb%) ×1.5 + backward-compat bonus 10):

- Hybrid D>A>C: 75.7 + 28.5 + 10 = **114.2**
- D 단독: 71.3 + 29.6 + 10 = **110.9**
- C 단독: 66.2 + 30.6 + 10 = 106.8
- E baseline: 44.1 + 32.9 + 10 = 87.0
- A 단독: 25.7 + 33.9 + 10 = 69.6
- Hybrid A+D+C+B: 94.9 + 14.1 − 5(backward 위반) = 104.0
- B 단독: 69.9 + 8.6 − 5 = 73.5

## §7 추천 (Hybrid)

**Hybrid D > A > C (no traces_to)** — D 로 시작해 A, C 로 폴백.

### 알고리즘 스케치

```typescript
export function deriveSubDocRoot(
  doc: DefinitionEntry,
  registry: DomainRootRegistry,
): string {
  if (!isSubDoc(doc)) return deriveDomainRoot(doc, registry);

  // 1) id-prefix (D) — doc.id === "foo-bar-todo" → lookup "foo-bar"
  const stripped = stripSubDocSuffix(doc.id);
  const dParent = stripped && (
    registry.get(stripped)
    ?? registry.get(`${stripped}-system`)
    ?? registry.get(`${stripped}-spec`)
  );
  if (dParent) return deriveDomainRoot(dParent, registry);

  // 2) contains-inverse (A)
  const containers = registry
    .getLinks(doc.id, "incoming")
    .filter(l => l.linkType === "contains")
    .map(l => registry.get(l.sourceId))
    .filter((d): d is DefinitionEntry => !!d);
  if (containers.length > 0) {
    const primary = containers
      .toSorted((a, b) => {
        const ta = isSystemTier(a) ? 0 : 1;
        const tb = isSystemTier(b) ? 0 : 1;
        if (ta !== tb) return ta - tb;
        return a.id.localeCompare(b.id);
      })[0];
    return deriveDomainRoot(primary, registry);
  }

  // 3) file co-location (C) — foo.todo.md → foo.spec.md
  const sibling = findCoLocatedSpec(doc);
  if (sibling) return deriveDomainRoot(sibling, registry);

  // 4) self (unchanged)
  return doc.id;
}
```

### Rationale

1. **D 를 1순위로 두는 이유**: coverage 최고 (71.3%), ambiguity 0, 결정적. `-system/-spec` fallback 접미로 누락 최소화. id-level 으로 바로 해소 가능한 케이스 를 우선 처리하면 그래프 탐색 비용도 절감.
2. **A 를 2순위**: D 가 실패하는 케이스 중 일부는 `contains` 링크로 명시된 parent 가 있다. 이 경우 의미적으로 가장 정확 (작성자가 명시적으로 "이 그룹 산하" 라고 선언).
3. **C 를 3순위**: id/link 로 모두 해소 안 되지만 파일 배치가 `foo.{plan,todo}.md` 패턴인 경우 sibling `foo.spec.md` 를 찾음. 파일 시스템 단서는 저자의 암묵적 의도.
4. **B 제외**: traces_to 는 **관찰/추적 관계** 이며 상위 domain 유추에 부적합. 본 시뮬에서 `definition-catalog-spec` 가 24.3% 를 독식하는 Phase 0 재현 현상을 확인했다. 또한 non-component 문서 26건의 rollup 을 바꿔 backward compat 위반. 앞으로도 walk 에 추가하지 말 것.

### 해소 후 남는 self (33 건)

주요 카테고리:
- `docs/specs/system/*.rule.md` (10 건) — 시스템-횡단 룰로 고유 parent 가 없음. 의도적 self-root 로 수용 가능.
- `docs/archive/**` 4 건 — 이미 보관 상태. self-root 방치가 정합적.
- `*-plan` 8 건 — 자신 id 가 이미 `-plan` 접미임에도 대응 spec 이 없는 경우 (e.g. `event-taxonomy-roadmap-plan` 의 stem `event-taxonomy-roadmap` spec 은 존재하지 않음). 해결책은 spec 생성 또는 frontmatter `owner_system` 보완.
- memo 3 건 — 짧은 observational note, self-root 무해.

Hybrid 의 **75.7% 가 수용 가능한 상한** 이며, 나머지는 *알고리즘 문제가 아니라 데이터/문서 누락*.

## §8 Go/No-Go 판정

### 판정: **GO** — Hybrid D>A>C 구현 권고

근거:

| 기준 | 판정 |
|------|------|
| Coverage 개선이 유의미한가? (> 30pt 상승) | ✓ 44.1% → 75.7% (**+31.6pt**) |
| Over-absorption < 12%? | ✓ 11.0% (storage-system 15건, 대부분 타당한 소속) |
| Backward compat 유지? | ✓ non-component 문서 rollup 영향 없음 (walk 은 기존 그대로) |
| Deterministic? | ✓ 모든 서브전략이 결정적 |
| 구현 난이도? | **낮음** — 약 40줄 추가, 외부 상태 없음 |
| 해소되지 않는 self 의 수용 가능성? | ✓ 33/136 중 대부분 rule·archive·spec-없는-plan. 알고리즘 한계 아닌 데이터 한계 |

### 실측값 요약 (Phase 0 요구 형식)

| 지표 | Baseline | After Hybrid D>A>C |
|------|----------|---------------------|
| Sub-doc rollup coverage | 44.1% | **75.7%** |
| Max over-absorption root % | 8.1% (storage-system) | 11.0% (storage-system) |
| Ambiguity cases | 45 | A:4 / D:0 / C:0 → 합산 미미 |
| Backward compat (non-component walk) | 기준 | 100% 동일 |

## §9 다음 단계

### 구현 단계 (`deriveDomainRoot` 확장)

1. `packages/definition-catalog/src/domain-root.ts` 에 **`deriveSubDocRoot`** helper 추가 (섹션 §7 스케치 기반).
2. `deriveAllDomainRoots` 가 sub-doc 판별 후 `deriveSubDocRoot` 호출하도록 분기.
3. `DomainRootRegistry` 에 `incoming contains` 조회 가능성 확인 — 기존 `getLinks(id, "incoming")` 존재 시 바로 사용, 아니면 precompute.
4. `DefinitionEntry` 에 `source_path` 접근 필요. 현재 catalog 타입에는 없음 — `ref` 필드나 별도 경로 인덱스 도입 고려. (service 레이어에서 주입하는 형태 권장 — pure catalog 의 파일 시스템 의존 회피.)

### 테스트

1. 본 시뮬레이션의 136 건 perDocResults 를 fixture 로 고정.
2. Hybrid 경로 (`via`) 를 assert — D/A/C/self 분기 정확성.
3. Backward compat: 비-sub-doc 1,114 건의 rollup 이 현행과 동일한지 snapshot diff.

### 후속 개선 (Phase 5+)

- `event-taxonomy-roadmap-plan` 처럼 대응 spec 이 없는 8 건은 수동 리뷰:
  - spec 생성 또는
  - frontmatter 에 `owner_system` 명시 (fallback 로 E 에 추가 가능) 또는
  - 의도된 self-root 로 수용 (큰 그림 기획 문서)
- `docs/specs/system/*.rule.md` 10 건은 `system-specs-rules-index` 같은 group doc 을 도입해 `contains` 로 연결하면 A 전략이 커버 (자연스런 구조 추가).

## 부록 A — 전략별 Top-10 비교 (rollup count)

| rank | E (baseline) | A (contains) | B (traces_to) | C (co-loc) | D (id-prefix) | Hybrid D>A>C |
|------|--------------|--------------|---------------|------------|---------------|--------------|
| 1 | storage-system (11) | rlsc (10) | definition-catalog-spec (33) | definition-catalog-spec (13) | definition-catalog-spec (14) | storage-system (15) |
| 2 | definition-catalog-spec (9) | storage-system (8) | storage-system (15) | storage-system (11) | storage-system (11) | definition-catalog-spec (14) |
| 3 | gate-system (6) | operational-ontology-system (6) | registry-system (7) | gate-system (10) | gate-system (10) | gate-system (10) |
| 4 | df-system (5) | gate-system (3) | gate-system (6) | rlsc (10) | rlsc (10) | rlsc (10) |
| 5 | registry-system (5) | meta-semantic-system (2) | df-system (5) | registry-system (6) | registry-system (6) | registry-system (6) |

## 부록 B — 산출물

- 시뮬레이션 스크립트: `/tmp/subdoc-rollup-sim.ts`
- 원시 출력: `/tmp/subdoc-rollup-sim-output.json`
- 본 리뷰: `docs/proposals/domain-hierarchy/reviews/2026-04-21-subdoc-rollup-simulation.md`
- 선행 연구: [2026-04-20-phase0-simulation.md](./2026-04-20-phase0-simulation.md), [2026-04-21-service-todo-review.md](./2026-04-21-service-todo-review.md)
