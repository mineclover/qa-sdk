---
def:
  id: swc-next-qa-sdk-optimization-readme
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
    - target: coordinate-storage
      type: refs
status: draft
date: 2026-10-28
role: overview
source_plan: PLAN-20261028-SWC-NEXT-QA-SDK-OPTIMIZATION (rev 0.1)
source_issue: ISSUE-TEMP-SWC-NEXT-QA-SDK-OPTIMIZATION
sources:
  - https://drive.google.com/file/d/1DpGATVRN5XccutjIToTvn2GhWIDRdQ5J/view
  - https://app.notion.com/p/407c863ee99b81248a67d45aeeef521a
  - docs/specs/system/coordinate-storage.rule.md
  - packages/core/src/catalog/runtime.ts
supersedes: -
superseded_by: -
---

# SWC Next 원리 기반 최적화·호환성 보완 — 병렬 실행 인덱스

## 목적 ^purpose

Drive 정본 계획(rev 0.1)의 Phase 0~6 로드맵을 **현재 코드 실측 기준으로 검토**하고, 서로 다른 파일 집합을 소유하는 **병렬 작업 트랙**으로 다시 나눈다. 각 트랙은 [`plans/`](./plans/)에 독립 실행 가능한 구현 계획을 가진다.

- 원본 계획: Drive `20261028_plan_swc-next_qa-sdk-optimization-v0.1.md`
- 원본 이슈: Notion `SWC Next 원리 기반 QA-SDK 최적화·호환성 보완 로드맵`
- 코드 인벤토리와 정리 대장: [00-code-inventory.md](./00-code-inventory.md)
- 트랙 경계, 파일 소유권, 머지 규칙: [01-tracks.md](./01-tracks.md)
- 트랙별 구현 계획: [plans/README.md](./plans/README.md)

원본 계획의 목표·비목표·실패 상태 9종·버전 축 분리 원칙은 그대로 유지한다. 이 디렉토리는 원본을 대체하지 않고, **실행 단위로 번역**한다.

## 1. 원본 계획 검토 결과 ^defines

원본의 방향(최적화보다 호환성 계약 먼저, baseline 이후에만 SoA/TypedArray/WASM)은 코드 실측과 맞는다. 다만 다음 항목은 실측과 다르거나, 원본이 가정한 전제가 코드에 없다.

