# Taxonomy Engine v0.5 구현 계획 — 자동화 라운드 + Web UI 시작

> v0.4 리뷰 결과. Phase H (자동 추출 확장 + diff rule-level) + Phase I (Web UI brainstorming spec).

**Goal v0.5:**
- Phase H: expected fixture 자동 추출을 모든 도그푸딩에 — doctor가 진짜 일하게 (N-5 해결)
- Phase H: diff rule-level (N-7)
- Phase I: Web UI **brainstorm + spec만** (구현 X — 별도 후속)

**Branch:** `feat/taxonomy-engine-v5`. Base: main@137e892f (v0.4 머지 완료, 123 lib + 12 cli tests + tax:ci OK).

---

## Phase H — 자동화 라운드

### T-H1: ingest expected 자동 추출 (가장 쉬움)

`docs/specs/ingest/ingest-infra-system/store-adapter-parity.spec.md`의 markdown 표에서 store-driver/store-kind/store-coverage 추출.

기존 `extractIdsFromMarkdownTable` 헬퍼 재사용. 단 표 구조 확인 필요 — DKG와 다른 형태일 수 있음.

**Files:**
- Modify: `packages/taxonomy-engine/src/doctor/extract.ts` — `extractIngestExpected` 추가
- Modify: `scripts/tax-doctor-extract-dkg.mjs` → `tax-doctor-extract.mjs`로 일반화 (또는 별도 ingest script)
- Modify: `__tests__/unit/doctor-extract.test.ts` — ingest 추출 테스트
- 자동 추출 결과가 기존 hardcoded fixture와 일치 검증

### T-H2: lesson-builder expected (부분 — markdown 헤더에서)

원본 `/Users/junwoobang/workflow/pipe-builder/.../TAXONOMY.md`는 별도 repo. 두 옵션:
- (a) repo 외부 file 직접 read (path 하드코딩)
- (b) qa-sdk repo 안에 `docs/taxonomies/lesson-builder-sources/TAXONOMY.md` 복사 + sync 정책 명시
- (c) skip — lesson-builder는 외부라 자동화 어려움 인정

**선택**: (a) — 직접 path. 단점: 다른 환경에서 path 다름 → CI 게이트에서 옵션 처리. doctor 자체는 fixture만 의존하니 OK.

만약 (a) 어려움 (markdown 구조 가공 필요) → skip.

### T-H3: qa-sdk-coordinate-system expected (TS 코드에서)

def-catalog/spec-core의 ScopeId/AspectId 등 TS enum/const에서 추출. ts-morph 또는 정규식 파서. 가장 복잡.

**Files:**
- Modify: `packages/taxonomy-engine/src/doctor/extract.ts` — `extractTsEnumIds(filePath, exportName)` 추가
- 또는 별도 lib (ts-morph 추가) — dep 부담
- scripts/tax-doctor-extract-qa-sdk.mjs

가능성 검증: 먼저 qa-sdk의 ScopeId/AspectId 정의 위치 grep. TS enum vs union vs const 어느 형식인지에 따라 파서 난이도 다름.

### T-H4: diff rule-level 확장 (N-7)

기존 `relation-rules-count-changed` (count만) → `relation-rule-added`/`relation-rule-removed`/`relation-rule-changed` 추가.

rule 비교 방식:
- rule 객체를 stable key로 hashing (sorted JSON)
- 같은 hash → 같음, 다른 hash → 다름
- rule 객체 자체의 어떤 key가 바뀌었는지는 별도 (deep diff 후속)

**Files:**
- Modify: `packages/taxonomy-engine/src/diff/index.ts`
- Modify: `packages/taxonomy-engine/__tests__/unit/diff.test.ts`

---

## Phase I — Web UI 시작 (brainstorm + spec만)

### T-I1: Web UI brainstorming → spec

별도 brainstorming session:
- 사용 사례 (어떤 화면이 어떤 정보 보여줘야)
- 기술 선택 (정적 사이트? React? Svelte? 별도 서버?)
- 라이브러리 API 활용 (Registry/show/slice/walkByCoordinate/diff)
- 데이터 흐름 (yaml → IR → JSON → 브라우저)
- 첫 출시 범위 (탐색만? 시각화 그래프? 편집?)

산출:
- `docs/proposals/taxonomy-web/00-design.md`
- 구현은 별도 PR/세션

**이 plan에서는 brainstorming 호출만, 구현은 후속**.

---

## 실행 순서

```
T-H1 (ingest) — 가장 쉬움, 첫 시작
T-H2 (lesson-builder) — 시도 가능 여부 확인 후 결정
T-H3 (qa-sdk) — 가장 복잡, 마지막
T-H4 (diff rule-level) — 독립

T-I1 (Web UI brainstorm) — 라이브러리 작업과 병행 가능 (별도 session)
```

## 회귀 정책

- 매 task 후 `pnpm tax:ci` 통과
- 자동 추출이 hardcoded와 정확히 일치 (drift 0)
- diff rule-level 확장 후 기존 diff 테스트 회귀 X

## 제외 (out of scope)

- N-8 relation rule 압축 표현 (별도 spec)
- N-4 Constraint expression DSL (사용 사례 5+건 후)
- N-9 spec ↔ 코드 doctor full 자동화 (큰 작업)
- N-6 --registry codegen 다중 출력
- Web UI **구현** (이 plan은 spec만)
- frontmatter 승격
