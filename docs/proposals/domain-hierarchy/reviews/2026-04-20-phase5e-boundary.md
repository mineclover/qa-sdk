---
def:
  id: domain-hierarchy-phase5e-boundary
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
date: 2026-04-20
part_of: domain-hierarchy
role: review
---

# Phase 5e — `@def.boundary` 재배선으로 3 layout 승격 해제

## 목적 ^purpose

Phase 5c 에서 보류된 3 그룹(viz-system-root · gate-system · definition-service) 의 layout 승격을 집행한다. 세 parent 문서를 가리키는 `@def.boundary` 주석(총 101 건) 때문에 승격 시 `invalid-code-boundary` 에러가 대량 발생하던 문제를, 소스 boundary 재지정(Strategy A) · validator 완화(Strategy B) 의 hybrid(Strategy C) 로 해소한다.

## 인벤토리 요약

| System | Refs | 분포 | 후보 child | 선택 전략 |
|---|---|---|---|---|
| viz-system-root | 72 | viz-3d(36) / viz-web(23) / viz-core(13) | viz-system, viz-language-system, viz-surface-system, viz-roleplay-system | **B** (validator 완화) |
| gate-system | 23 | gate-service/src/** | gate-engine-group(svc=index-meta · 다른 코드), gate-state-model | **B** (validator 완화) |
| definition-service | 6 | definition-service/src/** | definition-service-system(같은 서비스의 tier=system root) | **A** (재지정) |

## 전략 선정

### definition-service → Strategy A (re-point)

`definition-service` 는 `scope: interface / aspect: api_contract`(API 계약 스펙) 이고, 정작 서비스 수준 umbrella 는 `definition-service-system`(scope: feature / aspect: func_def · tier: system) 이다. 소스 6 파일은 계약이 아니라 서비스 구현이므로, `definition-service-system` 로 재지정하는 것이 **의미론적으로 더 올바름**.

재지정 후 `definition-service` 의 boundary ref 는 0 이 되어 layout 승격이 안전.

### gate-system → Strategy B (validator relaxation)

gate-service/src/** 23 파일 모두가 서비스 패키지 umbrella 를 지칭한다. `gate-engine-group` 은 index-meta 패키지의 GateEngine 라이브러리(svc=index-meta, 다른 코드 위치) 를 가리키므로 boundary 가 될 수 없고, gate-service 를 대체할 다른 tier=system 문서도 없다. "서비스 패키지 umbrella" 는 layout tier 가 의미적으로 적합하다.

### viz-system-root → Strategy B (validator relaxation 재사용)

72 파일이 viz-3d / viz-web / viz-core 3 개 패키지에 분산되어 있어 각 파일을 세분화된 child(viz-surface-system / viz-roleplay-system / viz-language-system 등) 로 재지정하려면 fine-grained 경계 판단이 필요하다. `viz-system-root` 는 이름 그대로 viz 영역 umbrella 이므로 layout 이 적합하며, 이미 gate-system 에서 도입한 validator 완화를 재사용한다.

## Validator 변경 — layout 도 code boundary 허용

`packages/definition-data-source/src/local-data-source.ts`:

```diff
-      const isBoundaryEligible = doc.level === "group" || doc.level === "module" || doc.tier === "system";
+      const isBoundaryEligible =
+        doc.level === "group" ||
+        doc.level === "module" ||
+        doc.tier === "system" ||
+        doc.tier === "layout";
       if (ref.relationType === "boundary" && !isBoundaryEligible) {
         issues.push({
           severity: "error",
           type: "invalid-code-boundary",
           docId: ref.docId,
-          message: `boundary reference "${ref.codePath}"는 group/module 또는 tier:system 문서를 가리켜야 함`,
+          message: `boundary reference "${ref.codePath}"는 group/module 또는 tier:system/layout 문서를 가리켜야 함`,
         });
       }
```

`resolveBoundaryAnchor` 내부 `isBoundaryDoc` 헬퍼에도 동일하게 `tier === "layout"` 을 추가해 boundary anchor 파생이 layout 에서 멈추게 한다.

**의미론적 근거**: layout 은 "여러 system 을 묶는 umbrella" 이며 서비스 패키지 레벨 정체성(gate-service, viz-system, definition-service API) 을 자연스럽게 표현한다. 따라서 code 의 소속 boundary 가 layout 레벨인 것은 정당하다.

## Shadow 결과 — definition-service (6 파일)

1. 6 파일에서 `@def.boundary definition-service` → `@def.boundary definition-service-system`:
   - `packages/definition-service/src/main.ts`
   - `packages/definition-service/src/app.module.ts`
   - `packages/definition-service/src/sync/reverse-sync.ts`
   - `packages/definition-service/src/modules/docs/docs.service.ts`
   - `packages/definition-service/src/modules/search/search.service.ts`
   - `packages/definition-service/src/modules/sync/sync.service.ts`
2. `docs/specs/definition-catalog/definition-service.spec.md`:
   - `tier: system` → `tier: layout`
   - `refs: definition-service-sync` 추가 (layout 은 `refs` 필수)
3. 검증 결과: errors=0, warnings 45→44, dup-coord 21→20 ✓

Shadow 성공으로 validator 완화 + promotion pattern 을 확정.

## Batch 적용 결과

### gate-system (23 파일 + 1 문서)

- validator 는 shadow 단계에서 이미 완화됨 (소스 파일 수정 불필요)
- `docs/specs/gate/gate-system.md`:
  - `tier: system` → `tier: layout`
  - 5 개 `contains` 링크(gate-state-model, gate-engine-func, gate-flow, gate-constraint, gate-scenario) 를 `refs` 로 변환
  - `traces_to: gate-state-model-rule` 는 유지
- 소스 파일 변경 없음 (boundary 는 그대로 `gate-system` 를 가리키고, validator 가 이제 layout 을 허용함)

### viz-system-root (72 파일 + 1 문서)

- `docs/specs/viz-system-root.spec.md`:
  - `tier: system` → `tier: layout`
  - 기존 `depends_on: viz-system` 유지
  - `refs` 4 개 추가: viz-system, viz-language-system, viz-surface-system, viz-roleplay-system
- 소스 파일 변경 없음

## 검증 결과

| 지표 | Before (5d 완료) | After (5e) | Δ |
|---|---|---|---|
| errors | 0 | 0 | 0 |
| warnings | 45 | 42 | **-3** |
| duplicate-coordinate | 21 | **18** | **-3** |
| multi-parent | 15 | 15 | 0 |
| orphan | 7 | 7 | 0 |
| level-violation | 2 | 2 | 0 |
| owner-root-mismatch (info) | 0 | 0 | 0 |
| system-contains-system | 0 | 0 | 0 |
| invalid-code-boundary | 0 | 0 | 0 |

해제된 dup-coord 그룹 3건:

1. `system:ui:experience:layout` @ `canvas-viewport-spec` — `[canvas-viewport-spec, viz-system-root]` → viz-system-root 가 layout 으로 분리
2. `system:feature:domain:func_def` @ `gate-system` — `[gate-engine-group, gate-system]` → gate-system 이 layout 으로 분리
3. `system:interface:operation:api_contract` @ `definition-catalog-spec` — `[definition-service, definition-service-sync]` → definition-service 가 layout 으로 분리

## TypeScript / 빌드 상태

- `pnpm --filter definition-catalog build` ✓
- `pnpm --filter definition-data-source build` ✓
- `pnpm --filter @qa-sdk/cli build` ✓
- `pnpm --filter definition-catalog exec tsc --noEmit` ✓ (0 errors)
- `pnpm --filter definition-data-source exec tsc --noEmit` ✓ (0 errors)

주의: `@qa-sdk/definition-service` / `gate-service` / `viz-3d` tsc 는 사전 존재하는 type 에러(env.ts 의 getRequiredServicePort · sync-engine.ts · tsconfig module type) 가 있으나 본 작업과 무관. 본 작업은 주석 라인 + frontmatter 만 수정하여 타입 시그너처에 영향 없음.

## 향후 `@def.boundary` 가이드

1. **boundary 대상은 tier: system 또는 tier: layout 이어야 함** — component/entry 는 금지.
2. **서비스 패키지 umbrella 수준의 경계는 tier: layout** 을 권장.
   - 예: `gate-service/*` → `@def.boundary gate-system` (layout)
   - 예: `viz-*/src/**` → `@def.boundary viz-system-root` (layout)
3. **구체적 sub-system 경계는 tier: system** 을 권장.
   - 예: `definition-service/src/modules/**` → `@def.boundary definition-service-system` (system)
4. **interface/api_contract 문서는 boundary 대상으로 부적합** — 서비스 구현 코드는 서비스 system/layout 문서를 가리켜야 함(spec 은 계약 텍스트).

## 가역성 / 롤백

- validator: `tier === "layout"` 추가분만 제거하면 원복.
- 3 개 spec.md: `tier: layout` → `tier: system` + `refs` 링크 제거로 원복.
- 6 개 소스 파일: `@def.boundary definition-service-system` → `@def.boundary definition-service` 로 1:1 재치환.

## 산출물

- validator 변경: `packages/definition-data-source/src/local-data-source.ts`
- 문서 변경 3건:
  - `docs/specs/definition-catalog/definition-service.spec.md` (tier + refs)
  - `docs/specs/gate/gate-system.md` (tier + contains→refs)
  - `docs/specs/viz-system-root.spec.md` (tier + refs)
- 소스 변경 6건 (Strategy A 재지정):
  - `packages/definition-service/src/main.ts`
  - `packages/definition-service/src/app.module.ts`
  - `packages/definition-service/src/sync/reverse-sync.ts`
  - `packages/definition-service/src/modules/docs/docs.service.ts`
  - `packages/definition-service/src/modules/search/search.service.ts`
  - `packages/definition-service/src/modules/sync/sync.service.ts`
- 로그: `/tmp/phase5e-before.txt`, `/tmp/phase5e-before-audit.txt`, `/tmp/phase5e-after.txt`, `/tmp/phase5e-by-domain.txt`
- 본 보고서: `docs/proposals/domain-hierarchy/reviews/2026-04-20-phase5e-boundary.md`

## 참조

- [2026-04-20-phase5c-abstract.md](./2026-04-20-phase5c-abstract.md) — 보류 사유 정의
- [2026-04-20-phase5d-cleanup.md](./2026-04-20-phase5d-cleanup.md) — 직전 상태(21 dup-coord, 45 warnings)
- [2026-04-20-phase5-redesign.md](./2026-04-20-phase5-redesign.md) §Class A — 그룹 분류
- `packages/definition-data-source/src/local-data-source.ts` §"invalid-code-boundary" — validator 완화 지점
- `packages/definition-catalog/src/validate.ts` §"tier layout refs 필수" — layout → refs 강제 규칙
