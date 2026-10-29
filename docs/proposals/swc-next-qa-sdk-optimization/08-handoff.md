---
def:
  id: swc-next-qa-sdk-optimization-08-handoff
  type: knowledge
  knowledge_kind: proposal
  lifecycle: draft
  owner_system: apm-system
  projection_plane: intent
  scope: meta
  aspect: proposal_design
  tier: system
  depth: overview
  links:
    - target: swc-next-qa-sdk-optimization-readme
      type: depends_on
status: draft
date: 2026-10-29
part_of: swc-next-qa-sdk-optimization
role: handoff
---

# 핸드오프 (2026-10-29)

## 목적 ^purpose

이 작업을 이어받는 사람이나 에이전트가 이 문서 하나로 현재 상태, 남은 결정, 다음 작업, 작업 규칙을 파악하게 한다. 세부 근거는 각 번호 문서에 있다.

## 1. 현재 상태 ^defines

- 브랜치 `main`, `origin/main`보다 **약 95 커밋 앞섬, push하지 않음**. push 여부는 사람 결정이다 (04 P0). `8a624692`에 다른 주제의 삭제분이 섞여 있다 (`8a50248d`에 기록).
- 로컬 CI: `node scripts/ci-local.mjs` — 43단계 (tests 대상 36개 패키지 + typecheck + gates + bench smoke + 목적별 흐름 검사). 이번 이어받기에서 `--only=typecheck|gates|tests`를 재실행했다(아래 검증 결과 참조).
- 문서: `def validate` 경고 0건.

이번 이어받기에서 확인한 상태 (2026-10-30):

- 목적 정렬 2단계 골든 테스트 8건, `dkg-enrichment` 전체 38건, `convergence` 전체 64건, CLI DKG 관련 22건, core 1,294건, demo-snapshot 90건, dkg 159건, test-scenario-store 7건, snapshot store 8건, P2 흐름·ingest pipeline 골든 테스트가 통과했다.
- `dkg-enrichment`, `convergence`, `ingest-server`, `cli`의 변경 범위 타입체크가 통과했다.
- `corepack pnpm exec qa-sdk def validate`가 경고 0건으로 통과했다. `git diff --check`도 통과했다.
- `node scripts/ci-local.mjs --only=typecheck` 1/1, `--only=gates` 8/8, `--only=tests` 33/33 단계가 통과했다.
- `corepack pnpm ci:core` 6/6 통과. `--with-dkg`는 Drizzle·SQLite closure를 포함하는 확장 검증으로 분리한다.
- `corepack pnpm arch:feedback` 6/6 단계와 `arch:usage` 116개 패키지 표면 분석이 통과했다.
- 골든 판정은 문서와 테스트 모두 `judgment: proposed`를 유지한다. 사람 확정 없이 운영 기준을 `approved`로 승격하지 않는다.

## 2. 문서 지도

| 문서 | 내용 | 상태 |
|---|---|---|
| [README](./README.md) | 계획 리뷰 R-1~R-11, 결정 D-1~D-9 | D-9(scheduler 제거)는 G3에서 결정 |
| [00](./00-code-inventory.md) | 코드 인벤토리, 1·2순위 정리 | 1순위 완료 |
| [01](./01-tracks.md) | 병렬 트랙 파일 소유 | Track A~F·T0 완료 |
| [02](./02-convergence-flush-review.md) | scheduler·flush 검토 | D-9 대기 |
| [03](./03-unwired-spec-review.md) | 미배선 spec 배선·삭제 | 완료 (U-6·U-7은 G3) |
| [04](./04-status-and-remaining.md) | 원본 이슈 체크리스트 대조, 우선순위 | 갱신됨 |
| [05](./05-interface-map.md) | ADR-010 인터페이스와 안정성 등급 | I-1 완료, I-2·I-5 대기 |
| [06](./06-feature-cleanup-candidates.md) | 기능 정리 후보 (결함 S, stub N, 중복 M, 패키지 그룹, 테스트 T, 배포 V) | 아래 §3 |
| [07](./07-purpose-alignment.md) | 목적(F·P1~P5) 기반 정렬과 가지치기 5단계 | 단계 1·2 완료, 3~5 대기 |

## 3. 남은 결정 (사람)

