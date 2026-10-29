---
def:
  id: qa-sdk-usefulness-audit-plan
  type: knowledge
  knowledge_kind: guide
  lifecycle: draft
  owner_system: qa-sdk
  scope: flow
  aspect: quality_flow
  tier: layout
  depth: overview
  tags: [audit, usefulness, pruning]
  links:
    - target: design-usefulness-audit
      type: refs
    - target: skill-catalog-system
      type: refs
---

# qa-sdk Usefulness Audit Plan

## 목적 ^purpose

qa-sdk의 설계를 계속 확장하기보다, 실제로 작업을 줄이고 실패를 막는 표면만 남기기 위한 감사 계획이다. 이 계획은 `keep/prove/quarantine/remove` 판정을 쓰되, 첫 라운드에서는 기존 문서와 패키지를 지우지 않고 `prove` 후보를 보수적으로 모으는 데 집중한다.

## 시작 명령

```bash
corepack pnpm docs:usefulness-audit
corepack pnpm docs:usefulness-audit -- --format json
corepack pnpm docs:usefulness-audit -- --format json --all
```

기본 리포트는 우선순위가 높은 후보만 보여준다. active 문서를 먼저 올리고 `docs/archive/`, `docs/proposals/_template/`, `docs/decisions/`의 미결정 skeleton, frontmatter 없는 `docs/plan/` planning note, `status: superseded` proposal redirect note 같은 낮은 신호 표면은 기본 후보 목록 뒤로 보낸다. 전체 인벤토리가 필요할 때만 `--all`을 붙인다. `prove`나 `quarantine` 후보를 바로 삭제하지 말고, 해당 package/docs의 실제 소비자와 검증 명령을 먼저 확인한다. approved 문서는 증거가 약해도 첫 판정을 `prove`로 유지한다.

package 감사는 `pnpm-workspace.yaml`의 workspace roots를 읽지만 기능 surface 승격/격리 판정은 `packages/*`에만 적용한다. `simulations/*`와 `vendor/*`는 `workspace-support` scope로 표시해 실행 증거를 보존하되, 이름 끝부분이 같아도 `package-surface-separation-rule`의 제품/도구/격리 surface와 섞지 않는다. `packages/*` 항목은 `surfaceGroup`으로 coordinate kernel, observability runtime, definition catalog, decision evidence, spec analysis, taxonomy capability, profile capability, authorization support, simulation contract, verification suite, demo consumer, quarantine 같은 실제 기능군도 함께 노출한다.

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
| `packages/data-structure-profile` | fixture-first contract, CLI, profile isolation validator, bridge smoke가 있음 | `corepack pnpm --filter data-structure-profile test` |
| `definition-catalog` + CLI def validation | 문서 감사와 링크 정합성의 현재 실행 기반 | `node packages/cli/dist/index.js def validate` |
| `spec-core` semantic indexing pack | report/compatibility kernel과 CLI smoke가 있음 | `node packages/cli/dist/index.js spec semantic-pack report --no-git --format json` |

## 삭제 금지, 승격 보류 후보

| 표면 | 이유 | 확인 명령 |
|---|---|---|
| `packages/request-contract` (2026-10-29 삭제) | request/observation normalize/validate/evaluate package-local 증거는 있지만 surface manifest는 `no-promotion`으로 격리한다 | `corepack pnpm --filter request-contract test`; `corepack pnpm --silent arch:usage -- --json` |
| `packages/weighted-gpu` (2026-10-29 삭제) | WebGPU 구현과 package-local test는 있지만 실제 consumer/performance promotion 근거가 생길 때까지 제품 축으로 승격하지 않는다 | `corepack pnpm --filter weighted-gpu test`; `corepack pnpm --silent arch:usage -- --json` |

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

## 관리 구조

이 감사의 장기 운영 구조는 "패키지를 문서에 맞추는 것"이 아니라 "문서가 실제 source authority를 가리키게 하는 것"이다.