| # | 원본 계획의 가정 | 코드 실측 (2026-10-28, HEAD `24cbafbb`) | 계획 반영 |
|---|---|---|---|
| R-1 | 잘못된 Catalog로 decode하면 다른 의미가 반환될 **위험**이 있다 | **이미 발생 중이다.** SDK 경로(`core/catalog/runtime.ts`, browser-codec)는 `capacity` 기준 stride를 쓰고, registry DecodeMap과 decode-service는 `entries.length` 기준 stride를 쓴다. demo catalog 68개 prefix 전부 shape가 다르다. 예: `service` (1,1,1,1) → SDK 주소 `33825` → DecodeMap 방식 decode 시 `env=528` | Track A의 첫 결정 게이트(D-1). Phase 1 계약의 선행 조건으로 승격 |
| R-2 | 기준선: 85 axes, 51 prefixes, 19 tables | DEMO_CATALOG 실측: 119 axes, 68 prefixes(84 prefix-version, `sum` 모델 1), 19 tables | 숫자는 문서에 고정하지 않고 테스트에서 SSOT로 파생 (CLAUDE.md SSOT 원칙) |
| R-3 | `ingest-adapter` 경로가 있다 | ingest-server에 그 이름의 컴포넌트는 없다. `decision-flow/src/ingest-adapter.ts`는 `address_context`만 만들고, `infra-engine/src/adapters/ingest.ts`는 단건 POST다 | 인벤토리 대상을 실제 경로(`routes/ingest.ts` → `phase-two-worker.ts` → `convergence-pipeline.ts`)로 교체 |
| R-4 | codegen 결과로 drift를 막을 수 있다 | `generateCatalogTypes()` 헤더에 `new Date()` 시각이 들어가 매 실행 결과가 다르다. `computeCatalogHash`는 dims·refEntries·tables·dkgConfig를 해시하지 않는다. registry `catalogHash`는 다른 알고리즘이라 SDK 비교가 항상 불일치한다 | Phase 4 일부(결정론·digest 헤더·drift CI)를 Track D로 **앞당긴다**. snapshot digest가 이것에 의존 |
| R-5 | `PolicyCandidate`와 `FlowPolicy`를 분리한다 | `PolicyCandidate extends FlowPolicy`가 이미 있다(`decision-flow/src/policy-learning.ts:31`). 영속화·승인자·근거 digest가 없다 | Phase 5는 신규 도입이 아니라 **분리 리팩터 + 영속화**로 범위 조정 |
| R-6 | analyzer 버전 관리 기반이 없다 | `TransitionRegistry`는 이미 name→version 레지스트리다. `PatternRule`·`FlowPolicy`·`IntentLink`는 version 필드가 없다 | Phase 5 계약은 `TransitionRegistry` 패턴을 기준으로 확장 |
| R-7 | batch envelope에 snapshot 필드를 추가한다 | `TransmissionEnvelope.entry_snapshot`가 선언만 되어 있고 쓰이지 않는다. wire 인코딩이 4종(JSON, `QAPB` 프레임 JSON, 실제 proto3, msgpack)이고 `QAPB`는 `application/x-protobuf`로 잘못 표기된다. proto 필드 번호도 3가지로 갈린다 | Track B에서 `entry_snapshot` 처리 결정(D-2)과 proto 필드 정합을 함께 다룬다 |
| R-8 | ingest → verdict → transition → convergence 파이프라인 | inline 경로만 transition(로그만, 저장 안 함)·convergence를 실행한다. task queue 경로는 verdict까지만 실행한다. convergence는 interval timer 2개가 같은 flush를 호출한다 | Phase 3 이전에 Track E에서 경로 동등성 결정(D-5, D-4) |
| R-9 | CI에 benchmark·codegen drift job을 추가한다 | `.github/workflows/`에는 `def-verification.yml`, `visbug-bridge-e2e.yml`만 있다. CLAUDE.md가 언급하는 `def-gate.yml`은 없다. benchmark 하네스(`packages/bench`)는 있으나 codec microbench와 CI 연결이 없다 | Track C·D가 각자 workflow 파일을 신규로 소유 |
| R-10 | digest는 JCS canonicalization으로 통일 | 공용 canonical JSON helper가 없다. `@qa-sdk/core`는 `browser-sdk`의 의존성이라 `node:crypto`를 쓸 수 없다 | T0가 WebCrypto 기반 `canonicalJson` + `computeCatalogDigest`를 core에 둔다 |
| R-11 | 모든 prefix version은 layout을 가진다 | DEMO_CATALOG 84개 prefix-version 중 3개(`build_event@v1`, `test_event@v1`, `pattern_anomaly@v1`)는 `getPrefixShape`가 `Unknown axis version: …@undefined`로 실패한다. prefix의 `labels`/`dims`는 버전 공통인데 v2에서 추가된 dim이 v1 `axisVersions`에 없기 때문이다 | T0 snapshot 빌더는 이런 layout을 `issues`로 보고한다(조용히 건너뛰지 않음). 모델 수정은 D-8 |

## 2. 트랙 구성

```text
Wave 0 (직렬, 소형)     T0  계약 기반 — CatalogSnapshot 타입, canonical digest, 실패 코드 9종
                         │
Wave 1 (병렬)            ├─ A  Codec 호환성 + legacy-v1 golden corpus + shape 정합
                         ├─ B  Envelope snapshot binding + ingest 검증 + registry manifest
                         ├─ C  Baseline benchmark + 결과 포맷 + CI job          (T0 불필요, 즉시 착수 가능)
                         ├─ D  Codegen 결정론 + digest 헤더 + drift CI
                         ├─ E  Ingest 파이프라인 정리 (dead code, 배선, 경로 동등성) (T0 불필요, 즉시 착수 가능)
                         └─ F  분석 결정론 준비 (clock 주입, provenance 필드, 타입 중복 제거) (T0 불필요)
                         │
Wave 2 (게이트)          G2 hot/cold EventRecord, batch encode   ← C baseline + A·B 완료
                         G3 incremental convergence              ← E·F 완료 + C baseline
                         G5 analyzer/plugin 계약                 ← F 완료
                         G6 dual-read, shadow, canary, rollout   ← G2·G3
```

원본 Phase와 트랙의 대응:

