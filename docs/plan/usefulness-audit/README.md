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

`packages/operational-ontology-web`은 operational ontology store JSON을 topology/record/health view로 읽는 Vite 앱이다. README와 `test = build + scripts/static-smoke.mjs`를 추가해 production bundle, JS/CSS asset, `public/samples/*.json` 복사 및 store record count 보존을 package-local로 증명한다.

`packages/platform-demo-api`는 Worker 배포 패키지라 별도 build script 대신 `typecheck`와 Hono `app.request()` 기반 read-route smoke를 증거로 삼는다. health, dashboard read-model, prefix metadata, service/permission/event read-only route를 검증하고 D1 grant/log mutation route는 runtime 검증 대상으로 분리한다.

`packages/snapshot-io`는 `SchemaSnapshot` JSON의 얇은 read/write/validation layer다. `test = spec-schema build + snapshot-io build + scripts/smoke.test.mjs`를 추가해 임시 디렉토리 round-trip, nested output directory creation, duplicate axis, missing dim validation failure를 package-local로 증명한다.

`packages/authorization-monitor-web`은 authorization ontology의 proxy/application enforcement graph를 보여주는 Vite 앱이다. `test = build + scripts/static-smoke.mjs`를 추가해 production bundle, graph snapshot copy, proxy route/domain resource payload, RLSC `data-qa-address` marker를 package-local로 증명한다.

`packages/config-loader`는 catalog/DKG config 파일 탐색과 fallback을 맡는 shared utility다. `test = build + scripts/smoke.test.mjs`를 추가해 explicit JSON/module loading, `qa-sdk.config.js` discovery, invalid catalog/DKG config rejection을 임시 디렉토리에서 package-local로 증명한다.

`packages/decision-service`는 Nest service shell이지만 package-local smoke는 서버를 띄우지 않고 in-memory SQLite와 실제 migrations로 닫는다. `test = build + build:tsc + scripts/services.test.ts`를 추가해 health, schema upsert/delete, instance save/update/list, flow link create/query/unlink를 검증한다.

`packages/docs-explorer`는 definition-catalog를 정적 JSON으로 export하는 Vite 문서 탐색기다. `test = build + scripts/static-smoke.test.mjs`를 추가해 production index의 탐색 UI marker, `dist/data.json`과 `public/data.json` 스냅샷 일치, `system-root` 링크 기반 첫 화면 탐색 대상, `docs-explorer` 노드, contains/parents 참조 무결성을 package-local로 증명한다. 같은 입력에서 export timestamp만 바뀌어 dirty가 생기지 않도록 기존 `generatedAt`을 보존한다.

`packages/platform-demo`는 workbook형 Vite 앱과 monitor/dashboard/diagram/flow/debugger 정적 관찰 페이지를 함께 배포하는 viz-system 프론트엔드다. `test = build + scripts/static-smoke.test.mjs`를 추가해 production workbook asset, public 정적 페이지 복사, `def-catalog-data.json`, fallback read-model, diagram preset 전역 등록을 package-local로 증명한다.

`packages/registry-ui`는 registry-service 데이터를 탐색·구성하는 Vanilla TS + Vite UI다. `test = build + scripts/static-smoke.test.mjs`를 추가해 SPA 탭/컨테이너 marker, JS/CSS asset, generated git-conflicts fixture의 dist 복사와 shape을 package-local로 증명한다. 독립 `tsc --noEmit`은 기존 file-map 타입 drift가 있어 이번 보수 증명 범위에는 넣지 않았다.