| 레이어 | 기준 파일 | 운영 방식 |
|---|---|---|
| Source authority | `packages/*`, `simulations/*`, `scripts/*`, `skills/*` | 구현, 테스트, smoke, CLI, fixture가 실제 동작을 소유한다 |
| Package surface | `scripts/package-surfaces.mjs` | `packages/*`만 surface-managed로 분류하고, `simulations/*`/`vendor/*`는 workspace-support로 둔다 |
| Definition catalog | `docs/specs/**`, `docs/*.md`의 `def:` 문서 | 개념/계약/시스템을 설명하고 top-level `sources:`로 실제 source authority를 연결한다 |
| Legacy records | `docs/superpowers/**`, 오래된 plan/proposal | 현재 spec으로 승격하지 않고 `status: source-backed` + `sources:`로 완료 기록을 보존한다 |
| Audit gates | `docs:usefulness-audit`, `def:check`, `arch:feedback` | 후보 생성, 문서 정합성, surface 분리 회귀 방지를 담당한다 |

### Source-backed 정리 루프

1. `corepack pnpm docs:usefulness-audit -- --format json --all`로 후보를 확인한다.
2. 후보 문서가 현재 구현과 맞으면 top-level `sources:`에 implementation/test/smoke/consumer refs를 추가한다.
3. 후보가 legacy 설계/계획이면 `def:`를 만들지 않고 `status: source-backed`로 완료 기록임을 표시한다.
4. 후보가 아직 구현되지 않았으면 `prove`로 남긴다. lifecycle downgrade나 archive 이동으로 숨기지 않는다.
5. 실제 제거/격리가 필요하면 source-backed 커밋과 분리해 `quarantine` 또는 `remove` topic으로 처리한다.
6. 닫을 때는 `git diff --check`, `corepack pnpm docs:usefulness-audit`, `corepack pnpm def:check`, `corepack pnpm arch:feedback`을 확인한다.

### 유지 불변식

- `docs:usefulness-audit`의 `prove=0`은 목표가 아니라 결과다. 실제 source authority가 없으면 0을 만들지 않는다.
- `sources:`는 문서의 구현 소유권이 아니라 역추적 링크다.
- approved definition 문서는 현재 동작만 적는다. 미구현 계획은 `.todo.md`, proposal, 또는 legacy record에 둔다.
- `scripts/package-surfaces.mjs`가 package surface SSOT다. 문서 표는 manifest를 따라가야 한다.
- `request-contract`, `weighted-gpu`처럼 `no-promotion`인 패키지는 package-local 증거가 있어도 제품 core로 승격하지 않는다.

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

`packages/test-types`는 테스트 분류 타입과 품질 게이트/작업 도메인 vocabulary의 zero-dependency SSOT다. `test = build + typecheck + scripts/smoke.test.mjs`를 추가해 ESM/CJS 산출물이 동일한 `TEST_*` 배열, `GATE_KINDS`, `WORK_DOMAINS`, `getSubDomain()` 계약과 declaration export를 제공하는지 package-local로 증명한다.

`packages/weighted-index-explorer`는 weighted-index 개념을 페이지 단위로 설명하는 Vite 데모다. `test = build + scripts/static-smoke.test.mjs`를 추가해 주요 sheet/container marker, JS/CSS asset, v1/v2/v3 mixed-radix shape와 encode/decode 예시를 package-local로 증명한다.

첫 doc 후보였던 `docs/data-model.md`는 삭제/격리 대상이 아니라 stale 경로와 실행 증거가 빠진 entry guide였다. `docs/specs/data-model/` 참조를 현재 `docs/specs/ingest/` + `docs/specs/storage-system/`로 보정하고, core 타입/포트, store memory adapter tests, 관련 spec 문서, `@qa-sdk/core` typecheck, `@qa-sdk/store` memory test, `def validate`를 증거로 연결한다.