| 원본 Phase | 담당 트랙 | 비고 |
|---|---|---|
| Phase 0 기준선 | C (benchmark), A (golden fixture), 본 문서 (인벤토리) | 인벤토리는 [00-code-inventory.md](./00-code-inventory.md)로 완료 |
| Phase 1 CatalogSnapshot 계약 | T0 (타입·digest·오류), A (decode 검증), B (wire·registry) | |
| Phase 2 hot path | G2 | C baseline 이후에만 착수 (원본 R2 완화책) |
| Phase 3 incremental | E·F (전제 정리) → G3 | |
| Phase 4 codegen | D (결정론·drift) → G2/G4 확장 (codec·validator·fixture 생성) | |
| Phase 5 analyzer | F (전제) → G5 | |
| Phase 6 rollout | G6 | |

Wave 2 트랙은 [plans/gated-phases.md](./plans/gated-phases.md)에 진입 조건과 범위만 기록한다. 측정 없이 bite-sized 계획을 쓰지 않는다(YAGNI, 원본 R2).

## 3. 결정 게이트

다음 결정은 해당 트랙 착수 전 사람이 확정한다. 각 항목에 권장안을 적었다.

| ID | 결정 | 권장 | 근거 | 차단 대상 |
|---|---|---|---|---|
| D-1 | 주소 shape의 정본: `capacity` vs `entries.length` | ✅ **확정 (2026-10-28): capacity** | CLAUDE.md는 `core/catalog/runtime.ts`를 canonical runtime으로 지정한다. SDK가 이미 capacity로 주소를 생성·저장하고 있어 entries 기준으로 바꾸면 저장된 주소가 전부 깨진다. DecodeMap 쪽이 headroom 슬롯을 `(reserved:N)`으로 채워야 한다 | A, B |
| D-2 | `entry_snapshot` 필드 처리 | 신규 `catalog_snapshot` 객체 필드 추가, `entry_snapshot`은 deprecated 표기 후 유지 | 의미가 다른 필드를 재사용하면 구버전 SDK 해석이 모호해진다 | B |
| D-3 | 쓰이지 않는 `stores/store-factory.ts` | 삭제 (CF Worker 경로가 쓰는 D1 store는 유지) | 런타임 import 0건, `createRuntimeStores`와 중복 | E |
| D-4 | convergence interval timer 2개 | runner 내부 timer 제거, `convergence-scheduler`만 유지 | flush 책임 단일화 | E |
| D-5 | queue 경로가 transition·convergence를 실행하지 않음 | queue 경로에도 같은 Phase 2.5/3 단계 연결 | inline/queue 결과가 달라지면 G3 differential test가 성립하지 않는다 | E, G3 |
| D-6 | digest 표기 길이 | 전체 64 hex + `sha256:` 접두사. 표시용 12자는 파생값으로만 사용 | 12자 truncation은 충돌 판정용 식별자로 부족하다 | T0, D |
| D-7 | benchmark CI 트리거 | `workflow_dispatch` + nightly. PR에서는 smoke 1회만 | 원본 인프라 매트릭스의 "CI 시간 증가" 대응 | C |
| D-8 | 버전마다 dim 구성이 다른 prefix(R-11)의 모델 | ✅ **확정 (2026-10-29)**: `PrefixVersionDef`에 선택적 `labels`를 두어 버전별 dim 목록을 선언하고, 미선언 시 prefix 공통 `labels`를 쓴다 | v1 주소가 실제로 저장돼 있다면 v1 layout을 복원해야 decode할 수 있다. v1을 폐기하면 그 주소는 `MigrationRequired`가 된다 | A |

## 4. 이번 작업에서 반영한 것

- 원본 계획 검토와 트랙 분리 (본 문서, [01-tracks.md](./01-tracks.md))
- 코드 인벤토리와 정리 대장 ([00-code-inventory.md](./00-code-inventory.md))
- 무변경 코드 정리 2건 (인벤토리 §6 "정리 완료" 참고)
- 트랙별 구현 계획 ([plans/](./plans/))
- D-1 확정(capacity) 후 **T0 구현** — `packages/core/src/catalog/snapshot/`, ADR-010 (미커밋, [plans/README.md](./plans/README.md) 검증 상태 참고)

T0는 새 export만 추가하고 기존 런타임 동작·CI·스키마는 바꾸지 않았다. R-1 shape 불일치는 D-1(capacity 확정)에 따라 Track A에서 고친다.

## 5. 미결 사항

- Notion 이슈의 공식 `ISSUE-N` 번호 발급과 이 디렉토리 경로 역링크
- Drive 정본 계획 rev 0.2에 §1 검토 결과(R-1~R-10) 반영 여부
- Wave 2 트랙의 담당자와 착수 시점
