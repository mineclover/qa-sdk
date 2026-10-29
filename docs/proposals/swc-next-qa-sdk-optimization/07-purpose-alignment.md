---
def:
  id: swc-next-qa-sdk-optimization-07-purpose-alignment
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
    - target: system-overview
      type: refs
status: draft
date: 2026-10-30
updated: 2026-10-30
part_of: swc-next-qa-sdk-optimization
role: plan
sources:
  - scripts/package-surfaces.mjs
  - packages/cli/src/command-groups
---

# 목적 기반 기능 정렬과 가지치기 계획 (2026-10-30)

## 목적 ^purpose

지금까지의 정리(03·05·06)는 아래에서 위로 진행했다. 읽는 곳이 있는지, 테스트가 있는지, 중복인지를 개별 기능마다 따졌다. 그런데 이 방식으로는 **기능이 동작하는데 출력이 목적에 비춰 틀렸거나 쓸모없는 경우**를 걸러내지 못한다. M-1 직후 CLI `dkg converge`가 낸 병합 제안 4건이 그런 예다. 코드는 정상으로 돌지만, 그 제안이 맞는지는 아무도 판정하지 않았다.

이 문서는 순서를 뒤집어 위에서 아래로 정렬한다. 시스템 목적 → 목적을 이루는 역량 → 역량의 진입점(CLI·서비스 API) → 구현 패키지 순이다. 목적에 연결되지 않는 기능과 목적에 비춰 출력을 검증할 수 없는 기능을 가지치기 후보로 삼는다.

**판정 규칙:** 기능이 아래 5개 목적 중 어디에 기여하는지 먼저 확인한다. 어디에도 기여하지 않으면 시스템 밖의 것이다.

## 1. 목적 계층 ^defines

현재 범위 결정은 순수 좌표·데이터 계약·분석 로직을 `focus`로, scheduler/worker/flush·DB runtime adapter·외부 provider·web/motion surface를 `freeze`로 둔다. 아래 표의 서비스 진입점은 현 상태와 유지보수 책임을 설명하는 inventory이며, 신규 서비스 구현 우선순위를 의미하지 않는다.

```
F  좌표계 (기반) ─ Catalog 하나에서 주소·코덱·snapshot·생성물을 파생
│
├─ P1 설계 관리        축·prefix·table·DSL 구조를 정의하고 변경을 안전하게 반영
├─ P2 테스트 목록 관리   무엇을 테스트해야 하는지와 그 커버리지
├─ P3 정합성 관리       선언(소유·IntentLink·constraint·catalog)과 실제의 차이 감지
├─ P4 의도 문서 관리     "왜 이렇게 설계했는가"를 지워지지 않는 서사로 기록
└─ P5 변화 관측·흐름 추적  결정에 따른 변화를 좌표로 관측하고 시간축으로 추적
        ↑
   의사결정 흐름 — 결정 → 서사 → 패턴 → 정책 → 자동화 (P1~P5를 순환으로 묶는다)
```

## 2. 목적 → 역량 → 진입점 → 패키지

"상태" 열은 이번 정리에서 확인한 사실만 적는다. ✅는 테스트·실행으로 확인, 🟡는 부분 동작이나 미검증, ❌는 결함이나 미배선이다.

### F 좌표계 (기반)

| 역량 | 진입점 | 패키지 | 상태 |
|---|---|---|---|
| Catalog 정의·검증 | `qa-sdk catalog`, `list-axes`, `list-prefixes`, `def validate` | core `catalog/*`, demo-snapshot | ✅ |
| 주소 encode/decode | `qa-sdk encode`·`decode`·`resolve`, decode-service, browser-codec | core runtime, codec, browser-codec, weighted-index, index-meta | ✅ 3-way parity, legacy-v1 corpus |
| 계약 판본(CatalogSnapshot) | registry `/catalogs/:id/snapshots/*`, envelope `catalog_snapshot` | core `catalog/snapshot`, registry, ingest gate | ✅ ADR-010 계약 테스트 |
| 생성물 | `qa-sdk codegen`, `spec codegen`, `tax codegen` | codegen-core, demo-types, viz-3d 생성기 | ✅ drift 게이트 |

