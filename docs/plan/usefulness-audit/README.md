---
def:
  id: qa-sdk-usefulness-audit-plan
  type: knowledge
  knowledge_kind: guide
  lifecycle: draft
  owner_system: qa-sdk
  scope: meta
  aspect: quality_flow
  tier: layout
  depth: overview
  tags: [audit, usefulness, pruning]
  links:
    - target: design-usefulness-audit
      type: depends_on
---

# qa-sdk Usefulness Audit Plan

## 목적 ^purpose

qa-sdk의 설계를 계속 확장하기보다, 실제로 작업을 줄이고 실패를 막는 표면만 남기기 위한 감사 계획이다. 이 계획은 `keep/prove/quarantine/remove` 판정을 쓰되, 첫 라운드에서는 기존 문서와 패키지를 지우지 않고 `prove` 후보를 보수적으로 모으는 데 집중한다.

## 시작 명령

```bash
pnpm docs:usefulness-audit
pnpm docs:usefulness-audit -- --format json
pnpm docs:usefulness-audit -- --format json --all
```

기본 리포트는 우선순위가 높은 후보만 보여준다. 전체 인벤토리가 필요할 때만 `--all`을 붙인다. `prove`나 `quarantine` 후보를 바로 삭제하지 말고, 해당 package/docs의 실제 소비자와 검증 명령을 먼저 확인한다. approved 문서는 증거가 약해도 첫 판정을 `prove`로 유지한다.

## 1차 감사 기준

| 판정 | 기준 |
|---|---|
| `keep` | CLI/API/test/fixture/smoke/consumer 중 하나가 현재 존재한다 |
| `prove` | 설계 의도는 있으나 실행 증거가 부족하다 |
| `quarantine` | 참조자 확인 뒤 live workflow에서 빼도 됨이 확인됐다 |
| `remove` | 대체 완료, 중복, stale, 또는 참조자 없는 generated/obsolete surface임이 증명됐다 |

## 우선 살릴 후보

| 표면 | 이유 | 확인 명령 |
|---|---|---|
| `packages/data-structure-profile` | fixture-first contract, CLI, profile isolation validator, bridge smoke가 있음 | `pnpm --filter data-structure-profile test` |
| `packages/request-contract` | request/observation normalize/validate/evaluate가 package-local test로 닫힘 | package-local test/build |
| `definition-catalog` + CLI def validation | 문서 감사와 링크 정합성의 현재 실행 기반 | `node packages/cli/dist/index.js def validate` |
| `spec-core` semantic indexing pack | report/compatibility kernel과 CLI smoke가 있음 | `node packages/cli/dist/index.js spec semantic-pack report --no-git --format json` |

## 먼저 증명할 후보군

- `docs/specs/**` 중 approved인데 `sources:`와 검증 명령이 모두 없는 문서.
- `docs/proposals/**` 중 오래 열린 proposal이면서 package, fixture, CLI, smoke로 이어지지 않은 문서.
- ontology/taxonomy 성격의 문서 중 consumer package나 validator가 없는 문서.
- package가 있으나 README, test script, 실제 test file이 없는 workspace package.

## 운영 원칙

- 한 번에 하나의 topic만 `prove`한다.
- `prove`는 문서 보강이 아니라 작은 실행 증거 추가를 뜻한다.
- `quarantine`은 삭제가 아니라 live route에서 빼고 참조를 명확히 하는 작업이며, 별도 변경으로 다룬다.
- `remove`는 def validation, arch feedback, package tests가 통과한 뒤에만 한다.

## 1차 보수 정리 결과

첫 audit 결과에서 `packages/weighted-wasm/pkg`가 `quarantine` 후보로 잡혔지만, 실제로는 `wasm-pack`이 생성한 배포 manifest와 WASM 산출물이다. 상위 workspace package인 `packages/weighted-wasm`의 JS wrapper가 `../pkg/weighted_wasm.js`와 `../pkg/weighted_wasm_bg.wasm`을 직접 소비하므로 삭제 또는 격리 대상이 아니다.

따라서 감사 스크립트는 package 후보를 `pnpm-workspace.yaml`에 등록된 workspace root로 제한한다. nested `package.json`은 별도 증거 없이 정리 후보로 올리지 않는다.

같은 라운드에서 `simulations/enterprise-pm/services/.placeholder`도 package 후보로 잡혔지만, 현재 `docker-compose.sim.yaml`과 `scripts/sim-up.sh`는 실제 서비스 Dockerfile을 사용하고 `pnpm --filter @qa-sdk-sim/placeholder build`도 workspace project를 찾지 못한다. hidden directory는 pnpm workspace filter와 다르게 수동 glob에만 잡힌 false positive이므로 audit 후보에서 제외한다.

첫 실제 package 후보였던 `packages/shop-web`은 삭제/격리 대상이 아니라 package-local 증명 보강 대상이었다. `public/` 정적 앱, `dev/start` script, E2E 소비자가 이미 있으므로 `packages/shop-web/scripts/static-smoke.mjs`와 `pnpm --filter @qa-sdk/shop-web test`를 추가해 정적 번들, 주요 `data-testid`, QA config, Pages 설정을 검증한다. 이 변경 뒤 `shop-web`은 audit에서 `keep`으로 올라간다.

그 다음 후보였던 `packages/e2e`, `packages/facet-tests`, `packages/simulation-tests`는 runtime source가 없는 게 아니라 test-only package다. 감사 스크립트는 `tests/`, `scenarios/`, `*.spec.*`, `*.test.*`를 실행 증거 표면으로 인정하도록 조정한다.

`packages/codec`와 `packages/context`는 `@qa-sdk/sdk`, `demo-types`, `bench`, codegen에서 소비하는 플랫폼 체인 기반 패키지다. 삭제 후보가 아니라 package-local smoke가 빠진 상태였으므로 `test = build + scripts/smoke.mjs`를 추가해 typed SDK, dim-wire, QaContext, CatalogProvider의 최소 계약을 증명한다.

`packages/gateway`는 `src/`가 없어서 audit에서 `runtime=false`로 보였지만 실제 런타임은 루트 `server.ts`/`worker.ts`와 `lib/`에 있다. 감사 스크립트는 root runtime entry와 `lib/`도 source evidence로 인정하도록 보정하고, gateway 자체에는 route permission/bitmask smoke를 추가해 인증 라우팅의 최소 계약을 package-local `test`로 닫는다.