| # | 결정 | 출처 |
|---|---|---|
| 1 | 미push 커밋 push 여부 | 04 P0 |
| 2 | gateway production `AUTH_MODE` 기본값 (지금 `bypass`) | 06 S-3 |
| 3 | gate-service GateEngine 데이터 공급 경로 (registry prefix·entry·flag → gate) | 06 S-4 |
| 4 | ingest `stores/pg/*` — adapter·migration 구현은 동결, 외부 소비자 확인 후 삭제·archive | 06 M-3 |
| 5 | App Hub insights stub 삭제 | 06 N-1 |
| 6 | 읽는 곳 없는 HTTP 라우트 정리 (insights 9개, decision-service 전부 등) | 06 §3 |
| 7 | 패키지 그룹 삭제·통합·동결 | 06 §5 |
| 8 | 배포 버전·changelog 규칙 (publish 대상 14개가 breaking 후에도 0.1.0) | 06 V-1 |
| 9 | **방향 확정** — ontology·taxonomy·federated·simulation·RLSC의 순수 데이터/분석 모델은 구현, motion·web·runtime surface는 동결. 세부 package disposition은 후속 | 07 §4 |
| 10 | 분석 출력 골든 초안 확정 — precision 하한 80%, simplify 최소 30건, pattern 최소 5세션, prefix merge 승격 근거, coverage observation 전용 여부 | 07 §5 단계 2 결과 |
| 11 | snapshot contract·digest·codec와 backend-agnostic 논리 저장 인터페이스는 구현, ingest/DB adapter·replay는 후순위. `entrySnapshot` 제거 시점은 별도 | 05 I-2·I-5 |
| 12 | **방향 확정** — convergence scheduler/worker 전환은 동결하고 현재 주기 회귀만 유지 | README D-9 |

## 4. 다음 작업 (권장 순서)

1. **07 단계 2 골든 확정** — `packages/dkg-enrichment/src/__golden__/purpose-alignment.ts`의 `judgment: proposed` 항목을 사람이 확정하고, 확정값으로 `purpose-alignment.golden.test.ts` 기준을 고정한다.
2. **P2 테스트 목록의 검증 정책** — `qa-sdk test record <b-coord> --passed|--failed`가 실행 결과를 `test-scenario-store.recordRun`으로 넘겨 assigned → collected까지 진행한다. collected → verified 승격 규칙과 `test scaffold` stub(`expect(true).toBe(true)`)의 실제 검증 기준은 사람 결정/후속 구현으로 남아 있다.
3. **07 단계 3** — CLI 명령 약 260개(dkg 61, ontology 40, docs 22, …)에 목적을 붙이고 목적 없는·중복 명령을 정리한다. 명령 정의(`packages/cli/src/command-groups/*.commands.ts`)에 목적 필드를 둔다.
4. 07 단계 4·5 — §3 결정 7·9가 나오면 06 §5 방식으로 실행, spec 정렬.

이번 이어받기에서 닫힌 항목은 분석 출력의 검증, P2 실행 결과의 collected 전이, 핸드오프 기록까지이며, 사람 판정이 필요한 골든 확정·verified 승격 정책·CLI 목적 태깅은 아직 실행하지 않았다.

## 5. 프로젝트 범위 전환 (사용자 결정, 2026-10-30)

앞으로의 구현은 **순수 로직과 데이터 설계**를 중심으로 진행한다. 외부 라이브러리 연동, 네트워크 서비스, 배포 런타임, UI·데모 기능은 신규 구현을 중단하고 유지보수 범위로 둔다.

허용하는 핵심 작업:

- 좌표·인코딩·메타데이터: `weighted-index`, `bit-index`, `index-meta`, `@qa-sdk/core`, `permission-engine`
- 정의·스펙·분석: `definition-catalog`, `spec-schema`, `spec-core`, `spec-transition`, `spec-tracker`, `spec-analyzer`, `@qa-sdk/convergence`, `snapshot-io`, `codegen-core`
- 결정·증거·검증 데이터: `decision-flow`, `dkg`, `dkg-enrichment`, `test-scenario-store`, `quality-ledger`, `review-ledger`, `test-types`
- 순수 어휘·계약 설계: `taxonomy-engine`, `taxonomy-decision-bridge`, `federated-connection` 계약, ontology 데이터 모델

유지보수만 허용하는 범위:

- `gateway`, `ingest-server`, `registry-service`, `decode-service`, `gate-service`, `query-service`, `decision-service` 같은 서비스 런타임
- `@qa-sdk/cli`의 기존 핵심 흐름과 서비스 연결 코드
- `@qa-sdk/store`, `codec-proto`, `logger`, `otel` 같은 실행·어댑터 계층

신규 구현을 동결하는 범위:

- `motion-*`, 시각화·브라우저·웹·데모 surface, `platform-demo`, `roleplay-web`
- simulation runtime과 `federated-connection-runtime`
- App Hub insights stub, 사용처 없는 HTTP route, `ingest/stores/pg/*` adapter·migration·runtime wiring
- 새 provider·외부 API·네트워크 adapter·배포 worker·UI 기능

