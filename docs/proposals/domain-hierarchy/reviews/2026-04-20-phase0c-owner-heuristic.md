---
def:
  id: domain-hierarchy-phase0c-owner-heuristic
  type: knowledge
  knowledge_kind: proposal
  lifecycle: review
  owner_system: definition-catalog
  projection_plane: intent
status: under-review
date: 2026-04-20
part_of: domain-hierarchy
role: review
---

# Phase 0c — `owner_system` 1차 휴리스틱 시뮬레이션

Phase 0([2026-04-20-phase0-simulation.md](./2026-04-20-phase0-simulation.md))와 Phase 0b([2026-04-20-phase0b-q2-resim.md](./2026-04-20-phase0b-q2-resim.md))는 동일한 17/10/3 분포를 냈지만 두 시뮬레이션 모두 `definition-catalog-spec`가 86–90건을 단일 root로 흡수하는 과도 수렴 문제를 남겼다.

Phase 0b의 권고는 **Option B = Q2 규칙 + 추가 휴리스틱**이었다. 본 Phase 0c는 그 추가 휴리스틱 후보 중 2번 — **`owner_system`을 1차 소스로 승격**하고 링크 체인은 fallback으로 사용하는 안 — 을 시뮬레이션한다.

---

## 방법론

### 휴리스틱 정의

```
deriveDomainRoot(doc):
  1. visited 보호 + depth cap 10
  2. PRIMARY:
     if doc.owner_system is set AND not "self" AND not doc.id:
       target = registry.get(doc.owner_system)
       if target exists:
         if isDomainTier(target): return target.id          # 직접 히트
         else: recurse into target                          # 비도메인-티어 owner
       else: fall through to step 3 (target이 DB에 없음)
  3. FALLBACK (Q2 규칙, Phase 0b와 동일):
     candidates = outgoing(refines | depends_on) filter isDomainTier
     if empty: return current (self)
     selectPrimaryParent: hasNoFurther > refines > depends_on > lex
```

### Phase 0b와의 차이

- Phase 0b: `owner_system` 무시. 항상 링크 체인 walk.
- Phase 0c: `owner_system`이 DB의 tier ∈ {system, layout} 문서를 가리키면 즉시 해당 id를 root로 반환. link walk는 owner가 없거나 owner 대상이 DB에 없을 때만 실행.

산출물:

- 스크립트: `/tmp/domain-root-sim-owner.ts`
- 원시 출력: `/tmp/domain-root-sim-owner-output.json`
- Phase 0b↔0c 비교: `/tmp/compare-0b-vs-0c.ts`
- 보조 분석: `/tmp/analyze-0c-absorbers.ts`, `/tmp/check-0c-meta-cluster.ts`, `/tmp/check-missing-owner.ts`

---

## owner_system 필드 커버리지

| 지표 | 값 |
|---|---|
| 총 문서 | 1,119 |
| `owner_system` 값이 있는 문서 | 171 (**15.3%**) |
| ㄴ DB에 존재하는 대상 | 148 |
|   ㄴ tier ∈ {system, layout} (유효한 root) | **148 (100%)** |
|   ㄴ tier = component | 0 |
| ㄴ DB에 없는 대상 (→ fallback) | 23 |
| 자기 참조(doc_id or "self") | 2 |

커버리지 15.3%는 절대 수치로는 낮다(task budget의 30% 임계 미만). 그러나 실측 결과 **파생 경로에서 owner_system을 사용하는 문서는 189건**으로, 이는 원본 171건 + link walk 중간 노드에서 본인의 owner_system에 의해 재지정된 recursion 효과까지 포함한다. 아래 비교 지표가 보여주듯 *이 적은 커버리지만으로도 root 분포가 유의미하게 재배치*되므로 시뮬레이션을 완주했다.

### Top owner_system 대상

| owner_system | tier | 지정한 docs 수 |
|---|---|---|
| `meta-semantic-system` | layout | 96 |
| `definition-service` | system | 52 |
| `definition-catalog` | **DB에 없음** | 23 |

