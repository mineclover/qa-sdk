---
name: definition-boundary-workflow
description: "definition-catalog boundary를 기준으로 direct 구조, coupling, transitive 영향 범위를 읽고 문서 경계를 정렬하는 운영 플레이북."
---

# Definition Boundary Workflow

문서 경계나 컨텍스트 경계를 안정화할 때 쓰는 운영 순서다.
구현 세부보다 구조적 목적과 결합 표현을 먼저 정리한다.

## 기본 흐름

1. datasource를 맞춘다.
2. `boundary`로 direct 구조를 읽는다.
3. `boundary-context --mode direct`로 현재 작업 단위를 읽는다.
4. `boundary-context --mode transitive`로 전이 영향을 읽는다.
5. 요약만으로 부족하면 `body`로 최신 본문 전체를 읽는다.
6. 필요하면 provider/state/interaction/validation 문서로 분리한다.

```bash
qa-sdk def sync
qa-sdk def boundary <문서ID>
qa-sdk def boundary-context <문서ID> --mode direct
qa-sdk def boundary-context <문서ID> --mode transitive
qa-sdk def body <문서ID>
```

## Verification Loop

boundary 문서를 정리한 뒤에는 아래 루프를 기본으로 돈다.

```bash
pnpm --filter @qa-sdk/cli build
node packages/cli/dist/index.js def sync
node packages/cli/dist/index.js def validate   # code_references + graph 함께 검증
node packages/cli/dist/index.js def audit
node packages/cli/dist/index.js def audit-db
```

raw frontmatter 기준으로 boundary/link drift를 따로 보고 싶으면:

```bash
node packages/cli/dist/index.js def scan-audit
node packages/cli/dist/index.js def validate --scan
```

이 루프는 `boundary`와 `boundary-context`가 DB-synced view와 raw scan view에서 모두 같은 방향으로 읽히는지 확인하는 용도다.

## direct 와 transitive

- `direct`
  지금 boundary 정리에 필요한 직접 관계만 본다.
- `transitive`
  inherited concern과 확장 blast radius까지 본다.

정리 작업은 `direct`부터 시작하고, 리뷰와 영향 평가는 `transitive`로 넓힌다.

## 문서 분해 기준

- boundary overview
  structural purpose만 적는다.
- provider 순서
  `flow/process_flow`
- 상태 전이
  `state/app_state`
- interaction
  `ui/interaction`
- 세부 구현
  `feature/func_def`
- 검증
  `feature/scenario` + `depth: validation`

## 함께 쓰는 명령 진입점

- `qa-sdk def boundary <문서ID>`
  boundary 구조와 direct coupling 조회
- `qa-sdk def boundary-context <문서ID> --mode direct|transitive`
  concern/impact 포함 복합 조회
- `qa-sdk def context <문서ID>`
  상위/하위/제약/의존 맥락 확인
- `qa-sdk def find-by-file <파일경로[:symbol]>`
  `source:` + `@def.boundary`/`@def.doc`가 DB에 적재된 경우에만 authoritative boundary를 조회한다
- `qa-sdk def code-link-gaps [--scope=...]`
  explicit code link가 없는 코드를 file-level로 리스트업한다
- `qa-sdk def validate`
  synced graph 검증
- `qa-sdk def scan-audit`
  raw frontmatter/link drift 감사

skill 파일은 내부 실행 정의 SSOT이고, 사용자는 위 명령 진입점을 통해 간접적으로 접근한다.

`def find-by-file`는 DB에 explicit code reference가 없는 파일에는 결과를 주지 않는다. heuristic ranking은 사용하지 않는다.

## 참고 문서

- `docs/specs/viteplus-sdk-smoke/viteplus-playbook-boundary-relation.spec.md`
- `docs/specs/definition-service/def-svc-api-contract.md`
- `docs/specs/definition-catalog/definition-mgmt-verification-loop.spec.md`

## 검증 매핑

- `def boundary`, `def boundary-context`, `def body`
  - 검증: `packages/cli/src/skills-workflows.test.ts`
  - address 기반 boundary smoke: `packages/cli/src/commands/def.test.ts`
