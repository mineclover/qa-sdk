---
def:
  id: ci-workspace-test-rule
  tier: component
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: operation
  tags: [structural, testing, ci]
  links:
    - target: testing-patterns
      type: refines
    - target: facet-test-isolation-rule
      type: depends_on
    - target: test-md-convention
      type: depends_on
    - target: quality-gates-system
      type: constrains
    - target: work-domain-quality-bundle
      type: refs
---

# CI Workspace Test Convention — 운영 규칙

## 목적 ^purpose

워크스페이스 테스트가 CI에서 안정적으로 그린이 되도록 하는 패턴 모음. `pnpm -r run test`가 매 패키지를 직렬로 실행하기 때문에 한 패키지의 환경 의존이 전체 게이트를 막는다. 본 규칙은 그 회귀 패턴 5종을 표준 처리법으로 묶는다.

## 구성 ^overview

- `testing-patterns`: 테스트가 SSOT와 환경 변화에 덜 흔들리도록 하는 일반 패턴.
- `facet-test-isolation-rule`: 서비스/패키지 격리 테스트 운영 절차.
- `test-md-convention`: provider-side 검증 시나리오 문서 표준.
- `quality-gates-system`: CI/test/build/typecheck gate를 묶는 품질 게이트 루트.
- `work-domain-quality-bundle`: workspace 품질 번들의 대표 gate 구성.

---

## 1. Empty-tests 패키지 — `--passWithNoTests`

vitest는 test 파일이 없으면 `exit 1`로 fail. test 산출이 의도적으로 비어있는 패키지(코드 정의만 export)는 `--passWithNoTests` 플래그를 명시.

```json
{
  "scripts": {
    "test": "vitest run --passWithNoTests"
  }
}
```

해당 패키지: `cli-command`, `deterministic-label-registry`, `facet-tests`, `infra-env-kit`, `simulation-tests`, `sim-outbox-view`.

## 2. 외부 환경 의존 테스트 — conditional skip

로컬 rclone 복제본 같은 git 미추적 자원을 import하는 테스트는 conditional script로 CI에서 자동 skip.

```json
{
  "scripts": {
    "test": "test -d synced && vitest run --passWithNoTests || echo 'synced/ 없음 — skip'"
  }
}
```

## 3. E2E (Playwright) 패키지 — noop default + dedicated `test:e2e`

`pnpm filter "!pkg"` 가 GitHub Actions YAML 환경에서 안정적으로 negation을 적용하지 못한다. 그래서 e2e 같은 무거운 패키지는 default `test`를 noop으로 두고 별도 워크플로우가 `test:e2e`를 명시 호출.

```json
{
  "scripts": {
    "test": "echo 'e2e test는 e2e.yml workflow 또는 test:e2e 사용'",
    "test:e2e": "playwright test"
  }
}
```

별도 워크플로우는 `path filter`로 무관 변경 시 트리거 회피 (예: `packages/e2e/**`, `packages/shop-web/**`, `packages/platform-demo/**`).

## 4. Cyclic Workspace Deps — devDeps 방향으로 끊기

`pnpm -r run build`는 cyclic group 안에서 비결정적 순서. cycle 안에서 dev/test 의존을 끊는다 — test 파일을 출력 패키지로 이동.

| Cycle | 끊기 |
|---|---|
| `core ↔ viz-core` | core의 viz-core 사용 test 5개를 `viz-core/test/core/`로 이동 |
| `dkg ↔ spec-core` | dkg의 spec-core 사용 test 이동 |
| `otel ↔ store` | store tracing test 이동 |

## 5. CI 워크플로우 Build Prerequisite

webServer 시동 또는 vitest의 import resolution이 workspace 패키지의 `dist/` 산출을 요구하는 경우, 워크플로우에 빌드 단계 선행:

```yaml
- name: Install Rust toolchain (wasm-pack)
  uses: dtolnay/rust-toolchain@stable
  with:
    targets: wasm32-unknown-unknown
- name: Cache Rust
  uses: Swatinem/rust-cache@v2
- name: Install wasm-pack
  uses: jetli/wasm-pack-action@v0.4.0
- name: Install wasm-bindgen-cli
  run: cargo install wasm-bindgen-cli
- name: Build workspace
  run: pnpm -r run build
```

적용 대상: `ci.yml`, `simulation-domain-slice-gate.yml`, `e2e.yml`.

## 6. pnpm Filter `!pkg` 비신뢰

GitHub Actions YAML 환경에서 `--filter "!pkg"` 가 무시되는 사례 다수 관찰됨. negation 대신:

- 패키지 자체 script를 noop으로 (위 §3)
- 워크플로우 분리 + path filter
- 명시적 `--filter <pkg>` 양수 list

는 안정적.
