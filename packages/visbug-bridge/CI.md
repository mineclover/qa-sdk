# visbug-bridge CI 통합 노트

## 자동 포함 (monorepo-wide)

`pnpm-workspace.yaml`의 `packages/*` glob에 의해 visbug-bridge가 자동 포함됨.
다음 명령에 자동으로 잡힘:

- `pnpm -r run build`
- `pnpm -r run test`
- `pnpm -r run typecheck`

## 전용 e2e 잡 (`visbug-bridge-e2e`)

현재 전용 잡 정의는 `.github/workflows-disabled/visbug-bridge-e2e.yml`에 보관됨. 활성화 시 단계:

1. `actions/checkout@v4` with `submodules: recursive`
2. Node 22 + pnpm 10.30.3 (corepack)
3. `pnpm install --frozen-lockfile`
4. `pnpm --filter visbug run bundle` (e2e용 vendor bundle)
5. `pnpm --filter visbug-bridge build` (tsup ESM/CJS/DTS)
6. `pnpm --filter visbug-bridge exec playwright install --with-deps chromium`
7. `pnpm --filter visbug-bridge test` (vitest 단위, 18개)
8. `pnpm --filter visbug-bridge test:e2e` (playwright, 2개)
9. 실패 시 `test-results/` artifact 업로드 (7일 보관)

병렬 실행: 기존 `ci`/`security` 잡과 같은 워크플로 안에서 별도 잡으로 동시 실행.

## Checkout 스텝의 submodules 필수

`.github/workflows-disabled/ci.yml`의 `ci`/`security`, `.github/workflows-disabled/visbug-bridge-e2e.yml`, `.github/workflows-disabled/def-gate.yml` 모두 `submodules: recursive` 설정.

근거: `visbug` 패키지가 `vendor/projectvisbug` submodule에 있으므로 `pnpm install`
시점에 해당 디렉터리가 비어 있으면 workspace resolve 실패. submodule recursive 체크아웃이 필수 조건.

## 보조 패턴 (필요 시)

### 특정 패키지만 제외
```yaml
- run: pnpm -r --filter '!visbug-bridge' run build
```

### path filter로 트리거 절약
visbug-bridge 변경 시에만 e2e 잡 실행하려면 `paths` 필터 추가:
```yaml
on:
  pull_request:
    paths:
      - 'packages/visbug-bridge/**'
      - 'vendor/projectvisbug'   # submodule pointer
      - '.github/workflows/visbug-bridge-e2e.yml'
```

활성화된 워크플로가 없으므로 현재는 수동 실행/로컬 `make visbug-smoke`가 기준이다.

## 미완

- ~~vendor test를 monorepo CI에 포함~~ → `visbug-bridge-e2e` 잡에 `pnpm --filter visbug run test:unit` 포함됨.
- 전용 workflow 활성화 여부 결정은 별도.