### P1 설계 관리

| 역량 | 진입점 | 패키지 | 상태 |
|---|---|---|---|
| prefix·version 수명주기 (draft→release→active) | registry `/prefixes/*`, `/workspace/*`, `qa-sdk prefix`, `register`, `dry-run` | registry-service, index-meta | ✅ registry e2e 45건 (overflow 결함 수정) |
| 변경 영향 (DAG 전파·schema diff) | `qa-sdk impact`, `derive-refs`, registry `/dag/*`, `/schema/diff` | registry, spec-core propagation | ✅ e2e. `/dag/*`는 저장소 안 클라이언트 0 |
| 설계 그래프 (DKG) | `qa-sdk dkg` 61개 중 axes·prefixes·tables·domains·overview·report | dkg, dkg-enrichment, demo-dkg-config | 🟡 명령이 많고 겹침 (§4 단계 3) |
| 설계 단순화 제안 | `dkg converge`·`overlaps`·`self-check` | dkg-enrichment + convergence | 🟡 **출력 미검증** (§3) |

### P2 테스트 목록 관리

| 역량 | 진입점 | 패키지 | 상태 |
|---|---|---|---|
| 테스트 선언·좌표 부여·커버리지 | `qa-sdk test scan·assign·scaffold·status·report` | test-scenario-store, test-types | 🟡 declared→assigned는 흐름 테스트로 고정. **assigned→collected·verified로 넘기는 실행 기록(`recordRun`) 호출 경로가 CLI에 없다** — report는 진행 상태를 끝까지 보여 줄 수 없다. `test scaffold` stub은 `expect(true).toBe(true)`라 항상 통과한다 |
| 품질 게이트 번들 | `qa-sdk quality` 9개 | definition-catalog gate 문서, quality-ledger | 🟡 미검증 |
| facet 테스트 | `qa-sdk facet scan·inject`, facet-tests | facet-tests | 🟡 미검증 |
| 시나리오 판정 (verdict) | ingest `/v1/traces/:id/verdicts`, scenario routes | ingest-server, spec-core | ✅ Phase 2 verdict 테스트 |

### P3 정합성 관리

| 역량 | 진입점 | 패키지 | 상태 |
|---|---|---|---|
| envelope ↔ catalog 판본 대조 | ingest snapshot gate | ingest-server, core snapshot | ✅ |
| 등록 안 된 좌표 관측 | `/v1/key-observations/*` | ingest-server | ✅ (U-4) |
| 활성화 전 constraint 검사 | registry activation gate | registry, spec-core propagation | 🟡 graph가 demo catalog 고정 (N-4) |
| 주소 상태 게이트 (active·inactive·reserved) | gate-service `/gate/*` | gate-service, index-meta GateEngine | ❌ 엔진 데이터 공급 경로 없음 (S-4) |
| 소유권 (ownedPrefixes) | `qa-sdk service owners·ownership-topology` | registry, cli | 🟡 미검증 |
| entry 커버리지·배포 스큐 | `dkg coverage`·`skew`, convergence metrics | dkg-enrichment, convergence | 🟡 **출력 미검증** (§3) |
| 문서 정합성 | `def validate`·`sync`·`scan-audit` | definition-catalog, cli | ✅ CI 게이트 |

### P4 의도 문서 관리

| 역량 | 진입점 | 패키지 | 상태 |
|---|---|---|---|
| 정의 문서 좌표화·링크 검증 | `qa-sdk def`, `docs` 22개, definition-service | definition-catalog, definition-service, doc-envelope | ✅ (`def validate` 경고 0) |
| 의사결정 기록 | `qa-sdk decision`, `dkg decide·decisions·claim`, decision-service | decision-flow, decision-flow-store, dkg | 🟡 decision-service는 클라이언트 0 |
| 리뷰 이력 | `qa-sdk review` 8개 | cli, review-ledger | 🟡 미검증 |

