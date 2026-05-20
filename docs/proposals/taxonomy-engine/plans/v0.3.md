# Taxonomy Engine v0.3 구현 계획 — 피드백 응답

> v0.2 review에서 발견한 Critical/Important 5건 처리. **CI는 로컬 게이트 스크립트로** 구성 (GitHub Actions 후속).

**Goal v0.3:** 피드백 응답 — walkByCoordinate / 도그푸딩 강화 / _loc AST / 로컬 CI / Constraint DSL.

**Branch:** `feat/taxonomy-engine-v3` (worktree). Base: main@4e7f9c9c (v0.2 + concepts split 완료, 80+5 tests).

---

## Task 분해 (Phase E)

### T-E1: walkByCoordinate API (피드백 C)

**문제:** 현재 `walkRelation(ir, relName, startId)`는 entry id만 yield. coordinate-aware 아님. cross-axis 흐름 추적 못 함.

**해결:**
- `walkByCoordinate(ir, relName, startCoord): IterableIterator<Coordinate>` — 좌표점에서 시작해 relation 따라 좌표점을 yield
- relation rules의 from/to axes subset만 사용해 매칭
- 순환 방지 (visited Set, packed coordinate key)

**Files:**
- Modify: `packages/taxonomy-engine/src/query/index.ts`
- Modify: `packages/taxonomy-engine/src/index.ts` (export 추가)
- Modify: `packages/taxonomy-engine/__tests__/unit/query.test.ts` (테스트 3건)

**의존성:** packCoordinate (T-4)

### T-E2: 도그푸딩 검증 강화 (피드백 D)

**문제:** lesson-builder yaml과 mono-story 코드 사이 drift 가능. qa-sdk yaml과 def-catalog 코드 비교가 표층.

**해결:**
- `packages/taxonomy-engine/src/doctor/index.ts` — yaml ↔ 외부 SSOT 비교 helper
- 첫 사례: qa-sdk-coordinate-system.yaml의 scope/aspect/depth/level/layer entries를 hardcoded 기대값과 비교 (def-catalog 코드는 qa-sdk 다른 패키지의 ts 파일에서 추출 — 너무 복잡, 기대값 fixture로 시작)
- 진단 코드: `doctor-drift` warning (예상값과 다름) + `doctor-missing` error (예상 entry 누락)

**Files:**
- Create: `packages/taxonomy-engine/src/doctor/index.ts`
- Create: `packages/taxonomy-engine/__tests__/fixtures/expected-qa-sdk-coords.json` (기대값 SSOT)
- Create: `packages/taxonomy-engine/__tests__/unit/doctor.test.ts`
- Modify: `packages/taxonomy-engine/src/index.ts`

### T-E3: _loc AST 기반 재작성 (피드백 A)

**문제:** regex 휴리스틱 → multi-line description, nested 객체, comments 등에서 silent miss.

**해결:**
- `js-yaml` library의 `load` 호출에 line/column tracking 옵션 활용
- 또는 `yaml` (eemeli/yaml) 라이브러리로 교체 — AST 노드의 `range` 활용
- 새 dep 추가 부담 vs 정확성 trade-off. 일단 js-yaml의 `listener` API 우선 시도, 안 되면 외부 lib

**Files:**
- Modify: `packages/taxonomy-engine/src/parser/index.ts` (extractLocs 재구현)
- Modify: `packages/taxonomy-engine/__tests__/unit/parser.test.ts` (테스트 — block style, multi-line description, nested object 모두)
- 옵션: `packages/taxonomy-engine/package.json` 새 dep

**복잡도 주의:** 큰 재작성. implementer가 BLOCKED 가능성 있음. 그 경우 js-yaml AST 활용 또는 외부 라이브러리 도입을 controller가 결정.

### T-E4: 로컬 CI 게이트 스크립트 (피드백 F, 로컬 방식)

**문제:** 도그푸딩 회귀 방지 CI 게이트 없음. GitHub Actions는 후순.

**해결:** 로컬에서 `pnpm tax:ci` 한 번으로 모든 게이트 실행.

게이트 항목:
1. `pnpm --filter taxonomy-engine build` — 빌드 통과
2. `pnpm --filter taxonomy-engine typecheck` — 타입 무오류
3. `pnpm --filter taxonomy-engine test` — 80+ tests 통과
4. `pnpm --filter @qa-sdk/cli test taxonomy.test` — CLI 통합 5 tests
5. `node scripts/tax-validate-fixtures.mjs` — `docs/taxonomies/*.yaml` 모두 errors=0 검증
6. `node scripts/tax-doctor.mjs` — 외부 SSOT drift 점검 (T-E2 활용)
7. `node scripts/tax-codegen-drift.mjs` — codegen contentHash 변경 여부 체크 (이전 hash와 비교, lockfile 형태로 보존)

**Files:**
- Create: `scripts/tax-validate-fixtures.mjs`
- Create: `scripts/tax-doctor.mjs`
- Create: `scripts/tax-codegen-drift.mjs`
- Modify: `package.json` (root scripts에 `tax:ci` 추가)
- Create: `docs/taxonomies/.codegen-hashes.json` (현재 hash lockfile, gitignore 아님)

**문서:**
- README에 "로컬 CI 실행 방법" 짧게 안내

### T-E5: Constraint DSL 재설계 (피드백 B)

**문제:** rule string의 regex 매칭은 한계. 표현력 부족 + invisible 형식.

**해결:**
- constraint rule을 **구조화된 객체**로 재설계 (v0.3 schema bump)
- 형식: `{ kind, expr: { left, op, right } }` 또는 yaml DSL 형식
- 첫 표현력 범위:
  - capacity: `axes.<name>.entries.length` 비교
  - structural: `axis.entry` 위치 제약 (Relation 안에서 어디 등장 불가)
  - ref: axis 존재 보장
- 기존 string-based rule도 backward compat (deprecated warning emit)

**Files:**
- Modify: `packages/taxonomy-engine/src/schema/zod.ts` (constraint.rule type 확장)
- Modify: `packages/taxonomy-engine/src/schema/ir.ts` (ConstraintIR 확장)
- Modify: `packages/taxonomy-engine/src/validate/constraint.ts` (양쪽 형식 evaluator)
- Modify: 모든 yaml fixture의 constraint를 새 형식으로 migration (optional, 부분만)
- Test 4-5건

**복잡도:** 가장 큰 task. yaml schema 변경 + migration. 시간 들면 별도 spec으로 분리 가능.

---

## 실행 순서

```
T-E1 (walk) ──┐
T-E2 (doctor) ┤── 독립 (병렬 가능)
T-E3 (_loc)  ──┘

T-E4 (CI) → T-E1, T-E2 완료 필요 (스크립트가 use)
T-E5 (DSL) → 독립, 마지막 (가장 큼)
```

## 회귀 정책

- 매 task 후 `pnpm --filter taxonomy-engine test` + cli test 통과
- T-E4 완료 시점 `pnpm tax:ci`가 의미 있는 게이트로 동작해야

## 제외 (out of scope)

- Web UI (별도 spec)
- DKG PoC
- GitHub Actions yml — 로컬 CI 검증 후 후속
- frontmatter 승격
- Registry 서비스화
