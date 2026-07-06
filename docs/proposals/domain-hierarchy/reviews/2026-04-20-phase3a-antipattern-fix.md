---
def:
  id: domain-hierarchy-phase3a-antipattern-fix
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
  sources:
    - packages/definition-catalog/src/validate.ts
    - packages/definition-catalog/src/validate-semantic.test.ts
    - docs/specs/system/link-type-usage.rule.md
    - docs/specs/system/layer-separation.rule.md
status: under-review
date: 2026-04-20
part_of: domain-hierarchy
role: review
---

# Phase 3a — 부모→자식 `depends_on` 안티패턴 교정 시도 (BLOCKED)

## 요약

Phase 3 리포트가 지정한 교정안 — **14개 `*-system` 부모 문서의 자식 대상 `type: depends_on`을 `type: contains`로 치환** — 을 전량 적용해보고 전량 revert했다.

이유: 현행 validator(`packages/definition-catalog/src/validate.ts:231-245`)의 **STC 티어 규칙 `system-contains-system`**이 두 `tier: system` 문서 사이의 `contains`를 **error**로 판정하기 때문이다. 39건 전량 적용 결과 14건의 신규 error가 발생해 baseline(0 errors)을 역행했다.

**판정**: `depends_on → contains` 치환 단독으로는 Phase 3 차단 해제 불가. 자식 문서들의 `tier: system` 재분류(STC level-0 tier redesign) 선행 필요.

---

## 안티패턴 요약

Phase 3의 진단(2026-04-20-phase3-impl.md §"진단: pre-existing depends_on 역방향 안티패턴")에 따르면:

- 부모 `*-system` 문서들이 자신의 자식 서브시스템을 `depends_on`으로 역참조.
- 의미적으로 잘못: "부모가 자식에 의존한다" ≠ "자식은 부모의 일부이다".
- 이 역방향 링크가 있는 상태에서 자식→부모 `depends_on`(Phase 3 목표)을 추가하면 직접 2-노드 사이클 발생 → `circular-ref` error.

Phase 3 리포트의 처방: `depends_on` → `contains`. `contains`는 `cyclicTypes` 집합에 포함되지 않으므로(validate.ts:116) 사이클 탐지에서 제외된다. 이로써 자식→부모 `depends_on`과 부모→자식 `contains`가 공존 가능하다는 기대.

---

## 영향 범위 (시도한 치환)

14 parent systems × 평균 2.8 자식 = 총 39건 시도.

| 부모 | 파일 | 치환 시도한 자식 (개수) |
|---|---|---|
| apm-system | `docs/specs/apm-system/apm-system.md` | apm-codegen-system, apm-schema-system, apm-runtime-system (3) |
| browser-system | `docs/specs/browser-system/browser-system.md` | browser-runtime-system, browser-lifecycle-system (2) |
| df-system | `docs/specs/decision-flow/df-system.md` | df-model-group, df-analysis-group, df-interface-group, df-narrative-group, df-taxonomy (5) |
| gate-system | `docs/specs/gate/gate-system.md` | gate-api, gate-engine-group (2) |
| ingest-system | `docs/specs/ingest/ingest-system.md` | ingest-api-system, admin-api-system, ingest-infra-system (3) |
| motion-workspace-system | `docs/specs/motion-workspace/motion-workspace-system.md` | motion-workspace-service (1) |
| permission-system | `docs/specs/permission/permission-system.md` | permission-model, permission-constraint, perm-external-system, perm-codec-system, perm-migration-system (5) |
| query-system | `docs/specs/query-system/query-system.md` | query-rules (1) |
| scope-nesting-system | `docs/specs/scope-nesting/scope-nesting-system.md` | scope-nesting-provider-patterns, scope-nesting-visualization (2) |
| viz-system | `docs/specs/viz-system/viz-system.md` | viz-language-system, viz-roleplay-system, viz-surface-system (3) |
| wi-system | `docs/specs/weighted-index-system/wi-system.md` | wi-trace-group, wi-pack-format-system (2) |
| decode-system | `docs/specs/decode-system/decode-system.md` | decode-api (1) |
| dkg-system | `docs/specs/dkg-system/dkg-system.md` | dkg-skills-system, dkg-state-store (2) |
| index-meta-system | `docs/specs/index-meta-system/index-meta-system.md` | table-schema-spec, index-meta-store-group, address-separation-group, sdk-scenarios, sdk-system, address-scenarios-group, dx-lifecycle-group (7) |
| **합계** | **14 files** | **39 edits** |

---

## 검증 결과

### Baseline (수정 전)

```
[local] ✓ 검증 통과 (경고 64건)
errors: 0
warnings: 64
duplicate-coordinate: 28
owner-root-mismatch: 7
```

### 39건 치환 직후

```
[local] ✗ 에러 14건, 경고 99건
errors: 14 (신규 system-contains-system)
warnings: 99 (+35, 새로 발생한 contains 경로로 인한 multi-parent 등)
duplicate-coordinate: ? (error로 중단되어 전체 측정 보류)
```