### P5 변화 관측·흐름 추적

| 역량 | 진입점 | 패키지 | 상태 |
|---|---|---|---|
| SDK 관측 → 수집 | logger·sdk·apm·browser-sdk → ingest `/v1/ingest` | logger, sdk, apm, browser, codec-proto, ingest-server | ✅ |
| trace·session 재구성 | ingest `/v1/traces`, `qa-sdk ingest trace·recent` | ingest-server, store | ✅ (S-6 영속 수정) |
| 관측 → DKG observation (convergence) | ingest convergence pipeline, `dkg metrics·observations·observe` | convergence, dkg-enrichment | 🟡 pure 출력은 proof suite로 검증, scheduler/worker 배선은 동결 |
| 흐름 스키마 실행·분석 | `qa-sdk flow` 16개 | spec-transition, cli | 🟡 미검증 |
| 시점 상태 재생 | query `/state/:c/:r/at` | query-service | 🟡 replay만 동작, 현재 상태 store 없음 (S-5) |
| 인사이트 조회 | `/v1/insights/*`, `qa-sdk ingest insights` | ingest-server | 🟡 9개 라우트 클라이언트 0 |

## 3. 출력 신뢰도 — 분석 기능은 "어떤 결정을 돕는가"로 검증한다

분석 기능은 테스트가 통과해도 출력이 틀릴 수 있다. 테스트는 "이 입력에 이 값이 나온다"만 고정할 뿐 "그 값이 결정에 맞는가"는 보지 않는다. 그래서 아래 기능은 목적에 비춰 검증되기 전까지 **신뢰 보류**로 둔다.

| 분석 출력 | 돕는 결정 | 의심 지점 | 검증 방법 |
|---|---|---|---|
| `dkg converge` merge 제안 | 축·prefix 병합 (P1) | prefix 병합 4건(`engine_event↔validation_event` 등)은 `comparePrefixes`가 공유 축·참조 비율(구조 유사도)만 보고 판정한다. 구조가 같고 의미가 다른 이벤트도 묶일 수 있다 | demo catalog에서 사람이 판정한 골든 목록(병합·분리·alias)을 만들고 precision·recall을 잰다 |
| `dkg converge` simplify·deactivate | 차원 제거·entry 비활성화 (P1) | 단일값 차원 판정은 관측량에 민감하다. 테스트 데이터 편향을 설계 결함으로 오인할 수 있다 | 관측 기간·표본 수 하한을 두고 그 미만이면 제안하지 않는다. 골든 시나리오로 확인 |
| `dkg coverage` (dormant·phantom) | 테스트·관측 보강 (P2·P3) | dormant가 "미사용"인지 "미관측"인지 구분하지 않는다 | 관측 경로가 있는 축만 판정 대상으로 삼는다 |
| `dkg skew`, convergence metric → observation | 배포 스큐 대응 (P5) | 집계 기반 판단 원칙(메모리 `feedback_skew-by-aggregation`)과 정의 기반 판정이 섞여 있다 | 집계 기반만 남긴다 |
| pattern anomaly → observation | 이상 행동 대응 (P5) | 이전 윈도우 대비 비교라 첫 윈도우·저트래픽에서 잡음이 크다 | 최소 표본 기준을 둔다 |
| `/v1/insights/*` 9개 | 운영 판단 (P5) | 읽는 곳 0 — 어떤 결정에 쓰는지 정의되지 않았다 | 결정이 정의되지 않으면 가지치기 (§4 단계 4) |

## 4. 목적 밖 또는 목적이 불명확한 영역

