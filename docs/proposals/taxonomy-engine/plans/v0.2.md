# Taxonomy Engine v0.2 구현 계획

> v0.1 final reviewer 발견 사항 + spec 미구현 + 후속 작업 모두 처리.
> Plan v0.1: `01-plan.md`. Spec: `00-design.md`.

**Goal v0.2:** 라이브러리 완성도 + CLI `tax validate` + lesson-builder 첫 외부 사례 적용.

**Branch:** `feat/taxonomy-engine-v2` (worktree). Base: `main@a7bbf00d` (v0.1 머지 완료).

**Tests baseline:** 41 passed (9 files). 모든 후속 task 추가 후 회귀 없음 필수.

---

## File / Module Structure 변경

### 신규 모듈
- `packages/taxonomy-engine/src/query/index.ts` — slice/traversal API (m-3)

### 신규 fixture
- `packages/taxonomy-engine/__tests__/fixtures/cross-tax-base.yaml` + import 측 yaml (I-2, golden)
- `packages/taxonomy-engine/__tests__/fixtures/duplicate-address.yaml` + golden (I-4)
- `packages/taxonomy-engine/__tests__/fixtures/codegen-basic.yaml` + golden TS files (m-3 spec §8.3)

### 신규 도그푸딩
- `docs/taxonomies/lesson-builder-content.yaml` — lesson-builder 6-layer (Asset/Clip/Cue/Stage/Branch/Scenario)
- `packages/taxonomy-engine/__tests__/dogfooding-lesson-builder.test.ts`

### CLI
- `packages/cli/src/commands/taxonomy.ts`
- `packages/cli/src/command-groups/taxonomy.commands.ts`
- `packages/cli/src/index.ts` (4곳 wiring)
- `packages/cli/src/commands/taxonomy.test.ts`

---

## Task 분해

### Phase A — 라이브러리 fix (T-A1 ~ T-A4)

**T-A1: show() API + TaxonomyDocSchema export (I-1, m-6)**
- `src/query/index.ts` 신규: `show(refStr, registry)` = `parseRef → resolveRef` 통합 wrapper
- `src/index.ts`에 `show`, `TaxonomyDocSchema` 추가 export
- 테스트 1건 (3-tier 입력 모두 같은 결과)

**T-A2: ref-unresolved-import (I-2, cross-taxonomy import 검증)**
- `validateRefs`에 imports 검증 로직 추가: registry에 import target taxonomy 없으면 `ref-unresolved-import` error
- 새 fixture `cross-tax-base.yaml` + `cross-tax-import.yaml` + golden
- 테스트 2건 (registry에 있을 때 OK, 없을 때 error)

**T-A3: inferAxis 일반화 (I-3, depends-on/binds/projects-to)**
- 현재 `inferAxis`는 `upper/parent/lower/child`만 인식
- 일반화 방향: relation kind와 field 위치(첫번째 field → from, 두번째 → to)로 추론. 또는 field 이름이 axis name과 match될 때 자동 매칭
- 가장 단순: rule field 이름이 axes의 name과 같으면 그 axis의 entry로 검증
- 테스트: depends-on/binds/projects-to 각각 broken-ref 검출

**T-A4: 중복 address 검증 (I-4, structural-duplicate-address)**
- 새 validator: `validateAxisStructure(ir)` — 각 axis에서 entry.address 중복 검사
- `structural-duplicate-address` error 발생
- 테스트 1건 + fixture

### Phase B — 라이브러리 확장 (T-B1 ~ T-B5)

**T-B1: query/ 모듈 (m-3, spec §3.1)**
- `slice(ir, axisName, range?): EntryIR[]` — 특정 axis의 entries 일부
- `walkRelation(ir, relName, startEntry): Iterator<Coordinate>` — relation graph 순회
- 테스트 4건

**T-B2: constraint kind 확장 (m-4)**
- 현재 `structural` 1개 패턴만 처리
- `capacity` kind: rule string에서 thresholds 파싱 + 검증
- `ref` kind: rule string의 ref pattern 검증
- `custom` kind: 단순히 warning으로 emit (실행은 caller)
- 테스트 3건

**T-B3: _loc 블록 스타일 지원 (m-2)**
- 현재 `extractLocs`는 inline `entries: [...]`만
- 블록 스타일 (yaml list with `-`) 지원 추가
- 테스트 1건 + 블록 스타일 fixture

**T-B4: codegen 추가 진단 (m-1)**
- `codegen-content-hash-mismatch`: caller가 이전 hash와 다를 때 emit하는 helper 함수
- `version-drift`: registry 두 taxonomy 간 version 충돌 검출
- spec §7.2 codes 활성화
- 테스트 2건

**T-B5: 추가 golden fixture (spec §8.3)**
- `codegen-basic.yaml` + `.golden.ts` (5 파일 골든 비교)
- 결정론 회귀 방지

### Phase C — CLI v0.1 (T-C1 ~ T-C2)

**T-C1: T-10 재개 — CLI `tax validate`**
- v0.1 plan §Task 10 코드 그대로 활용 가능
- workspace symlink 이슈는 main에 머지되어 해소됨
- 테스트 3건 (good/warning/strict)

**T-C2: CLI `tax show` 명령 추가**
- show() API 위 thin wrapper
- 3-tier ref 모두 입력으로 수용
- 테스트 2건

### Phase D — lesson-builder 첫 사례 (T-D1 ~ T-D2)

**T-D1: lesson-builder-content.yaml 작성**
- TAXONOMY.md (`/Users/junwoobang/workflow/pipe-builder/packages/mono-story/packages/lesson-builder/TAXONOMY.md`) 의 6-layer를 yaml로
- 축: layer(7) × type-id(6 asset types) × param-kind(content/control) × clip-id × cue/stage/branch
- relations: layer-contains, clip-binds-asset (cross-layer binding)
- cross-taxonomy import 사용: `imports: [{ taxonomy: qa-sdk-coordinate-system, as: qac }]`로 qa-sdk layer 축 빌려옴 검증

**T-D2: 도그푸딩 테스트 + 통합**
- `__tests__/dogfooding-lesson-builder.test.ts`
- parse + validate(registry에 qa-sdk-coordinate-system 등록) errors=0
- codegen 결정론 + 특정 좌표 확인 (Asset/Clip cross-binding)

---

## 우선순위 + 의존성

```
T-A1 (show) ──┐
T-A2 (cross-tax) ──┐
T-A3 (inferAxis) ──┼── 독립 (병렬 가능)
T-A4 (dup addr) ──┘

T-B1 (query) → T-C2 (CLI show 명령) 의존
T-B2~B5: 라이브러리 독립

T-C1 (CLI validate) → 모든 A/B 완료 후
T-D1, T-D2 → T-A2 + T-B1 완료 필요 (cross-tax + query 사용)
```

## 실행 전략

- Phase A → Phase B → Phase C → Phase D 순차
- 각 phase 안에서 task 순차 (subagent 매번 fresh)
- 각 task: TDD + spec/quality combined review (T-3 이후 패턴) + commit

## 회귀 방지

- 매 commit 후 `pnpm --filter taxonomy-engine test` 41+신규 tests 통과 확인
- 마지막에 build + typecheck

## 제외 (out of scope, 후속 spec)

- Web UI (별도 spec, spec §9)
- DKG PoC (별도 spec)
- frontmatter 승격 (docs/specs/ 이동 — 후속)
- Taxonomy registry 서비스화 (별도 spec)
