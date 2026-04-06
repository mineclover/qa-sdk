# data-object-codegen

`data-object-codegen`은 DataObjectBinding에서 typed binding 코드를 생성하는 작은 codegen 패키지다.

## 먼저 볼 문서

- [data-object-codegen.spec.md](../../docs/specs/meta-semantic/pipe-impl/model/data-object-codegen.spec.md) — 공개 계약
- [data-object-binding.spec.md](../../docs/specs/meta-semantic/pipe-impl/model/data-object-binding.spec.md) — 입력 모델

## 패키지 역할

- DataObjectBinding 배열을 타입 안전한 바인딩 코드로 변환한다.
- 결정론적 `contentHash`를 제공해 같은 입력에 같은 결과를 보장한다.
- I/O 없이 순수 함수로만 동작한다.

## 코드 진입점

- `src/index.ts` — public export
- `src/generate-data-object-bindings.ts` — 핵심 생성기

## 실행

```bash
pnpm --filter data-object-codegen build
pnpm --filter data-object-codegen test
```
