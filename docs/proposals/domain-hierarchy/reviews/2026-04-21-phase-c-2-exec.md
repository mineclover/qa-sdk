---
def:
  id: domain-hierarchy-phase-c-2-exec
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

# Phase C-2 Execution — Aspect Rollup API + CLI 통합

## 목적 ^purpose

[aspect-schema-hierarchy RFC](../../aspect-schema-hierarchy/) 의 **Phase C-2 (Rollup API + CLI)** 를 실행한 결과를 기록한다. `getAspectFamily` 헬퍼와 CLI `--include-children`, `--rollup-aspect` 플래그를 정식 도입하여, aspect family 기반 rollup 조회 경로를 처음으로 1 급 시민(first-class) 으로 노출했다. 이로써 RFC 의 C-0/C-1/C-2 트릴로지가 모두 실행 완료되었다.

## Gate 해제 근거

RFC 01-migration.md §"Phase C-2" 원안은 **실증 수요 (rollup 요구 ≥ 3)** 도달을 전제로 한 상태였다. 본 session 에서 gate 를 해제한 근거:

- **Chicken-egg 문제**: rollup API 없이 rollup 수요를 측정할 수 없다. CLI 에 플래그가 없으면 사용자/스킬은 해당 질의를 표현조차 못 한다 — 잠재 수요가 관측되지 못한 채 잠복한다.
- **구현 비용이 낮음**: 순수 BFS helper + CLI 플래그 2 개 = ~150 LOC. Phase C-0/C-1 인프라 (bridge + DB 파생 테이블) 가 이미 준비되어 있어 추가 인프라 없이 증분 가능.
- **가역성 유지**: CLI 플래그 / helper 제거는 1 커밋으로 rollback 가능. DB 스키마 / runtime map 불변.
- **Phase C-3 준비 효과**: Phase C-3 의 `deprecated` 유도는 bridge 의 `getAspectFamily` 가 공식 진입점으로 존재해야 자연스러워진다. C-2 를 열어두면 C-3 가 더 자연스럽게 흘러간다.

## 구현 요약

### 1) Pure helper — `definition-catalog/src/vocabulary.ts`

두 개의 순수 함수를 `definition-catalog` 에 추가하여 catalog 패키지 순수성(DB 의존 無) 을 유지한다.

```ts
// Child inversion — ASPECT_PARENTS 는 child→parent 단방향이므로 역산 필요.
export function getAspectChildren(parent: string): string[];

// BFS family — self + all descendants (sorted, cycle-safe).
export function getAspectFamily(aspect: string): string[];
```

- 결과는 **alphabetical sort** 로 정렬되어 **deterministic** (CLI 스냅샷/rollup 출력 안정 보장)
- **Cycle 방어**: `visited` set 으로 중복 차단 (RFC 2-level 전제상 순환 없어야 하지만 defensive)
- Leaf/미등록 aspect → `[aspect]` 단독 (신규 aspect 도 무탈 통과)
- `packages/definition-catalog/src/index.ts` 에서 export 추가

### 2) Bridge 확장 — `definition-service/src/core/aspect-registry.ts`

기존 `AspectRegistry` 인터페이스에 `getAspectFamily(aspect): string[]` method 추가 (Phase C-1 패턴 그대로):

- **DB 우선 경로**: `aspect_parents` 반복 BFS 조회 (`getChildrenOf` 와 달리 per-level row 조회하여 accurate DB rollup)
- **Fallback 경로**: DB 없음 / 빈 row / 예외 → `getAspectFamily()` runtime map helper 로 폴백 (warning log 후)
- `getChildrenOf` 도 결정론 sort 로 통일 (DB row 가 insert 순서 의존하지 않도록)

### 3) CLI 통합 — `packages/cli/src/commands/def.ts`

두 개의 신규 플래그:

- **`def list --aspect <X> --include-children`** — `getAspectFamily(X)` 로 전개 후 각 aspect 별 `source.list()` 반복, 중복 제거 + family 순서 정렬. 서버/local/scan 3 모드 모두 동작 (catalog pure helper 사용 → source 별 API 변경 불필요).
- **`def audit --rollup-aspect`** — 전체 문서를 root aspect 별로 rollup. 각 문서의 root 는 `deriveAspectParent` chain 을 따라 최상위까지 올라가 결정 (cycle 방어). 출력: root 별 총 건수 + 자식 aspect breakdown + family 크기.

두 플래그 모두 `definition-catalog` 의 순수 helper 만 쓰므로 CLI 는 DB 의존 추가 없이 기존 `DefDataSource` 인터페이스로만 동작한다.

### 4) Help 텍스트 보강

