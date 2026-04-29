---
def:
  id: aspect-schema-hierarchy-01-migration
  type: knowledge
  knowledge_kind: proposal
  lifecycle: review
  owner_system: definition-catalog
  projection_plane: intent
  scope: meta
  aspect: proposal_design
  tier: system
  depth: implementation
  links:
    - target: aspect-schema-hierarchy-readme
      type: depends_on
status: under-review
date: 2026-04-21
part_of: aspect-schema-hierarchy
role: migration
---

# Aspect Schema Hierarchy — 롤아웃 계획 (Phase C-0 ~ C-4)

## 목적 ^purpose

[00-design.md](./00-design.md) 에서 선택한 **Option C-1 (aspect_parents metadata table)** 을 **비파괴적·가역적 단계** 로 도입한다. 각 단계는 (a) 목적, (b) 작업 내용, (c) 성공 기준, (d) 롤백 경로, (e) 의존 조건, (f) 예상 공수를 가진다. Phase C-2 이후는 실증 수요 (rollup 요구 ≥ 3) 에 의존하며 중단/연기 가능.

"C-" prefix 는 [aspect-vocab-split](../aspect-vocab-split/) Phase A/B 와 구분용 (C = schema hierarchy 고유 phase).

## 단계 요약

| 단계 | 목적 | 타입 | 가역성 | 의존 | 예상 공수 |
|---|---|---|---|---|---:|
| C-0 | `aspect_parents` 테이블 추가 + populate | schema + code | 완전 | — | 1-2 일 |
| C-1 | Validator bridge + insert-on-discovery | code | 완전 | C-0 | 1-2 일 |
| C-2 | Rollup API + CLI 통합 | code | 완전 | C-1, 수요 ≥ 3 | 1-2 일 |
| C-3 | Runtime map deprecation | code | 완전 | C-2 완료 + 1 릴리즈 후 | 0.5 일 |
| C-4 | (선택) Full aspects dimension | schema + code | 복합 | C-3, 수요 재측정 | 별도 RFC |

## Phase C-0 — Schema Introduction (non-breaking)

### 목적 ^c0-purpose

`aspect_parents` 테이블 스키마를 `definition-service` 에 추가하고 Phase 5b B-0 의 `ASPECT_PARENTS` map 을 bulk populate. **validator 동작은 변경하지 않는다** — runtime map 만으로 계속 작동.

### 작업 내용 ^c0-work

1. **Drizzle 스키마 추가** — `packages/definition-service/src/db/schema.ts`:
   - `aspectParents` sqliteTable 정의 (DDL: [02-schema-diff.md](./02-schema-diff.md) §"After")
   - `AspectParentRow` 타입 export
   - `idx_ap_parent` 인덱스 선언
2. **Migration 스크립트** — `packages/definition-service/migrations/` 에 SQL 추가:
   - `CREATE TABLE IF NOT EXISTS aspect_parents ...`
   - `ASPECT_PARENTS` map 을 import 하여 INSERT 17 rows (idempotent — ON CONFLICT DO NOTHING)
   - description 은 `DEFINITION_TAXONOMY` 의 aspect description 을 join 하여 채움 (옵션)
3. **Populate 로직** — service 부팅 시 `aspect_parents` 가 비어있거나 map 과 drift 있으면 자동 sync (idempotent). 상세: [02-schema-diff.md](./02-schema-diff.md) §"Populate script".
4. **테스트** — `aspect-parents.test.ts` (신규) — populate 후 row 수 = `Object.keys(ASPECT_PARENTS).length` 검증.

### 성공 기준 ^c0-success

- `pnpm --filter definition-service build` 성공
- `pnpm --filter definition-service test` 성공 (신규 테스트 포함)
- service 부팅 후 `SELECT COUNT(*) FROM aspect_parents` = 17
- `pnpm exec qa-sdk def sync` / `def validate` 결과 변화 없음 (errors=0 유지, dup-coord 동일)
- 기존 모든 테스트 통과 (regression 없음)

### 롤백 ^c0-rollback

- Drizzle 스키마에서 `aspectParents` 제거 + `DROP TABLE aspect_parents` SQL 추가 migration.
- 코드는 runtime map 만으로 계속 작동 (C-0 은 validator 경로 미변경) — regression 없음.

### 의존 ^c0-dependencies

없음. 본 단계는 단독 실행 가능.

## Phase C-1 — Validator Bridge (graceful fallback)

### 목적 ^c1-purpose

Validator / aspect lookup 경로가 DB 를 **우선 조회** 하도록 전환. DB 미존재 / 테이블 빈 상태 / drift 탐지 시 runtime map fallback. **Fail-open** 원칙.

