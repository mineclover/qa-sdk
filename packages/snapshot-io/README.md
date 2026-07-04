# snapshot-io

`snapshot-io`는 `SchemaSnapshot` JSON을 읽고 쓰는 작은 유틸리티 레이어다. 전용 package spec은 아직 없어서, 현재는 snapshot이 사용되는 상위 propagation/codegen 문서를 기준으로 읽는다.

## 먼저 볼 문서

- [snapshot-io.spec.md](../../docs/specs/apm-system/apm-codegen-system/snapshot-io.spec.md) — 패키지 계약
- [spec-prop-publish.spec.md](../../docs/specs/spec-engine-system/spec-prop-system/spec-prop-publish.spec.md) — snapshot이 registry 발행 흐름에서 어떻게 쓰이는지
- [spec-core-registry.spec.md](../../docs/specs/spec-engine-system/spec-core-types-group/spec-core-registry.spec.md) — spec-core registry/IR 문맥
- [indexing/README.md](../../docs/specs/indexing/README.md) — catalog/snapshot이 indexing 레이어에서 차지하는 위치

## 패키지 역할

- `SchemaSnapshot` JSON 파일의 읽기/쓰기/검증 보조 기능을 제공한다.
- codegen이나 registry publish 전에 snapshot 파일을 안정적으로 다루는 얇은 I/O 레이어다.
- `codegen-core`와 함께 사용되며, snapshot 내용을 해석하는 핵심 로직은 그쪽이 맡는다.

## 코드 진입점

- `src/index.ts` — public export
- `src/snapshot-io.ts` — snapshot 입출력 유틸리티

## 실행

```bash
pnpm --filter snapshot-io build
pnpm --filter snapshot-io test
pnpm --filter snapshot-io typecheck
```

`test`는 `spec-schema` 타입 산출물을 먼저 준비한 뒤 production build를 실행하고, 임시 디렉토리에서 `writeOutput`, `readSnapshot`, `readSnapshots`의 valid round-trip과 duplicate axis/missing dim validation 실패를 확인한다. 이 패키지 자체는 얇기 때문에, 포맷을 바꾸는 변경은 snapshot을 소비하는 상위 spec과 함께 검토하는 편이 맞다.
