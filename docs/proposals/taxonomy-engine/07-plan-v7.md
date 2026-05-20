# Taxonomy Engine v0.7 구현 계획 — 모듈화 라운드

> v0.6 기능 리뷰의 "코드 + 문서 모듈화" 부채 청산.
> Phase K (문서 작은 정리) + L (큰 문서 분해) + M (코드 분해) 묶음.

**Goal v0.7:** spec/문서를 코드 v0.6 현재 상태에 맞춰 재정렬. 코드 모듈도 부피 임박한 곳 분리.

**Branch:** `feat/taxonomy-engine-v7`. Base: main@57c80465.

---

## Phase K — 작은 모듈화 (저비용/고효과, 문서)

- **T-K1**: `docs/proposals/taxonomy-engine/README.md` — 진입 안내 (concepts/plans/modules 위치)
- **T-K2**: plan 7개 → `plans/v0.1.md` ~ `v0.6.md` 서브디렉토리 (links 갱신)
- **T-K3**: supporting concepts 4 분리 — `concepts/constraint.md`, `taxonomy.md`, `registry.md`, `diagnostic.md`
- **T-K4**: `concepts/diagnostics-catalog.md` — 30+ DiagnosticCode 한 표

## Phase L — 신규 기능 spec + 분해 (문서)

- **T-L1**: 00-design.md 분해 — `architecture.md` / `data-model.md` / `reference-grammar.md` / `api-surface.md` / `diagnostics.md` / `testing.md`. 00-design.md는 짧은 overview만
- **T-L2**: 신규 기능 spec 5 — `concepts/doctor.md`, `diff.md`, `query.md`, `codegen-output.md`, `auto-extract.md`
- **T-L3**: `concepts/cli-commands.md` — 7 명령 + 옵션 매트릭스

## Phase M — 코드 분해

- **T-M1**: `packages/cli/src/commands/taxonomy.ts` → `taxonomy/{validate,show,codegen,diff,doctor,git-diff,help,shared}.ts`
- **T-M2**: `src/query/index.ts` → `query/{show,slice,walk-relation,walk-by-coordinate}.ts` + index re-export
- **T-M3**: `src/doctor/extract.ts` → `doctor/extract/{dkg,ingest,vocab,helpers}.ts` + index re-export
- **T-M4**: `src/schema/index.ts` 추가 — 통합 re-export
- **T-M5**: `src/codegen/drift.ts` → `src/drift/index.ts` 별도 모듈 + public export 변경

---

## 실행 순서

```
Phase K (문서, 위험 0) — 병렬 가능
  ↓
Phase L (문서, 큰 분해)
  ↓
Phase M (코드, tax:ci 회귀 검증 필수)
```

K + L은 docs only — tax:ci 영향 없음. M은 매 task tax:ci 통과 확인.

## 회귀 정책

- Phase M 매 task 후 `pnpm tax:ci` 통과
- 코드 분리 후 import path 갱신 — `src/index.ts` public export 변경 없음 (재export 위치만 바뀜)

## 제외 (out of scope)

- 자동 추출 확장 (lesson-builder, qa-sdk-coords)
- Web UI 구현
- Constraint expression DSL
- frontmatter 승격