| surface | 패키지·진입점 | 관찰 | 질문 (사람 결정) |
|---|---|---|---|
| motion-authoring | motion-* 4개, `qa-sdk motion` 13개 | GSAP 모션 저작. 5개 목적과 연결 고리가 보이지 않는다 | 시스템 밖으로 분리할지 |
| ontology 계열 | operational-ontology, authorization-ontology, ontology-pack-validate, `qa-sdk ontology` 40개 | 권한·운영 ontology를 좌표로 관리. P1 설계 관리의 한 도메인인지, 별도 제품인지 불명확 | P1 하위 도메인으로 둘지, 별도 제품으로 분리할지 |
| taxonomy 계열 | taxonomy-engine, taxonomy-decision-bridge, taxonomy-web, `qa-sdk tax` 8개 | yaml 텍소노미 검증·codegen. Catalog(F)와 별도 SSOT처럼 보인다 | Catalog와 관계 (중복 SSOT인지 상위 분류인지) |
| visual-analysis-tools | viz-3d·viz-core·viz-web, visbug-bridge, rlsc-analysis, browser-layout-inspector | 일부는 좌표 시각화(P5 보조), 일부는 디자인 구조 분석(RLSC 비전) | RLSC를 P1 설계 관리의 확장으로 볼지 |
| federated-connection | federated-connection(-runtime) | 런타임 진입점 없음 | 유지 근거 |
| simulation-contracts | sim-* 6개 | enterprise-pm 시뮬레이션 계약. P2 검증용 fixture 성격 | `simulations/`로 이동할지 |
| product-demo-surfaces | 데모 웹 8개 | P5 시연. 06 §5 판정 대기 | 06 §5 |
| 운영 지원 (목적 아님, 필요) | gateway, otel, infra-engine, infra-env-kit, db-traffic-control, nest-service-kit, scaffold | 목적을 직접 이루지 않지만 서비스 운영에 필요 | 유지. 단 목적 기능보다 앞서 확장하지 않는다 |

## 5. 가지치기 계획

### 단계 1 — 목적별 핵심 흐름 고정 (기준선)

목적마다 사용자가 끝까지 해 보는 흐름 하나를 정하고 e2e smoke로 고정한다. 이 흐름에 걸리는 기능이 "핵심"이고, 나머지는 단계 3·4에서 판정한다.

| 목적 | 핵심 흐름 (초안) |
|---|---|
| F | catalog 변경 → codegen → SDK encode → decode-service decode가 같은 값 |
| P1 | prefix draft → impact/dry-run → release (overflow·breaking은 거부) |
| P2 | spec `tests:` 선언 → `test scan` → `test assign` → `test record` → `test report`에 실행 결과 반영 |
| P3 | 구버전 SDK envelope → snapshot gate 판정 → 등록 안 된 key 관측 |
| P4 | 결정 기록 → DKG decision 노드 → 문서 링크 검증 |
| P5 | SDK 이벤트 → trace 재구성 → convergence observation → `dkg observations` |

기존 `workflow-smoke`(L3, 12건)를 이 표 기준으로 재편한다.

**1단계 반영 (2026-10-29).** 목적마다 흐름 테스트 `*.purpose-flow.test.ts`를 흐름의 마지막 단계를 소유한 패키지에 두고, 파일 머리에 `@purpose <id>`를 단다. ci-local `purpose flows cover F·P1~P5` 단계가 목적별 흐름 존재와 소유 패키지의 CI 포함 여부를 확인한다. CLAUDE.md가 말하는 `workflow-smoke`(def-gate.yml)는 저장소에 없다 — 현재 workflow는 `def-verification.yml`이다.