14건의 신규 error 내역 (validator 출력 그대로):

```
apm-system: System이 다른 System을 contains할 수 없음 (apm-codegen-system, apm-runtime-system, apm-schema-system)
browser-system: System이 다른 System을 contains할 수 없음 (browser-lifecycle-system, browser-runtime-system)
decode-system: System이 다른 System을 contains할 수 없음 (decode-api)
df-system: System이 다른 System을 contains할 수 없음 (df-analysis-group, df-interface-group, df-model-group, df-narrative-group, df-taxonomy)
dkg-system: System이 다른 System을 contains할 수 없음 (dkg-skills-system, dkg-state-store)
gate-system: System이 다른 System을 contains할 수 없음 (gate-api, gate-engine-group)
index-meta-system: System이 다른 System을 contains할 수 없음 (address-scenarios-group, address-separation-group, dx-lifecycle-group, index-meta-store-group, sdk-scenarios, sdk-system, table-schema-spec)
ingest-system: System이 다른 System을 contains할 수 없음 (admin-api-system, ingest-api-system, ingest-infra-system)
motion-workspace-system: System이 다른 System을 contains할 수 없음 (motion-workspace-service)
permission-system: System이 다른 System을 contains할 수 없음 (perm-codec-system, perm-external-system, perm-migration-system, permission-constraint, permission-model)
query-system, scope-nesting-system, viz-system, wi-system: 동일 패턴
```

### 전량 revert 후

```
[local] ✓ 검증 통과 (경고 64건)
errors: 0
warnings: 64
```

Baseline 완전 복구.

---

## 근본 원인: STC 티어 규칙과 Phase 3 처방의 충돌

### validator 규칙 (validate.ts:231-245)

```ts
} else if (entry.tier === "system") {
  // System이 다른 System을 contains하면 독립성 위반
  const systemContainsSystem = containsChildren.filter(link => {
    const target = registry.get(link.targetId);
    return target?.tier === "system";
  });
  if (systemContainsSystem.length > 0) {
    issues.push({
      severity: "error",
      type: "system-contains-system",
      ...
      message: `System이 다른 System을 contains할 수 없음 (...) — depends_on 전환 필요`,
    });
  }
}
```

STC 설계의 일관된 철학: **System은 독립 단위**. System이 다른 System을 소유(contains)하면 독립성 위반. System 간 관계는 `depends_on` (의존) 또는 `refs` (Layout의 카탈로그 참조) 만 허용.

### 실측: 치환 대상 자식 39건 전부 `tier: system`

```
apm-codegen-system -> system
apm-schema-system -> system
apm-runtime-system -> system
browser-runtime-system -> system
... (39건 모두)
```

즉 "부모 System이 자식 System을 contains" = 전부 validator가 금지하는 패턴.

### 모순

Phase 3 리포트는 validator의 `cyclicTypes` 집합(`depends_on, implements, refines`)만 보고 `contains`가 해결책이라 판단했다. 그러나 같은 validator의 다른 규칙 `system-contains-system`(tier-level STC 검증)이 이를 금지한다.

**두 규칙을 동시에 만족하는 link type은 존재하지 않는다:**
- `depends_on`: cycle 유발 (Phase 3 차단)
- `contains`: system-contains-system 위반
- `implements`: 사이클 대상 + 의미 왜곡
- `refines`: 사이클 대상 + 의미 왜곡
- `refs`: Layout→System 전용 (양쪽이 System이면 부적합)
- `constrains`/`traces_to`: 의미 부적합

---

## 경계 케이스 — 건드리지 않은 링크

각 부모 문서에는 자식 외에도 peer·cross-domain 링크가 있다. 이들은 `depends_on`이 의미적으로 올바른 의존성이므로 Phase 3 대상이 아니다. 아래는 의도적으로 보존한 링크 목록:

| 부모 | 보존 링크 | 이유 |
|---|---|---|
| browser-system | `ingest-system (depends_on)` | 브라우저 → 수집 서버 cross-domain 의존 |
| df-system | `decision-standard-group (depends_on)` | `df-*` 프리픽스 아님, Phase 3 Category A 미포함 |
| ingest-system | `query-api-spec (depends_on)`, `storage-system (depends_on)` | peer system (query/storage 도메인) |
| permission-system | `auth-permission-integration (depends_on)` | auth 도메인 연계, 자식 아님 |
| query-system | `gate-system (depends_on)` | peer (gate 도메인 의존) |
| viz-system | `canvas-viewport-spec (depends_on)`, `platform-demo-api-spec (depends_on)` | 이름에 `viz-` 프리픽스 없음. canvas-viewport-spec은 동일 ID로 파일 2개 존재(viz-system/canvas-viewport.spec.md vs canvas-viewport-spec.spec.md) — 별도 정리 필요. |
| wi-system | `partial-binder-spec (depends_on)` | 이름에 `wi-` 프리픽스 없음. weighted-index-system 디렉토리에 있지만 Phase 3 Category A에 미포함 |
| decode-system | `registry-system (depends_on)` | peer (registry 도메인) |
| index-meta-system | `registry-system`, `wi-system`, `benchmark-system (depends_on)` | peer/cross-domain (benchmark-system은 `indexing-core-system` 하위) |