`definition-catalog` 23건(tier-redesign 관련 proposal 문서들)은 DB 상 `definition-catalog-spec`로 rename된 것으로 추정되나 현재 frontmatter에 미반영. 이 건은 fallback으로 떨어져서 Phase 0c에서도 self-root가 된다(tier=null이라 group에서 제외).

---

## 비교 지표 (Phase 0 / 0b / 0c)

### Top-level

| 지표 | Phase 0 (`deps > refines`) | Phase 0b (`refines > deps`) | **Phase 0c (owner + Q2)** |
|---|---|---|---|
| 총 문서 | 1,119 | 1,119 | 1,119 |
| baseline duplicate-coordinate 그룹 | 30 | 30 | 30 |
| 파생 후 duplicate-coordinate 그룹 | 25 | 25 | **26** |
| 완전 해소 그룹 | 17 | 17 | **17** |
| 부분 해소 그룹 | 10 | 10 | **10** |
| 무변화 그룹 | 3 | 3 | **3** |
| self-rooted system/layout 문서 | 128 | 128 | **121** |
| 분류(resolved/partial/unchanged) 바뀐 그룹 | — | 0 vs Phase 0 | **0 vs Phase 0b** |
| 0b→0c에서 root 바뀐 문서 | — | — | **189 (16.9%)** |

**관찰**: owner_system 도입이 resolved/partial/unchanged 상위 집계를 바꾸지 못했고(여전히 17/10/3), 오히려 duplicate-coordinate 그룹 수가 **25 → 26으로 1건 증가**했다. self-rooted 시스템은 128 → 121로 7건 감소 — 이 7건은 이제 owner_system 덕분에 진짜 root로 연결됨.

### Top-10 root 분포

| Rank | Phase 0 | n | Phase 0b | n | **Phase 0c** | n |
|---|---|---|---|---|---|---|
| 1 | definition-catalog-spec | **90** | definition-catalog-spec | **86** | **meta-semantic-system** | **97** |
| 2 | prefix-service | 43 | prefix-service | 43 | **definition-service** | **92** |
| 3 | system-libraries | 24 | system-libraries | 24 | prefix-service | 43 |
| 4 | dkg-skill-catalog | 20 | scope-nesting-visualization | 22 | system-libraries | 24 |
| 5 | registry-system | 19 | dkg-skill-catalog | 20 | scope-nesting-visualization | 22 |
| 6 | scope-nesting-visualization | 19 | registry-system | 19 | dkg-skill-catalog | 20 |
| 7 | coord-foundation | 17 | pipe-gate | 17 | registry-system | 19 |
| 8 | pipe-gate | 17 | rlsc | 14 | rlsc | 14 |
| 9 | rlsc | 14 | service-manifest-assembly | 13 | service-manifest-assembly | 13 |
| 10 | partial-binder-spec | 13 | claude-skill-group | 13 | claude-skill-group | 13 |
| - | — | — | — | — | definition-catalog-spec | **0** |

### 0b→0c 주요 이동 (Top 5)

| 이전 root → 새 root | 건수 |
|---|---|
| `definition-catalog-spec` → `definition-service` | **82** |
| `pipe-gate` → `meta-semantic-system` | 17 |
| `meta-semantic-ir` → `meta-semantic-system` | 9 |
| `pipe-static-lineage` → `meta-semantic-system` | 9 |
| `pipe-zoom` → `meta-semantic-system` | 5 |

`definition-catalog-spec`에서 빠져나간 86건 전체 중 **82건이 `definition-service`로**, 4건이 `meta-semantic-system`으로 이동했다. `definition-catalog-spec`으로 새로 들어온 문서는 **0건**.

---

## 과도 수렴 변화

### `definition-catalog-spec` 흡수

| 지표 | Phase 0 | Phase 0b | **Phase 0c** | 변화(0b→0c) |
|---|---|---|---|---|
| root으로 흡수된 수 | 90 | 86 | **0** | **−86 (−100%)** |
| 점유율(1,119 중) | 8.0% | 7.7% | 0% | −7.7pp |

**`definition-catalog-spec`의 지배적 흡수 현상은 완전히 해소되었다.**