| 목적 | 흐름 테스트 | 흐름을 만들며 드러난 것 |
|---|---|---|
| F | `decode-service/src/coordinate.purpose-flow.test.ts` — catalog → registry decode-map → decode-map 동기화 → HTTP `/decode`가 모든 product prefix에서 SDK encode 값과 같음. entry를 덧붙여도 예전 주소 유지 | — |
| P1 | `registry-service/src/e2e/design.purpose-flow.test.ts` — draft → simulate → lock·release·activate → active, overflow는 OVERFLOW | 첫 차원 capacity 확대는 stride 불변(마이그레이션 불필요)이라는 simulate 판정이 맞았다 — 흐름 작성자(나)의 기대가 틀렸다 |
| P2 | `cli/src/commands/test-list.purpose-flow.test.ts` — spec `tests:` → scan → assign → record → report (collected까지) | ① 같은 spec·같은 kind 선언 둘째부터 조용히 버려짐 → scan이 경고하도록 수정 ② definition-catalog yaml-lite가 블록 배열 항목 값의 따옴표를 벗기지 않아 `module: '@qa-sdk/…'`가 파일 경로를 깨뜨림 → `unquote`로 수정 ③ `test record`로 collected까지 진행했으며 collected → verified 정책은 별도 결정 필요 |
| P3 | `ingest-server/src/integrity.purpose-flow.test.ts` — 구버전 SDK 수락, catalog 밖 prefix key는 미등록 관측(warn), layout 밖 주소는 enforce 422 | — |
| P4 | `cli/src/commands/intent.purpose-flow.test.ts` — recordDecision → DKG 저장 → 재로드 후 `traceNode`에서 결정 추적, 결정 문서 링크 검증 | — |
| P5 | `ingest-server/src/observation.purpose-flow.test.ts` — 이벤트 3건 → trace 재구성 → 실제 convergence·DKG 분석 → usage snapshot에 관측량 반영 | — |

부수 정리: 이번 세션 spec 수정으로 approved leaf 2건이 150줄을 넘어 definition-catalog 크기 게이트(로컬 CI 밖이었다)가 실패 — snapshot gate 절을 `ingest-snapshot-gate.spec.md`로 분리하고 pipeline-phase-flow를 줄였다. definition-catalog를 로컬 CI 테스트 대상에 추가.

### 단계 2 — 분석 출력 검증 (§3)

demo catalog로 사람 판정 골든 세트를 만들고, §3 출력마다 precision을 잰다. 기준에 못 미치는 분석은 둘 중 하나로 처리한다.

- 고친다 (표본 하한, 판정 규칙 보정)
- 제안 등급을 낮춘다 (결정 생성 대신 observation만)

#### 2단계 결과 (2026-10-29, 골든 초안)

골든 데이터는 `packages/dkg-enrichment/src/__golden__/purpose-alignment.ts`에 두고, `judgment: proposed`를 유지한다. 정밀도는 `TP / (TP + FP)`로 계산했으며, 판단 보류와 제안하지 않은 경우는 분모에서 제외한다. 아래 80% 하한은 §6의 사람 확정 전 임시 기준이다.