---

## Phase 3 차단 해제를 위한 대안

### 옵션 A: STC 티어 재분류 (권장, 큰 작업)

39건 자식 문서의 `tier: system` → 더 낮은 티어(예: `component`, 또는 새 `sub-system` 티어)로 재분류.
- 장점: STC 원칙과 정합. 부모→자식 `contains` 허용됨.
- 단점: 영향 범위 큼. STC 분류 체계 전반 재검토 필요.
- 관련: `docs/proposals/tier-redesign/` 가 이 작업의 일부를 이미 수행 중.

### 옵션 B: 부모→자식 `depends_on` 링크 **제거**

부모 `*-system` 문서의 자식 대상 `depends_on` 링크를 모두 삭제(치환 없음). 부모는 자식을 `^overview` 본문으로만 기술.
- 장점: circular-ref 차단 즉시 해제. system-contains-system error 유발 안 함. 자식→부모 `depends_on`(Phase 3 목표)이 독립적으로 작동.
- 단점: 부모 frontmatter에서 "소속 자식 선언" 기능 상실. 프론트매터만 읽고는 멤버를 알 수 없다. 본문 `^overview`에만 남음.
- 의미론적으로는 **정확함** — 소속(membership)은 자식 방향으로 선언되는 것이 맞다. `depends_on`의 의미(A → B: A가 B에 의존)는 부모→자식 방향에 부합하지 않는다.

### 옵션 C: validator 규칙 수정

`system-contains-system` error를 **warning**으로 강등하거나 동일 도메인 내부에서는 허용. 
- 장점: 기존 문서 수정 없이 Phase 3 진행.
- 단점: STC 설계 철학 훼손. 타 도메인 오염 위험.

### 옵션 D: 새로운 링크 타입 도입

`owns` 또는 `groups` 같은 "같은 티어 System 간 부모-자식 membership" 전용 타입 추가. 사이클 검증 제외.
- 장점: 의미 명확.
- 단점: LinkType 어휘 확장 = 타 도구 생태계 전반 영향.

---

## Phase 3 재개 준비

### sanity test (옵션 B 검증)

옵션 B의 효과를 검증하기 위해 한 쌍(`apm-system` ↔ `apm-codegen-system`)만 수동 시뮬레이션:

1. `apm-system.md`에서 `- target: apm-codegen-system / type: depends_on` 삭제 가정
2. `apm-codegen-system.md`에 `- target: apm-system / type: depends_on` 추가 가정
3. validator 순환 검증 재현: cyclicTypes 경로 상 `apm-codegen-system → apm-system` 단방향만 존재 → **사이클 없음**
4. system-contains-system 규칙은 `contains` 링크 대상이므로 **트리거 안 됨**

옵션 B가 이론적으로 유효함을 정적 분석으로 확인. 실제 적용은 Phase 3 재개 시 전체 47건에 대해 일관되게 수행해야 함.

### 다음 실행 지침

1. **Phase 3 리포트 업데이트** — `2026-04-20-phase3-impl.md` §근본 원인 심층 분석의 "depends_on → contains" 처방이 validator `system-contains-system` 규칙과 충돌함을 기록.
2. **결정 필요** — 옵션 A/B/C/D 중 하나 선택. 옵션 B가 가장 낮은 비용이나 frontmatter 기반 멤버십 선언을 포기해야 함.
3. **옵션 B 선택 시** — 별도 Phase 3b 스크립트로 39건 parent→child `depends_on` 링크 일괄 삭제 + Phase 3 원안의 47건 child→parent `depends_on` 추가를 단일 커밋으로 수행.

---

## 산출물

- 수정된 파일: 없음 (전량 revert)
- 검증 결과: `/tmp/phase3a-after.txt` (39건 적용 시점), `/tmp/phase3a-current.txt` (동일)
- 본 리포트: `docs/proposals/domain-hierarchy/reviews/2026-04-20-phase3a-antipattern-fix.md`

## 참조

- [2026-04-20-phase3-impl.md](./2026-04-20-phase3-impl.md) — Phase 3 차단 원인 분석
- validator 규칙:
  - `packages/definition-catalog/src/validate.ts:116-131` — circular-ref 탐지 (cyclicTypes)
  - `packages/definition-catalog/src/validate.ts:231-245` — system-contains-system error
  - `packages/definition-catalog/src/validate.ts:386-405` — system-contains-system warning (module/system 양쪽 체크)
- [docs/CONVENTIONS.md](../../../CONVENTIONS.md) — LinkType 어휘
- [docs/proposals/tier-redesign/](../../tier-redesign/) — 티어 재분류 진행 중 (옵션 A 관련)