동결은 버그·보안·호환성 수정과 기존 계약을 검증하는 테스트까지 금지한다는 뜻이 아니다. 새 기능은 먼저 순수 로직 또는 데이터 계약으로 분리할 수 있는지 검토하고, 서비스·외부 연동 구현은 그 계약이 확정된 뒤 별도 결정으로 연다.

스케줄러와 스냅샷은 계층을 나눠서 판단한다.

- **convergence scheduler / worker / flush 실행**은 서비스 운영 계층이다. D-9는 신규 worker 구현이나 주기 전환을 이번 범위에서 제외하고, 현재 동작의 회귀·보안 수정만 유지한다.
- **CatalogSnapshot·catalog digest·호환성 판정·snapshot codec**은 순수 데이터 설계와 로직이므로 계속 구현한다.
- **ingest 수집, DB 영속, batch 문맥 조회, replay API**는 서비스·저장 운영 계층이므로 후순위로 둔다.
- **PostgreSQL·RDB·NoSQL·인메모리·키-값 adapter 구현**은 후순위로 둔다. 대신 목적별 필드/컬럼 의미, 상태·불변식, provenance, version/digest, idempotency, 조회·보존 요구를 정의하는 논리 저장 인터페이스와 검증 모델은 핵심 범위로 계속 다룬다.

기존 9번 결정(목적 불명확 영역)은 다음처럼 재분류한다. ontology·taxonomy·federated identity/connection contract·simulation contract·RLSC의 순수 데이터 모델과 분석 알고리즘은 `focus`로 승격하고, motion authoring runtime, ontology/taxonomy web, federated runtime, simulation view/service는 `freeze`로 둔다.

이 방향은 사용자 범위 결정으로 확정한다. 다만 각 패키지를 `focus`·`freeze`·`quarantine` 중 어디에 둘지, 외부 소비자 확인 없이 삭제할 수 있는지는 별도 승인 없이 추정하지 않는다.

정리 순서는 `package-surfaces`의 disposition 갱신 → fan-in·외부 소비자 확인 → 삭제·archive·동결 실행 → `arch:usage`, `arch:check`, `arch:feedback`과 전체 CI 재검증으로 고정한다. 삭제는 소비자·문서·spec 참조를 함께 정리한 뒤 진행한다.

저장 설계 원칙은 backend-agnostic으로 고정한다. 필수 DB 인터페이스는 "어떤 DB를 쓰는가"가 아니라 "어떤 목적의 데이터를 어떤 불변식과 조회 계약으로 보존하는가"를 선언해야 한다. adapter는 인메모리·SQLite·RDB·NoSQL·키-값 중 하나로 교체할 수 있어야 하며, 같은 계약 테스트를 통과해야 한다.

이번 구현 단위에서 다음 pure 계약을 실제 코드로 구성했다.

- `@qa-sdk/core`에 `CatalogSnapshotStore` port와 snapshot 발행 결과/충돌 원인 타입을 추가하고 registry의 InMemory·SQL 구현이 이를 사용하도록 했다.
- `test-scenario-store`에 backend-agnostic port, declared → assigned → collected 전이표, run history 조회(`listRuns`/`latestRun`)를 추가했다. verified·idempotency 정책은 아직 열어 둔다.
- `dkg`에 Decision/Observation 필수 필드, provenance, resolution 참조를 검증하는 pure validator를 추가했다.
- `dkg`에 usage snapshot port와 `snapshotId/catalogId/digest/idempotencyKey/period/totalRecords` 불변식 validator를 추가했다. 실제 DB adapter 연결은 보류한다.
- `core`에 fixture 전수 좌표 round-trip·snapshot arithmetic proof 4건, `demo-snapshot`에 실제 DEMO_CATALOG prefix/version integration proof 3건을 추가했다.

남은 데이터 설계 gap은 adapter가 위 계약을 실제로 멱등 적용하는 방식과 TestScenarioRun의 verified 승격 정책이다. backend 선택과 runtime 배선은 이 정책이 확정된 뒤에 검토한다.

이번 adapter 경계 분리도 완료했다.

- `dkg` root에서 SQLite/Drizzle store를 제거하고 `dkg-store`로 이동했다.
- `@qa-sdk/spec-core`의 store subpath와 Drizzle/index-meta production dependency를 제거했다. store 테스트는 `dkg-store` adapter를 직접 사용한다.
- `index-meta` root에서 SQL/native persistence export와 Drizzle dependency를 제거하고 `index-meta-store`로 이동했다. 순수 codec/registry/client 경로는 `index-meta`에 남긴다.
- 서비스·CLI·테스트의 persistence imports는 `dkg-store`·`index-meta-store`로 전환했다.
- pure `index-meta`는 819 tests/typecheck/build, `index-meta-store` adapter는 168 tests/typecheck/build, `dkg-store`는 20 tests/typecheck/build, `spec-core`는 234 tests/typecheck를 통과했다.
- registry-service dashboard 3건은 Nest cold bootstrap과 고정 SQLite 경로 contention이 원인이었다. 테스트별 `mkdtemp` DB 경로와 30초 timeout을 적용했고 dashboard 2 files/28 tests와 registry-service 전체 52 files/507 tests가 통과했다.
- adapter proof는 `dkg-store` 20 tests, `index-meta-store` 168 tests, `index-meta-workers` no-Node leak으로 닫았다. pure `index-meta`는 Drizzle/native runtime import가 없다.

