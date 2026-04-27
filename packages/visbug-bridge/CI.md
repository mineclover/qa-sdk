# visbug-bridge CI 통합 노트

## 자동 포함 (monorepo-wide)

`pnpm-workspace.yaml`의 `packages/*` glob에 의해 visbug-bridge가 자동 포함됨.
다음 명령에 자동으로 잡힘:

- `pnpm -r run build`
- `pnpm -r run test`
- `pnpm -r run typecheck`

## 전용 e2e 잡 (`visbug-bridge-e2e`)

`.github/workflows/ci.yml`에 정의됨. 단계:

1. `actions/checkout@v4` with `submodules: recursive`
2. Node 22 + pnpm 10.30.3 (corepack)
3. `pnpm install --frozen-lockfile`
4. `cd vendor/projectvisbug && npm install && npm run bundle` (e2e용 vendor bundle)
5. `pnpm --filter visbug-bridge build` (tsup ESM/CJS/DTS)
6. `pnpm --filter visbug-bridge exec playwright install --with-deps chromium`
7. `pnpm --filter visbug-bridge test` (vitest 단위, 8개)
8. `pnpm --filter visbug-bridge test:e2e` (playwright, 2개)
9. 실패 시 `test-results/` artifact 업로드 (7일 보관)

병렬 실행: 기존 `ci`/`security` 잡과 같은 워크플로 안에서 별도 잡으로 동시 실행.

## Checkout 스텝의 submodules 필수

`.github/workflows/ci.yml`의 `ci`/`security`/`visbug-bridge-e2e` 잡 모두 `submodules: recursive` 설정.
`def-gate.yml`도 동일.

근거: visbug-bridge가 `"visbug": "file:../../vendor/projectvisbug"`를 declare하므로 `pnpm install`
시점에 vendor 디렉터리가 비어 있으면 경로 해석 실패. submodule recursive 체크아웃이 필수 조건.

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
      - '.github/workflows/ci.yml'
```

현재 워크플로는 path filter 없이 항상 실행 (vendor bundle 빌드 비용은 작음).

## 미완

- vendor의 npm test (`cd vendor/projectvisbug && npm test`)를 monorepo CI에 포함시키는 방식 — 미결정. 현재는 vendor 작업 시 로컬 검증만.