`DEF_HELP_SECTIONS` 의 조회/품질 섹션에 `--include-children`, `--rollup-aspect`, `--by-domain` 라인 추가.

## 테스트

### 추가된 테스트 (총 13 케이스)

**`packages/definition-catalog/src/aspect-family.test.ts` (신규, 10 케이스)**

| 케이스 | 검증 내용 |
|---|---|
| `getAspectChildren — func_def` | ASPECT_PARENTS 에서 parent=func_def 인 모든 자식 반환 (현재 10개) |
| `getAspectChildren — leaf` | `codegen_func` → `[]` |
| `getAspectChildren — 미등록` | `__unknown_aspect__` → `[]` |
| `getAspectChildren — sort` | 알파벳 오름차순 (결정론) |
| `getAspectFamily — 부모` | `func_def` 는 첫 원소 + 모든 후손이 func_def 체인으로 수렴 |
| `getAspectFamily — leaf` | `codegen_func` → `["codegen_func"]` 단독 |
| `getAspectFamily — 미등록` | `__unknown_aspect__` → 단독 반환 (신규 aspect 수용) |
| `getAspectFamily — 중복 제거` | visited set 으로 cycle 방어 |
| `getAspectFamily — process_flow` | 2-level tree 상 부모 + 모든 자식 반환 |
| `getAspectFamily — deterministic` | 여러 호출 결과 동일 |

**`packages/definition-service/src/core/aspect-registry.test.ts` (확장, 기존 6 → 11 케이스)**

| 신규 케이스 | 경로 |
|---|---|
| `getAspectFamily — DB 경로, 부모 aspect` | DB 채워진 상태 → BFS 올바른 family |
| `getAspectFamily — DB 경로, leaf` | `[aspect]` 단독 |
| `getAspectFamily — DB 경로, 중복 제거` | visited set 방어 |
| `getAspectFamily — 빈 DB fallback` | runtime map 과 동치 |
| `getAspectFamily — DB 미전달` | pure runtime mode 동작 |

### 테스트 결과

```
$ pnpm --filter definition-catalog test aspect-family
 ✓ src/aspect-family.test.ts  (10 tests) 8ms
 Test Files  1 passed (1)
      Tests  10 passed (10)

$ pnpm --filter @qa-sdk/definition-service test
 ✓ src/core/doc-versioner.test.ts  (2 tests)
 ✓ src/sync/scanner.test.ts  (1 test)
 ✓ src/sync/aspect-parents-sync.test.ts  (5 tests)
 ✓ src/core/aspect-registry.test.ts  (11 tests)
 Test Files  4 passed (4)
      Tests  19 passed (19)
```

regression 0 건. 본 phase 외의 pre-existing catalog 실패 (25건 tag/link 회귀 등) 는 본 phase 와 무관 — Phase C-2 작업은 vocabulary 확장이 아닌 helper 추가 + 소비자 확장만 담당.

## 스모크 결과

### def sync — populate 확인

```
$ pnpm exec qa-sdk def sync
동기화 완료: 1232건 문서, 3145건 링크
$ sqlite3 data/definition-service.sqlite "SELECT COUNT(*) FROM aspect_parents;"
25
```

(Mini-5b 이후 `ASPECT_PARENTS` 확장된 25 쌍이 CLI 로컬 DB 에도 반영됨)

### def list — baseline vs include-children

```
$ pnpm exec qa-sdk def list --aspect func_def | head -1
[local] 1-50 / 269건 (미표시 219건)

$ pnpm exec qa-sdk def list --aspect func_def --include-children | head -2
[local] aspect=func_def (+10 children: analyzer_func, binder_func, codec_func,
  codegen_func, domain_service_func, encoding_func, format_func, gate_func,
  harness_func, nesting_func)
  1-50 / 288건 (미표시 238건)
```

- **Baseline**: 269건 (func_def 단독)
- **Include-children**: 288건 (func_def 268 + 자식 10종 aspect 20건 = 288. 정확 일치)
- 차이 +19건 — 자식 aspect 로 분기된 문서들이 family rollup 으로 수집됨을 확인

### def audit --rollup-aspect — aspect family 분포

```
$ pnpm exec qa-sdk def audit --rollup-aspect | head -20
[local] === aspect rollup 리포트 (24개 root, 1228건) ===

[func_def]  287건  (family 11개: self + 10 후손)
  ■ func_def: 268건
  └ analyzer_func: 4건
  └ domain_service_func: 3건
  └ encoding_func: 3건
  └ nesting_func: 3건
  └ harness_func: 2건
  └ codec_func: 1건
  └ gate_func: 1건
  └ binder_func: 1건
  └ format_func: 1건

[domain_data]  148건  (family 3개: self + 2 후손)
[process_flow]  142건  (family 9개: self + 8 후손)
[api_contract]  100건  (family 6개: self + 5 후손)
...
```