그 다음 상단 후보였던 `docs/decisions/lesson-builder-content.layer.cue.md`와 `docs/decisions/lesson-builder-content.layer.branch.md`는 taxonomy entry의 `decisionLink`가 만든 의도적 미결정 skeleton이다. 삭제나 가짜 증거 보강 대상이 아니므로 기본 후보 정렬에서는 뒤로 보내되, `--all` 인벤토리와 decision workflow에서는 계속 `prove`로 남긴다.

`docs/plan/schema-builder/ddl-inventory.md`처럼 frontmatter가 없는 planning note는 현재 상태의 구현 증거라기보다 당시 설계/인벤토리 맥락이다. 기본 후보 목록에서는 `plan-note`로 뒤로 보내고, 실제 구현 여부를 증명하려면 별도 작업에서 현재 소스(`index-meta` table schema, ingest DDL, registry schema 등)와 검증 명령을 붙여 approved/draft 문서로 승격한다.

`docs/proposals/ai-dlc-dspy-harness/04-bdd-contract-model.md`, `05-bdd-mechanical-design.md`, `06-bdd-cli-impact.md`는 `status: superseded`와 `superseded_by`를 가진 moved note다. 삭제 대상은 아니지만 active 구현 후보도 아니므로 기본 후보 목록에서는 `superseded-note`로 뒤로 보내고, 이동 대상인 `docs/proposals/bdd-contract-system/`을 별도 후보로 다룬다.

## 다음 작업 준비

2026-07-15 기준 workspace 안정화는 `2315514a`에서 닫혔다. 다음 작업은 기능을 더 추가하는 라운드가 아니라, 정적 형식 검사를 통과한 실행 정의가 실제 작업 맥락에서 유용하게 작동하는지 확인하는 **skill behavior smoke audit**으로 시작한다.

### 첫 검증 slice

한 번에 전체 36개를 재작성하지 않고, 서로 다른 책임을 대표하는 세 skill만 먼저 확인한다.

| skill | 확인할 것 |
|---|---|
| `arch-governance` | 문서에 적힌 `arch:*` 명령과 실제 root script/분석기 경로의 일치 |
| `project-closure-review` | root/submodule 상태 분리, generated artifact 판정, 커밋 순서와 리뷰 출력의 실행 가능성 |
| `def-entry-sync` | `def sync`, `def validate`, `skills:check`와 root entry/catalog 갱신 순서의 정합성 |

### 진입 조건

- `corepack pnpm skills:check`가 36 skills / 45 files로 통과한다.
- `corepack pnpm def:check`와 `corepack pnpm arch:feedback`이 통과한다.
- 작업 범위는 `skills/`, 관련 catalog 문서, 필요한 검증 fixture로 제한한다.
- `~/.claude/skills/`와 `~/.codex/skills/`를 직접 수정하지 않고, 필요하면 repo SSOT 수정 후 `scripts/sync-skills.sh`로 전파한다.

definition graph 전체 동기화에서 관찰됐던 `545 errors / 30 warnings`는 기존 baseline으로 분류하지 않고 해결했다. 원인은 taxonomy에서 탈락한 문서 39건, frontmatter `sources`의 boundary 오추론, 실제 누락 링크/순환/계층 위반이 섞여 있던 것이며, `def sync` 후 `def validate`와 `def audit` 그래프 검증이 각각 `0 errors / 0 warnings`가 되도록 정리했다.

### 완료 조건

1. 각 skill의 trigger, 입력 전제, 명령 경로, 실패 시 다음 행동이 실제 파일/스크립트와 일치한다.
2. 대표 happy path와 최소 failure path를 각각 한 번 실행하거나, 실행 불가한 외부 의존성을 명시한다.
3. 결과를 해당 skill catalog entry 또는 이 계획에 source-backed evidence로 남긴다.
4. `skills:check`, focused test/smoke, `def:check`, `arch:feedback`, `git diff --check`를 재실행한다.

### 비목표

- 근거 없이 skill을 삭제하거나 새 그룹을 추가하는 것
- 모든 skill 문서를 같은 형식으로 대규모 재작성하는 것
- 정적 `skills:check` 통과를 실제 동작 증명의 대체물로 간주하는 것
