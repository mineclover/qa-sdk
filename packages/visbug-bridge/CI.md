# visbug-bridge CI 통합 노트

## 자동 포함 (monorepo-wide)

`pnpm-workspace.yaml`의 `packages/*` glob에 의해 visbug-bridge가 자동 포함됨.
다음 명령에 자동으로 잡힘:

- `pnpm -r run build`
- `pnpm -r run test`
- `pnpm -r run typecheck`

## 전용 e2e 잡 (`visbug-bridge-e2e`)

전용 잡은 `.github/workflows/visbug-bridge-e2e.yml`에서 활성화되어 있다. 실행 단계:

1. `actions/checkout@v4` with `submodules: recursive`
2. Node 22 + pnpm 10.30.3 (corepack)
3. `pnpm install --frozen-lockfile`
4. `pnpm --filter visbug run bundle` (e2e용 vendor bundle)
5. `pnpm --filter visbug-bridge build` (tsup ESM/CJS/DTS)
6. `pnpm --filter visbug-bridge exec playwright install --with-deps chromium`
7. `pnpm --filter visbug-bridge test` (vitest 단위, 현재 20개)
8. `pnpm --filter visbug-bridge test:e2e` (playwright, 2개)
9. `pnpm --filter visbug-bridge test:extension` (extension build + tutorial GIF asset smoke, 1개)
10. 실패 시 `test-results/` artifact 업로드 (7일 보관)

병렬 실행: 기존 `ci`/`security` 잡과 같은 워크플로 안에서 별도 잡으로 동시 실행.

## Checkout 스텝의 submodules 필수

`.github/workflows/visbug-bridge-e2e.yml`는 `submodules: recursive` 설정.
다른 비활성 workflow들도 재활성화할 때 동일 설정이 필요하다.

근거: `visbug` 패키지가 `vendor/projectvisbug` submodule에 있으므로 `pnpm install`
시점에 해당 디렉터리가 비어 있으면 workspace resolve 실패. submodule recursive 체크아웃이 필수 조건.

## 보조 패턴 (필요 시)

### 특정 패키지만 제외
```yaml
- run: pnpm -r --filter '!visbug-bridge' run build
```

### path filter로 트리거 절약
bridge가 소비하는 RLSC 분석 submodule 또는 lockfile이 바뀌어도 e2e 잡이 실행되도록 `paths` 필터를 유지한다:
```yaml
on:
  pull_request:
    paths:
      - 'packages/visbug-bridge/**'
      - 'packages/rlsc-analysis/**'
      - 'vendor/projectvisbug'   # submodule pointer
      - 'pnpm-lock.yaml'
      - '.github/workflows/visbug-bridge-e2e.yml'
```

활성 workflow가 있으므로 PR/Push path filter와 수동 `workflow_dispatch`가 기준이다.

## 미완

- ~~vendor test를 monorepo CI에 포함~~ → `visbug-bridge-e2e` 잡에 `pnpm --filter visbug run test:unit` 포함됨.
- ~~extension asset smoke 자동화~~ → `pnpm --filter visbug-bridge test:extension` 포함됨.