### 작업 내용 ^c1-work

1. **Service-level helper 도입** — `packages/definition-service/src/core/aspect-registry.ts` (신규):
   ```
   async getAspectParent(child: string): Promise<string | null>
   async getChildrenOf(parent: string): Promise<string[]>
   ```
   - DB 조회 → 결과 없음 시 `deriveAspectParent()` (catalog) fallback
   - DB 조회 실패 (연결 오류) 시 warning log + fallback
2. **Insert-on-discovery** — `reverse-sync.ts` / `def sync` 파이프라인에 hook 추가:
   - sync 시작 시 `ASPECT_PARENTS` map 과 DB 의 `aspect_parents` 테이블 비교
   - map 에 있는데 DB 에 없으면 UPSERT (자가 치유)
   - DB 에 있는데 map 에 없으면 warning (drift 탐지) — 삭제는 금지 (수동 검토)
3. **Catalog 패키지 불변** — `deriveAspectParent` 는 그대로. 패키지 의존 방향 유지 (catalog → DB 없음).
4. **registry-service 연동** — `/catalogs/definition/aspects/:id/parent` 엔드포인트 추가 (선택, Q1 에 따라 service 응답 경로)

### 성공 기준 ^c1-success

- service 재시작 후 DB 가 비어있어도 validator 가 정상 작동 (fallback 경로 통과)
- `aspect_parents` 테이블을 수동으로 DROP 한 상태에서도 `def validate` errors=0
- DB / map drift 로그가 적절히 발생 (단위 테스트로 확인)
- `aspect-registry.test.ts` (신규) — DB 경로, fallback 경로, drift 경로 3 case 통과

### 롤백 ^c1-rollback

- `aspect-registry.ts` 제거 + validator 호출부를 `deriveAspectParent` 직접 호출로 복원
- `ASPECT_PARENTS` map 이 영속 유지되므로 revert 비용 최소

### 의존 ^c1-dependencies

- C-0 완료 필수 (테이블 존재해야 bridge 가 의미있음)

## Phase C-2 — Rollup API + CLI (수요 도달 시 개시)

### 목적 ^c2-purpose

`getAspectFamily` API 를 정식 도입하고 CLI 에 `--include-children` / `--rollup-aspect` 플래그를 노출. **실증 수요 (rollup 요구 ≥ 3) 도달 후에만 개시**.

### 작업 내용 ^c2-work

1. **`getAspectFamily` 구현** — `aspect-registry.ts`:
   ```
   async getAspectFamily(aspect: string): Promise<readonly string[]>
   ```
   - 부모 aspect 입력 → `[parent, ...children]`
   - 자식 / 최상위 입력 → `[aspect]` 만
   - 2 레벨 전제 (00-design Q5)
2. **CLI 통합** — `packages/cli/src/commands/def-list.ts` + `def-audit.ts`:
   - `def list --aspect <x> --include-children` — family 전체 문서 반환
   - `def audit --rollup-aspect <x>` — family 의 dup-coord 집계
3. **GraphQL 노출** (선택) — `doc.resolver.ts` 에 `Query.aspectFamily(id)` 추가
4. **테스트** — CLI snapshot 테스트, API round-trip 테스트

### 성공 기준 ^c2-success

- `def list --aspect func_def --include-children` 이 40+ 문서 반환 (7 자식 aspect + 부모)
- `def audit --rollup-aspect process_flow` 가 5 개 자식 + 부모 기준 dup-coord 집계 정확
- `pnpm --filter cli test` 통과

### 롤백 ^c2-rollback

- CLI 플래그 제거 + API method 제거. DB / 스키마는 그대로.

### 의존 ^c2-dependencies

- C-1 완료
- **실증 수요 확인** — CHANGELOG 또는 issue tracker 에서 rollup 요구 ≥ 3 건 누적

## Phase C-3 — Runtime Map Deprecation

### 목적 ^c3-purpose

`ASPECT_PARENTS` map + `deriveAspectParent()` 에 JSDoc `@deprecated` 추가. 신규 코드는 service helper (`aspect-registry.getAspectParent`) 사용하도록 유도. **1 릴리즈 cycle 동안 fallback 으로 유지** 후 C-4 또는 영구 보존 결정.

### 작업 내용 ^c3-work

1. **JSDoc 추가** — `packages/definition-catalog/src/vocabulary.ts`:
   ```
   /**
    * @deprecated (Phase C-3, 2026-04-21) — `aspect-registry.getAspectParent` 사용 권장.
    * DB 가 SSOT 이지만 본 map 은 build-time 검증 및 catalog 패키지의 순수성 유지를 위해 영속 유지.
    */
   export const ASPECT_PARENTS = { ... };
   
   /** @deprecated 동일 사유 */
   export function deriveAspectParent(...) { ... }
   ```