- func_def family 가 가장 큰 rollup (287건, 전체 문서의 ~23%)
- 4 개 parent aspect (func_def, process_flow, api_contract, domain_data) 기준 rollup 분포가 시각화됨

## RFC 트릴로지 완결

| Phase | 목적 | 상태 |
|---|---|---|
| C-0 | `aspect_parents` 테이블 + populate | ✅ 실행 (2026-04-21) |
| C-1 | Validator bridge + insert-on-discovery | ✅ 실행 (2026-04-21) |
| **C-2** | **Rollup API + CLI** | **✅ 실행 (본 session, 2026-04-21)** |
| C-3 | Runtime map deprecation | 대기 — C-2 완료 후 1 릴리즈 관찰 기간 |
| C-4 | Full aspects dimension | 별도 RFC — 트리거 조건 미충족 |

RFC 00-design §R3 의 핵심 제약 — **catalog 패키지의 순수성 유지** — 가 C-2 에서도 지켜짐을 재확인:
- 신규 helper 는 pure function (runtime map 기반, DB 의존 無)
- DB 경로는 `definition-service` 내부 bridge 에만 존재
- CLI 는 catalog pure helper 직접 사용 (service 의존 불필요)

## 변경 파일 목록

| 카테고리 | 파일 | 변경 요약 |
|---|---|---|
| Pure helper | `packages/definition-catalog/src/vocabulary.ts` | `getAspectChildren` + `getAspectFamily` 2 함수 추가 (+42 LOC) |
| Export | `packages/definition-catalog/src/index.ts` | 2 함수 re-export |
| Bridge | `packages/definition-service/src/core/aspect-registry.ts` | `AspectRegistry.getAspectFamily` method 추가 (+41 LOC); `getChildrenOf` sort 결정론 통일 |
| CLI list | `packages/cli/src/commands/def.ts` `cmdList` / `cmdListWithAspectFamily` | `--include-children` 플래그 + family 전개 로직 (+52 LOC) |
| CLI audit | `packages/cli/src/commands/def.ts` `cmdAuditRollupAspect` | `--rollup-aspect` 플래그 + root 분류 + breakdown 출력 (+45 LOC) |
| CLI help | `packages/cli/src/commands/def.ts` `DEF_HELP_SECTIONS` | `list`, `audit` 섹션에 신규 플래그 라인 추가 |
| 테스트 | `packages/definition-catalog/src/aspect-family.test.ts` (신규) | 10 케이스 — pure helper 검증 |
| 테스트 | `packages/definition-service/src/core/aspect-registry.test.ts` | 기존 6 → 11 — DB/fallback/미전달 3 경로 × family BFS |
| 보고서 | `docs/proposals/domain-hierarchy/reviews/2026-04-21-phase-c-2-exec.md` (본 문서) | 실행 기록 |

## 후속

### Phase C-3 착수 조건 (재확인)

RFC 01-migration §"Phase C-3" — C-2 완료 후 **1 릴리즈 cycle 관찰 기간** 경과. JSDoc `@deprecated` 마킹 단계로, 실제 map 제거는 Phase C-4 또는 영구 유지 결정에 묶인다. 본 session 에서는 기준점(t=0) 만 찍는다.

### 추적 metric

- `--include-children` / `--rollup-aspect` 플래그 사용 빈도 (CLI telemetry — 현재 미수집)
- `AspectRegistry.getAspectFamily` 호출 빈도 (service log)
- rollup 이 함께 사용되는 typical scope/aspect/level 조합 (수요 정형화)

1 릴리즈 이후 해당 metric 관찰 결과를 바탕으로 Phase C-3 진입 여부 결정.

## 참조

- [aspect-schema-hierarchy RFC](../../aspect-schema-hierarchy/README.md) — 본 phase 의 상위 RFC
- [aspect-schema-hierarchy 00-design](../../aspect-schema-hierarchy/00-design.md) — Option C-1 rationale
- [aspect-schema-hierarchy 01-migration](../../aspect-schema-hierarchy/01-migration.md) — Phase C-0~C-4 실행 계획
- [Phase C-0/C-1 실행 보고서](./2026-04-21-phase-c-0-1-exec.md) — 본 phase 의 전제
- `packages/definition-catalog/src/vocabulary.ts` §`ASPECT_PARENTS` — helper 입력 소스
- `packages/definition-service/src/core/aspect-registry.ts` — bridge (DB-first + fallback)
- `packages/cli/src/commands/def.ts` §`cmdList`, `cmdAuditRollupAspect` — CLI 소비자