### 그러나 절대적 과도 수렴은 **다른 root로 이동**했다

| Root | Phase 0b 흡수 | Phase 0c 흡수 | 변화 |
|---|---|---|---|
| `definition-catalog-spec` | 86 | 0 | −86 |
| `meta-semantic-system` | 2 | **97** | **+95** |
| `definition-service` | 10 | **92** | **+82** |

Phase 0b에서 1개 root가 86건을 흡수하던 문제가, Phase 0c에서는 **2개 root가 97+92 = 189건을 흡수**하는 구조로 변했다. 흡수의 **집중도**는 더 나빠졌다(1위 86 → 97, 2위 43 → 92). `prefix-service`(43) 이하 중간 루트들은 그대로 유지된다.

### 새로 발생한 중복 그룹

Phase 0c는 `system:feature:domain:func_def` 그룹에서 **`meta-semantic-system`이 4건 공유 sub-group 신규 생성**:

- `meta-semantic-pipe-impl`, `pipe-gate`, `pipe-zoom`, `pipe-static-lineage` — 모두 `owner_system=meta-semantic-system`로 직접 귀착.
- Phase 0b에서 이 문서들은 `pipe-gate`(17) 서브도메인에 분산되어 있었고 duplicate 후보가 아니었다.
- owner_system 승격이 pipe 계열을 meta-semantic-system으로 강제 수렴시킨 결과.

이 신규 sub-group 1개가 duplicate 그룹 총 수를 25 → 26으로 1건 증가시켰다(상위 집계 지표가 "약간 나빠진" 이유).

### 남은 대형 흡수 사례(Phase 0c 기준)

부분 해소 그룹에서 여전히 한 root를 공유하는 서브그룹:

- `system:feature:operation:func_def` → `definition-service`(**7**): `definition-harness`, `definition-quality-gates`, `decision-service-system`, `definition-service-system`, `spec-analyzer-system`, `spec-tracker-system`, `spec-verification-system` — Phase 0b에서 정확히 같은 7개가 `definition-catalog-spec` 아래 있었고, owner_system만 다른 이름을 주었을 뿐 **묶임 자체는 그대로**.
- `system:data:domain:domain_data` → `definition-service`(4): `definition-catalog-spec`, `definition-taxonomy`, `dual-coordinate-system`, `taxonomy-boundaries` — 동일 패턴.
- `system:flow:operation:process_flow` → `definition-service`(3): `harness-architecture`, `definition-management`, `definition-mgmt-observability-model` — 동일 패턴.
- `system:feature:domain:func_def` → `meta-semantic-system`(4): 신규 합류.
- `system:data:domain:domain_data` → `meta-semantic-system`(3): 신규 합류.

즉 **Phase 0b의 7+4+3 = 14건이 `definition-catalog-spec`에서 `definition-service`로 이름만 바뀌었고**, 여기에 meta-semantic-system 기반 4+3 = 7건의 신규 흡수가 더해졌다.

---

## 그룹별 변화 및 새로 발생한 이슈

### 분류 변화 (resolved / partial / unchanged)

30 baseline 그룹 중 분류가 바뀐 그룹은 **0건** (Phase 0 → 0b도 0건이었음).

### Sub-root 분포가 바뀐 그룹 (2건)

| 그룹 | Phase 0b | Phase 0c |
|---|---|---|
| `system:data:domain:domain_data` (32 docs) | 26 distinct roots, 3 dup sub-groups | 24 roots, 4 dup sub-groups (**악화**) |
| `system:feature:domain:func_def` (32 docs) | 23 distinct roots, 7 dup sub-groups | 21 roots, 7 dup sub-groups |

두 그룹 모두 distinct roots 수가 감소(26→24, 23→21) — owner_system이 pipe/meta-semantic 계열 여러 root를 `meta-semantic-system` 하나로 합치는 효과. 첫 번째 그룹은 dup sub-group이 3 → 4로 악화.

### Edge case: 의미적으로 정당한 이동?

owner_system은 frontmatter에서 문서 작성자가 직접 지정한 필드이므로 **의도 기반 root**라 볼 수 있다. 긍정 사례:

- `pipe-gate`, `pipe-zoom`, `pipe-static-lineage` 등 pipe 계열 9건 → `meta-semantic-system`. 이들은 모두 meta-semantic 시스템의 일부로 설계된 pipe 구현체이므로 frontmatter 의도와 일치.
- `definition-harness`, `definition-quality-gates` 등 → `definition-service`. 이들은 `definition-catalog-spec`가 아니라 **definition-service 인프라**에 속한다는 설계 의도 반영.

부정 사례 / 우려:

- **`meta-semantic-system`의 97건 집중**. 원래 meta-semantic 도메인이 대단히 크기 때문이긴 하지만, *tier=layout인 단일 노드가 97건을 흡수하는 구조*가 다시 등장한다. 이는 Phase 0 리뷰의 원래 문제(`definition-catalog-spec 90건`)와 구조가 동일 — **owner_system은 데이터상 재분배를 할 뿐, 근본적 "하나의 거대 root" 현상은 해결하지 못한다**.
- `system:feature:domain:func_def` 그룹에서 신규 4-dup sub-group 발생 → duplicate-coordinate 그룹 총 수 25 → 26 증가.

### owner_system 데이터 품질 이슈

- 23건이 DB에 없는 `definition-catalog`를 참조 — frontmatter가 구 이름을 사용. tier-redesign 문서 계열로, Phase 1 도입 전에 owner_system 값을 `definition-catalog-spec` 또는 `definition-catalog-system`으로 정리 필요.
- 1,119건 중 948건(84.7%)이 owner_system을 비워둠 — 이 문서들은 모두 link walk에 의존한다. 즉 휴리스틱이 "sometimes runs" 상태.

---

## Phase 1 최종 권고

### 비교 정리

| 선택지 | duplicate 그룹 | 1위 root 흡수 | 집중도 | 권장 |
|---|---|---|---|---|
| **X** (owner_system primary + Q2 fallback) | 26 | 97 (meta-semantic-system) | 가장 나쁨(189건 상위 2개로 수렴) | **비권장** |
| **Y** (Q2 link only — Phase 0b) | 25 | 86 (definition-catalog-spec) | 중간 | 베이스라인으로 채택 |
| **Z** (더 정교한 하이브리드) | — | — | — | **권장** |

### 권고: **Z** — 하이브리드 / 경합 방식

#### 근거

1. **owner_system 1차 승격은 과도 수렴 문제를 해결하지 않는다.** `definition-catalog-spec` 86건을 없앤 대신 `meta-semantic-system` 97건 + `definition-service` 92건이라는 더 나쁜 쏠림을 만들었다. 흡수 집중도(상위 2개 root에 몰리는 건수)가 Phase 0b의 129건(86+43)에서 Phase 0c의 189건(97+92)으로 증가했다.

2. **duplicate-coordinate 그룹 수가 오히려 1건 늘었다(25 → 26).** owner_system은 frontmatter 편의 필드이며 tier/scope/aspect 좌표계와 직교하지 않는다. 단독 1차 소스로 쓰면 좌표 기반 분해 목적(duplicate 감지)을 **방해**할 수 있음이 실측으로 확인됐다.

3. **의미적 이동 자체는 많은 경우 옳다.** `pipe-*` 9건이 `meta-semantic-system`으로 이동한 것은 frontmatter 설계 의도와 일치한다. `definition-service`로 이동한 82건도 `definition-catalog-spec` 소속보다 `definition-service` 소속이 의미적으로 더 정확한 경우가 다수다. 완전히 버릴 신호는 아니다.

4. **그러나 단독 1차 소스로는 부적합.** 15.3% 커버리지로는 link walk가 여전히 84.7%의 경우에 필요하고, owner_system의 집중(96+52 = 148건이 단 2개 값에 몰림)이 직접적으로 root 분포 집중을 야기한다.

#### 구체적 Phase 1 제안

`deriveDomainRoot` 알고리즘을 다음과 같이 구성:

```typescript
deriveDomainRoot(doc, registry):
  // 1. self-check 기존 로직
  // 2. Q2 link walk를 PRIMARY로 사용 (Phase 0b 베이스라인 유지)
  const linkRoot = walkLinkChain(doc, Q2Rule)  // refines > depends_on

  // 3. owner_system을 CROSS-CHECK / OVERRIDE로 사용
  if (doc.owner_system && resolvesToDomainTier(doc.owner_system)) {
    const ownerRoot = doc.owner_system

    // (a) 일치 → 확정 (신호 일치, 신뢰도 상승)
    if (linkRoot === ownerRoot) return { root: linkRoot, confidence: "high" }

    // (b) 불일치 → 정책 선택:
    //   - Phase 1 기본: linkRoot를 사용하되 warning diagnostic 발행
    //     ("owner_system-link-mismatch": doc=X claims owner=Y but link-walk → Z)
    //   - frontmatter 수정 또는 link 보강을 사람에게 돌림
    //   - hop 거리 ≤ 2인 링크 체인이면 linkRoot 채택, 3+ hop이면 ownerRoot 채택 고려
    return { root: linkRoot, confidence: "mixed", divergentOwner: ownerRoot }
  }

  return { root: linkRoot, confidence: "link-only" }
```

이 방식의 장점:

- Phase 0b의 17/10/3 기준선을 유지하면서 owner_system의 의미적 신호를 **검증 신호(diagnostic)**로 활용.
- owner_system에 의한 과도 수렴(97건 meta-semantic-system)을 자동 회피.
- frontmatter-link 불일치를 사람이 정리할 수 있도록 경고로 표면화 — **데이터 품질 개선 루프 제공**.
- Phase 3에서 `definition-catalog-spec`/`meta-semantic-system`/`definition-service` 대형 흡수군의 자동 서브도메인 분할 제안(Phase 0b §Phase 1 권고와 동일)을 그대로 진행.

#### 남은 시뮬레이션 필요

- **Phase 0d**: prefix-match gating(Phase 0b의 후보 1)을 시뮬레이션 — source/target id가 동일 도메인 prefix를 공유하지 않는 link를 root 후보에서 제외. `definition-catalog-spec`가 `skill-*`, `spec-core-*` 같은 다른 도메인을 흡수하는 경로를 차단하는 효과 예상.
- **Phase 0e**: hop-distance penalty(후보 3)를 시뮬레이션 — 2-hop 이상 거리의 root로의 수렴을 억제.

세 휴리스틱(owner_system override, prefix gating, hop penalty)을 독립 flag로 두고 Phase 1 초기에 각각의 효과를 실측한 뒤 조합을 결정하는 것이 가장 안전하다. Phase 0c 결과는 **"1차 소스"로서의 owner_system은 기각**하지만, 검증 및 diagnostic 신호로서는 보존할 가치가 있음을 보여준다.

### 정리

- Phase 1 기본: **Q2 link walk 유지 (Phase 0b 베이스라인)** — `packages/definition-catalog/src/domain-root.ts`에 구현.
- owner_system은 **validation/diagnostic 레이어**로 분리 — 불일치 시 warning.
- prefix-match gating과 hop penalty를 Phase 0d/0e에서 추가 시뮬레이션한 뒤 Phase 2 초기에 도입.
- duplicate-coordinate ≤ 8 목표는 **서브도메인 도입(Phase 3)** 없이는 휴리스틱만으로 달성 불가. 메타-시맨틱 3대 흡수군(`definition-*`, `meta-semantic-*`, `pipe-*`)에 대한 명시적 서브도메인 분할이 필수.

---

## 산출물

- 시뮬레이션 스크립트: `/tmp/domain-root-sim-owner.ts`
- 원시 출력: `/tmp/domain-root-sim-owner-output.json`
- Phase 0b↔0c 비교 스크립트: `/tmp/compare-0b-vs-0c.ts`
- 보조 분석: `/tmp/analyze-0c-absorbers.ts`, `/tmp/check-0c-meta-cluster.ts`, `/tmp/owner-system-coverage.ts`, `/tmp/check-missing-owner.ts`
- 본 리뷰: `docs/proposals/domain-hierarchy/reviews/2026-04-20-phase0c-owner-heuristic.md`