2. **내부 호출부 업데이트** — service/CLI 코드에서 `deriveAspectParent` 호출을 `aspect-registry.getAspectParent` 로 이전 (test-only 제외)
3. **README 업데이트** — `aspect-vocab-split/01-migration.md` §"Phase C" 의 map 언급을 "deprecated, fallback only" 로 업데이트

### 성공 기준 ^c3-success

- TypeScript build 에서 deprecated 경로 사용처 warning 확인
- 기존 코드 regression 없음
- Catalog 패키지의 순수성 유지 확인 (DB 의존 미도입)

### 롤백 ^c3-rollback

- JSDoc 제거 1 커밋. 기능 변화 없음.

### 의존 ^c3-dependencies

- C-2 완료 + 1 릴리즈 cycle 경과 (regression 관찰 기간)

### 후속

- 제거 시점 미정. Q: "map 을 영구 유지할 것인가?" 는 Phase C-4 결정과 묶임.
- 현재 권장: **영구 유지** — catalog 패키지 순수성 보장 + build-time 검증 가능.

## Phase C-4 — Full aspects dimension (별도 RFC)

### 트리거

- 다음 중 2+ 조건 충족 시 C-4 개시:
  - aspect 수 ≥ 60
  - Runtime-only aspect 추가 수요 (PR 없이 DB 만으로 추가) 발생
  - scope 축도 동일 승격 요구 발생 (패턴 재사용 가치)
  - deprecation tracking (Phase B-4 soft-deprecation) 이 정식으로 필요해짐

### 범위 (예정)

- `aspects(id, display_ko, description, scope_id, parent_id, deprecated_at)` 테이블
- `DEF_ASPECT` 코드 상수 → codegen seed 로 격하
- `documents.aspect` FK 도입 (cascade 정책 결정 필요)
- `DEFINITION_TAXONOMY` 도 파생 view 로 재정의

### 본 RFC 와의 관계

- C-4 는 C-0~C-3 의 **확장** 이 아니라 **대체**. `aspect_parents` 테이블이 `aspects` 테이블의 `parent_id` 컬럼으로 흡수됨.
- 가역성 있음 — `aspect_parents` view 를 `aspects` 위에 정의하면 기존 쿼리 호환.

## 검증 체크리스트 (모든 단계 공통)

각 단계 완료 후:

```
pnpm --filter definition-catalog build
pnpm --filter definition-catalog test
pnpm --filter definition-service build
pnpm --filter definition-service test
pnpm exec qa-sdk def sync
pnpm exec qa-sdk def validate
pnpm exec qa-sdk def audit | grep -E "duplicate|errors|warnings"
```

기대:
- errors=0 (모든 단계 유지)
- warnings 변화 없음 (Phase C 는 vocabulary 추가 없음)
- dup-coord 변화 없음 (문서 미변경)

## 위험 체크포인트

| 위험 | 감지 | 대응 |
|---|---|---|
| Migration / sync race (00-design R1) | service 로그의 "aspect_parents empty" warning 폭증 | atomic transaction + sync 순서 문서화 |
| Drift: map 에 있는 자식이 DB 에 없음 | insert-on-discovery log | 자가 치유 + warning log |
| Drift: DB 에 있는 자식이 map 에 없음 | reverse-sync warning | 수동 검토 → 삭제는 명시 migration 필요 |
| catalog → DB 의존 역전 | import graph 검사 (`madge` 등) | `aspect-registry` 는 service 전용, catalog 는 pure 유지 |
| CLI rollup 결과 불일치 (C-2) | snapshot 테스트 | getAspectFamily 2-level 전제 문서화 |
| Regression: 기존 검증 실패 | test suite | C-0 는 behavior 변경 없음 → regression 시 설계 재검토 |

## 참조

- [README.md](./README.md) — 본 RFC 진입점
- [00-design.md](./00-design.md) — 옵션 비교 + rationale + 리스크
- [02-schema-diff.md](./02-schema-diff.md) — DDL / Drizzle / populate 스크립트 상세
- `packages/definition-service/src/db/schema.ts` — 변경 지점
- `packages/definition-catalog/src/vocabulary.ts` §`ASPECT_PARENTS` — populate 입력 소스
- `docs/proposals/aspect-vocab-split/01-migration.md` § "Phase C" — 본 RFC 의 모태 (trigger 조건, 전환 순서 원본)