## 8. Core proof와 저사양 개발 경로

convergence·DKG pure proof는 `packages/dkg-enrichment/src/core-logic-proof.test.ts`에 둔다.

- 고정 Catalog·Graph·Usage·Clock으로 `runConvergenceAnalysis`를 두 번 실행해 결과·순서·날짜·provenance가 동일한지 검증한다.
- `convergeChain`의 axis merge와 prefix-structure observation을 분리해 동일 결과를 검증한다.
- 빈 coverage의 observation-only 동작과 DKG Decision/Observation validator를 함께 검증한다.
- 서비스·HTTP·DB adapter·SQLite를 import하지 않는다.

현재 저사양 호스트에서 바로 사용할 수 있는 최소 경로는 `@qa-sdk/core`, `demo-snapshot`, `@qa-sdk/convergence`, `index-meta`, `weighted-index`, `spec-schema`, `spec-transition`, `codegen-core` 중심으로 제한한다.

이 경로는 `corepack pnpm ci:core`로 자동 실행하며, 현재 9/9 단계가 통과한다. `corepack pnpm ci:core -- --with-dkg`는 DKG proof까지 포함하지만 현재 Drizzle·SQLite closure를 함께 설치한다.

```bash
corepack pnpm install --frozen-lockfile \
  --filter @qa-sdk/core... \
  --filter demo-snapshot... \
  --filter @qa-sdk/convergence... \
  --filter index-meta... \
  --filter weighted-index... \
  --filter spec-schema... \
  --filter spec-transition... \
  --filter codegen-core...

corepack pnpm --filter @qa-sdk/core test
corepack pnpm --filter demo-snapshot test
corepack pnpm --filter @qa-sdk/convergence test
```

`dkg`, `dkg-enrichment`, `spec-core`, `index-meta`의 pure entrypoint에서는 production Drizzle/SQLite 의존성을 제거했다. `dkg-store`·`index-meta-store`를 직접 포함하는 adapter/service profile과 `weighted-index`의 dev-only test dependency는 여전히 무거울 수 있으므로, 저사양 기본 profile에는 넣지 않는다.

Nest·gRPC·BullMQ·GraphQL·Pulumi·Redis·OpenTelemetry·provider SDK를 포함하는 service/runtime package와 web/demo/motion surface는 이 profile에서 설치·빌드하지 않는다.

## 9. 작업 규칙과 함정

- **파괴적 git 금지** (`restore`·`reset`·`clean`·`stash` 등) — 다른 에이전트와 작업 트리를 공유한다. push는 사람 지시가 있을 때만.
- **CI는 로컬에서 확인** — `node scripts/ci-local.mjs` (`--only=gates|tests|typecheck|bench`, `--skip=…`, `--list`). 전체 약 10분.
- `pnpm --filter <name>`은 **이름이 틀려도 exit 0**이다. ci-local은 TEST_PACKAGES를 workspace 목록과 먼저 대조한다. 패키지 이름은 `package.json`의 `name`을 쓴다 (예: `query-service`, `gate-service`는 scope 없음).
- workspace 루트 프로젝트(`qa-sdk`)의 경로는 모든 파일의 접두사다 — 파일 소유 패키지는 가장 긴 경로로 찾는다.
- **목적별 흐름 테스트**는 `*.purpose-flow.test.ts` + 머리 주석 `@purpose <F|P1~P5>`. ci-local이 목적별 존재와 소유 패키지의 CI 포함을 검사한다.
- definition-catalog **문서 크기 게이트**: approved leaf가 150줄을 넘으면 실패한다. 기준을 올리지 말고 문서를 나눈다.
- 서비스 환경변수는 `config/env.ts` zod 스키마로만 읽는다 (gateway 포함).
- CLAUDE.md의 `workflow-smoke`(def-gate.yml) 안내는 낡았다 — 현재 workflow는 `.github/workflows/def-verification.yml`.
- `.antigravitycli/`(다른 도구의 로컬 상태)는 `.gitignore` 처리, `arch:verify`는 git 기준 파일 목록을 쓴다.
- 2단계 Codex 작업은 세션 `01a187cc-c82f-7e93-9e5c-3bcbab1cbefc`로 이어 갈 수 있다 (`codex resume …`).
