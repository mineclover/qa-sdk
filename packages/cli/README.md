# @qa-sdk/cli

`@qa-sdk/cli` README는 명령 사용법 전체를 다시 쓰는 문서가 아니다. **어떤 spec이 이 CLI 표면을 정의하는지**와 **구현이 어디에 붙어 있는지**를 빠르게 찾는 인덱스다.

## 먼저 볼 문서

- [cli-command-spec.spec.md](../../docs/specs/cli/cli-command-spec.spec.md) — 명령 metadata, parser, help, dispatch 구조
- [cli-flow-store.spec.md](../../docs/specs/cli/cli-flow-store.spec.md) — CLI 로컬 decision-flow 저장소
- [cli-command-group.md](../../docs/specs/skill-catalog/cli-command-group.md) — 명령군 분류와 skill 연결
- [dkg-system.md](../../docs/specs/dkg-system/dkg-system.md) — `dkg` 계열 명령이 조작하는 설계 그래프
- [spec-prop-system.md](../../docs/specs/spec-engine-system/spec-prop-system.md) — codegen/spec propagation 계열 흐름

## 패키지 역할

- `qa-sdk` 단일 명령 진입점에서 catalog, def, dkg, flow, quality, ingest, motion, review, test, ontology 등을 묶는다.
- `qa-sdk ontology` 루트는 operational-ontology snapshot ingest/list/show, corridor/checkpoint/junction/route/traversal 조회, snapshot/corridor diff surface를 제공한다.
- `cli-command` 패키지가 제공하는 command tree를 workspace 도메인 명령으로 조립한다.
- 일부 명령은 로컬 SQLite와 서비스 profile을 사용해 런타임 상태를 관리한다.

## 코드 진입점

- `src/index.ts` — 전체 command tree와 dispatch 진입점
- `src/command-spec.ts` — `cli-command` shim과 공통 타입 export
- `src/command-groups/*.commands.ts` — 명령군별 descriptor
- `src/commands/*.ts` — 실제 실행 핸들러
- `src/stores/flow-sqlite-store.ts` — CLI flow store
- `src/skills-workflows.test.ts` — skill 문서와 CLI 표면 연결 검증

## 실행

```bash
pnpm --filter @qa-sdk/cli build
pnpm --filter @qa-sdk/cli test
node packages/cli/dist/index.js --help
```

명령 semantics를 바꿀 때는 패키지 코드보다 먼저 중앙 spec과 skill 문서를 같이 확인하는 편이 drift가 적다.