| 분석 | 현재 출력 요약 | 골든 초안 항목 수 | precision (임시 기준 ≥80%) | 처리 | 근거 |
|---|---|---:|---:|---|---|
| `convergeChain` prefix merge | 순수 demo에서 4건(`engine_event↔validation_event`, `test_event↔test_coverage`, `cli_event↔cli_tracking`, `ir_pipe↔ir_intent_path`)이 구조 유사도 75~100%로 merge 후보 | 4 | 기존 0/4=0%; 수정 후 merge 결정 0건·observation 4건 | 등급 하향 | DEMO_DKG_CONFIG의 validation layer, flow_variant 확장, skill outcome 분리와 IR의 category/addressModel 차이가 병합보다 분리를 지지한다. |
| `convergeChain` simplify·deactivate | 1건 관측에서 page_view 단일값 제안(기존에는 공유 축을 통해 다른 prefix에도 전파); 500건 안정 표본에서는 page·locale·userType 3건 | 2 | 저표본 기존 0/3=0%; 30건 하한 후 500건 후보 3/3=100% | 수정 + 보고 | 주소 표본 합계 30건 미만은 제안하지 않는다. 충분한 표본 후보는 사람 확정 전 proposed로 남긴다. |
| `auditCoverage` dormant·phantom | 빈 usage에서 0%, dormant 783건, zero prefix 68개, phantom 0; 축별 충돌값 `flow_step=admin`은 기존 phantom 누락 | 3 | dormant Decision 기준 기존 0/68=0% (수정 후 0건); 축별 phantom 1/1=100% | 수정 + 보고 | traffic 없는 prefix는 `OBS-COV-ZERO`만 만들고, low coverage Decision은 실제 주소가 있는 prefix로 제한한다. 공유 축의 완전한 prefix 귀속은 추가 자료가 필요하다. |
| `analyzeDeploymentSkew`, `dkg skew` | 현재 snapshot의 `cli_event v1 1건`은 스큐 없음; count가 큰 v1과 작은 v4를 비교하면 v1을 최신으로 오판 | 1 | 기존 canary 0/1=0%; catalog 최신 version 전달 후 1/1=100% | 수정 | 동시 version 탐지는 집계로 유지하고, 최신·구버전과 stale consumer 판정은 catalog release metadata를 전달할 때만 수행한다. |
| pattern anomaly → observation | 첫 윈도우·저트래픽에서 ratio/volume 급변이 warning/critical이 될 수 있음; pipeline은 info를 Observation으로 저장하지 않음 | 3 | 기존 저표본 0/2=0%; 하한 후 충분 표본 1/1=100% | 수정 + 보고 | previous/current 각 5세션 미만은 ratio·volume을 보류한다. 첫 윈도우 미분류 info는 통계에만 남기고, pipeline 경로를 골든 테스트로 고정했다. |

판정은 아직 사람이 확정하지 않았다. 다음 항목을 확정해야 한다.

1. 임시 precision 하한 80%, simplify 최소 표본 30건, pattern 윈도우 최소 5세션의 운영 기준.
2. prefix merge를 다시 결정으로 올릴 수 있는 의미 근거(category·addressModel·invariant·owner)와 IR 쌍의 분리 여부.
3. 공유 축 EntryUsage의 prefix provenance를 보강하기 전 coverage를 observation 전용으로 둘지.
4. catalog 최신 version이 아직 관측되지 않은 skew와 session별 사용량을 사람이 어떻게 해석할지.
5. pattern anomaly Observation에 `svc_ref·behavior_pattern·severity` 좌표를 추가할지. `/v1/insights/*` 행은 이번 1~5 대상 범위 밖이며 별도 사람 결정으로 남긴다.

### 단계 3 — CLI 260개 명령 목적 태깅

모든 명령에 목적(F·P1~P5·운영)을 붙이고 아래를 정리한다.

- 목적 없는 명령
- 같은 정보를 다른 이름으로 보여 주는 명령 (dkg `report`·`overview`·`audit`·`self-check` 등)
- 단계 1 핵심 흐름에도, 단계 2 검증 대상에도 없는 명령

명령 정의(`command-groups/*.commands.ts`)에 목적 필드를 두면 도움말·문서·smoke가 같은 분류를 쓴다.

### 단계 4 — surface 판정 (§4) → 06 §5 실행

§4 질문에 답이 정해지면 06 §5 방식(삭제·통합·동결)으로 실행한다.

### 단계 5 — 문서 정렬

spec 문서에도 목적을 붙여 단계 3과 같은 기준으로 정리한다. 목적에 연결되지 않는 spec과, 삭제·동결된 기능의 spec이 대상이다. definition-catalog 좌표에 이미 scope·aspect가 있으므로 목적은 별도 축이 아니라 기존 `projection_plane`·`aspect`와의 매핑으로 시작한다.

## 6. 결정이 필요한 것

1. §4 표의 질문들 (motion·ontology·taxonomy·RLSC·federated·simulation)
2. §5 단계 1 핵심 흐름 초안이 목적을 대표하는지
3. 단계 2의 판정 기준 (현재 제안: precision 하한 80%, 사람 확정 필요)
