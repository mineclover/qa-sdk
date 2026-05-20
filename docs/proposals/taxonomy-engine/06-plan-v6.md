# Taxonomy Engine v0.6 구현 계획 — CLI 활성화

> v0.5 기능 리뷰의 "다음 우선순위 1+2+3" 묶음. 작은 CLI 보완으로 큰 UX 개선.

**Goal v0.6:**
- T-J1: `tax doctor <file>` CLI 명령 (라이브러리 doctor의 CLI 노출)
- T-J2: `tax codegen --registry <dir>` (cross-tax codegen 지원)
- T-J3: `tax diff --registry <dir>` (cross-tax 컨텍스트에서 diff)
- T-J4: diff의 사용 사례 — git diff 통합 명령 (`tax git-diff <base>`)

**Branch:** `feat/taxonomy-engine-v6`. Base: main@e0cffd13 (v0.5 머지 완료, 138 lib + 12 cli tests + 5 도그푸딩 + tax:ci).

---

## Task 분해

### T-J1: `tax doctor <file>` CLI 명령

라이브러리 `doctor(ir, expected)`를 CLI로 노출.

```bash
qa-sdk tax doctor <file> --expected <expected.json> [--json]
qa-sdk tax doctor <file> --auto [--json]   # expected 자동 추출 (DKG/ingest/vocab만)
```

`--auto`: yaml 파일명에서 expected 추출 source 추정 (예: dkg-schema → dkg-{node,edge}-types.spec.md). 매핑 hardcoded.

**Files:**
- Modify: `packages/cli/src/commands/taxonomy.ts` (doctorCmd 추가)
- Modify: `packages/cli/src/command-groups/taxonomy.commands.ts` (descriptor + usage)
- Modify: `packages/cli/src/commands/taxonomy.test.ts` (테스트 2-3건)

### T-J2: `tax codegen --registry <dir>`

현재 codegen은 단일 파일만. cross-tax import 가진 yaml은 registry 필요. 옵션 추가.

```bash
qa-sdk tax codegen <file> --out <dir> --registry <dir> [--skip-validate]
```

registry는 validate gate에 전달. codegen 결과 자체는 단일 yaml 산출 (cross-tax 정보를 codegen에 굳이 박지 않음 — caller가 별도 import 해소).

**Files:**
- Modify: `packages/cli/src/commands/taxonomy.ts` (codegenCmd에 --registry 처리)
- Modify: `packages/cli/src/commands/taxonomy.test.ts` (테스트 1건)

### T-J3: `tax diff --registry <dir>`

두 파일 diff에 registry 컨텍스트. 두 yaml의 cross-tax import 검증을 함께. diff 자체는 두 IR 비교, 단 registry로 import 해소 후 더 풍부한 진단 가능.

실용성: diff 자체에 직접 영향은 적음 (diff는 IR 비교, import 해소는 validate). 그러나 일관된 표면이라 추가.

```bash
qa-sdk tax diff <a> <b> --registry <dir>
```

registry가 있으면 두 IR을 validate한 결과도 함께 출력 (warning).

**Files:**
- Modify: `packages/cli/src/commands/taxonomy.ts` (diffCmd에 --registry 처리)
- Modify: `packages/cli/src/commands/taxonomy.test.ts` (테스트 1건)

### T-J4: `tax git-diff <base>` 명령 (diff 사용 사례)

git working tree의 yaml 변경을 자동 감지하고 base ref(예: main)와 비교한 diff 출력. PR 리뷰 워크플로 진입점.

```bash
qa-sdk tax git-diff [base-ref] [--json]   # default base: main
```

동작:
1. `git diff --name-only <base>... -- 'docs/taxonomies/*.yaml'` — 변경된 yaml 목록
2. 각 변경 yaml에 대해:
   - base ref의 내용 `git show <base>:<path>`
   - working tree 내용
   - diff(a, b) 호출
3. 결과 출력

**Files:**
- Modify: `packages/cli/src/commands/taxonomy.ts` (gitDiffCmd 추가)
- Modify: `packages/cli/src/command-groups/taxonomy.commands.ts` (descriptor + usage)
- Modify: `packages/cli/src/commands/taxonomy.test.ts` (테스트 1건 — git stub 어려움. integration test minimal)

---

## 실행 순서

```
T-J1 (doctor CLI) — 독립
T-J2 (codegen --registry) — 독립
T-J3 (diff --registry) — 독립
T-J4 (git-diff) — T-J3 후 (diff 호출 패턴 일관)
```

병렬 가능하지만 같은 파일(taxonomy.ts) 수정이라 sequential.

## 회귀 정책

- 매 task 후 `pnpm tax:ci` 통과
- T-J4는 git 의존이라 unit test 어려움 — manual smoke + 최소 stub

## 제외 (out of scope)

- 자동 추출 확장 (lesson-builder/ingest driver) — 별도 spec
- Web UI 구현 — 별도 spec
- DEF_ASPECT 46 entries 자동 추출
- Constraint expression DSL
- relation rule wildcard 표현
- frontmatter 승격
