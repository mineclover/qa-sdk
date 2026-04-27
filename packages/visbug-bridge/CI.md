# visbug-bridge CI 통합 노트

## 자동 포함

`pnpm-workspace.yaml`의 `packages/*` glob에 의해 visbug-bridge가 자동 포함됨.
다음 monorepo-wide 명령에 자동으로 잡힘:

- `pnpm -r run build`
- `pnpm -r run test`
- `pnpm -r run typecheck`

## CI에서 추가 고려사항

### vendor 의존성

`dependencies: { "visbug": "file:../../vendor/projectvisbug" }`. CI는 다음을 보장해야 함:

- git submodule 체크아웃 (`git submodule update --init --recursive`)
- vendor의 `app/bundle.js` 빌드 (e2e 실행 시):
  ```bash
  cd vendor/projectvisbug && npm install && npm run bundle
  ```
- 단위 테스트(`pnpm --filter visbug-bridge test`)는 vendor bundle 불필요 (jsdom + stub)

### checkout@v4 — submodules 미설정 주의

현재 `.github/workflows/ci.yml`의 `actions/checkout@v4` 스텝에 `submodules: recursive`가
없음. `pnpm install --frozen-lockfile`은 `file:` 의존성을 로컬 경로로 해석하므로,
vendor 디렉터리가 비어 있으면 `pnpm install` 자체가 실패할 수 있음.

**권장 수정** (별도 PR):
```yaml
- name: Check out repository
  uses: actions/checkout@v4
  with:
    submodules: recursive
```

단위 테스트만 CI에 포함하고 vendor 소스가 필요 없다면 `file:` 의존을 `optionalDependencies`로
이동하거나, visbug-bridge를 별도 잡으로 분리하는 것도 대안.

### e2e 실행 (선택)

`pnpm --filter visbug-bridge test:e2e`는 chromium 필요:
```bash
npx playwright install chromium
```

기존 monorepo CI에 e2e가 포함되지 않으면 별도 잡으로 추가하는 것을 후속 PR로 분리 권장.

### 필요 시 명시적 제외

vendor를 monorepo CI 워크플로에서 제외해야 할 경우 (예: vendor의 npm test가 별도 환경 요구):

```yaml
# .github/workflows/...
- run: pnpm -r --filter '!visbug-bridge' run build  # bridge만 제외
```

또는 path filter로 visbug-bridge 변경 시에만 별도 잡 트리거.

## 후속 작업

- def-catalog 좌표 부여 (`docs/specs/visbug-bridge/...`) — 별도 PR
- monorepo CI에 visbug-bridge e2e 잡 추가 — 별도 PR
- vendor의 npm test를 monorepo CI에서 어떻게 다룰지 결정 — 별도 PR
- ci.yml checkout 스텝에 `submodules: recursive` 추가 — 별도 PR (visbug-bridge merge 전 필수)
