# cli-command

`cli-command`는 `qa-sdk`와 `infra-engine`이 공통으로 쓰는 zero-dependency 명령 트리 프레임워크다. 이 패키지는 중앙 CLI spec의 구현 하위층으로 읽어야 한다.

## 먼저 볼 문서

- [cli-command-spec.spec.md](../../docs/specs/cli/cli-command-spec.spec.md) — descriptor/tree/help/dispatch 구조
- [cli-command-registry.plan.md](../../docs/specs/cli/cli-command-registry.plan.md) — 도입 배경과 migration 계획
- [cli-command-group.md](../../docs/specs/skill-catalog/cli-command-group.md) — 명령군의 상위 문맥

## 패키지 역할

- `CommandDescriptor` authored metadata를 runtime tree로 변환한다.
- parse, resolve, execute, help 렌더링을 같은 metadata 모델 위에서 수행한다.
- 프레임워크 의존 없이 다른 CLI 패키지에서 재사용 가능하다.

## 코드 진입점

- `src/index.ts` — public export
- `src/types.ts` — core 타입
- `src/compose.ts` — descriptor → tree
- `src/parse.ts` — argv parse
- `src/resolve.ts` — 서브커맨드 resolve
- `src/execute.ts` — handler 실행
- `src/help.ts` — help 렌더링

## 실행

```bash
pnpm --filter cli-command build
pnpm --filter cli-command test
```

이 패키지의 public contract를 바꾸면 `cli-command-spec.spec.md`와 이를 소비하는 `packages/cli`, `packages/infra-engine`을 같이 봐야 한다.
