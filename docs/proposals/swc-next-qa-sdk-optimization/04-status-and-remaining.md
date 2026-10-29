---
def:
  id: swc-next-qa-sdk-optimization-04-status-and-remaining
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
role: status
---

# 진행 현황과 남은 작업 (2026-10-29)

## 목적 ^purpose

원본 이슈(Notion `ISSUE-TEMP-SWC-NEXT-QA-SDK-OPTIMIZATION`)의 체크리스트와 관련 GitHub 이슈(#15, #16)를 기준으로 지금까지 반영한 것과 남은 것을 한 곳에 정리한다. 로컬 `main`은 `origin/main`보다 49 커밋 앞서 있고 push하지 않았다.

## 1. 원본 이슈 체크리스트 대조 ^defines

| 체크리스트 (Drive 계획 §10) | 상태 | 근거 |
|---|---|---|
| Phase 0 기준선과 baseline benchmark 확정 | ✅ | Track C — `benchmarks/baseline/codec-24cbafbb.json` (282 case) |
| `CatalogSnapshot` contract 초안 및 ADR 검토 | ✅ | T0 + ADR-010 |
| SemanticAddress compatibility matrix 작성 | 🟡 | core ↔ DecodeMap ↔ browser-codec parity는 있음. **WASM은 미포함**, matrix 문서 없음 |
| legacy-v1 golden corpus 생성 | ✅ | Track A — 619 case |
| codec mismatch/error contract 구현 | 🟡 | 계약 타입·판정 함수(T0)는 있음. **`core/catalog/runtime.ts`는 여전히 일반 `Error` 32곳**, browser-codec은 `null` 반환 |
| browser/Node codec differential test 추가 | ✅ | 3-way parity 83 layout |
| hot/cold EventRecord prototype 및 allocation profile | ⬜ | G2 |
| batch ingest와 backpressure prototype | ⬜ | G2 |
| raw/derived storage migration 설계 | 🟡 | PG 마이그레이션 drift 수정(X-18)까지. 분리 설계는 G2 |
| incremental convergence IR과 cache key 설계 | ⬜ | G3 (F의 Clock·provenance가 전제 준비) |
| codegen이 validator·fixture·benchmark를 생성하도록 확장 | 🟡 | D는 결정론·digest·drift CI까지. 생성 범위 확장은 미착수 |
| analyzer/plugin contract와 approval boundary 작성 | ⬜ | G5 |
| CI benchmark/codegen/compatibility job 추가 | 🟡 | `bench.yml`, `codegen-drift.yml`은 있음. **compatibility job 없음 — 아래 P0** |
| canary dashboard와 rollback runbook 작성 | ⬜ | G6 |
| 문서 전체 read-back 및 링크 검증 | ✅ | `def validate` 경고 0, `scan-audit` 이슈 0 |
| full rebuild와 incremental rebuild 결과 비교 | ⬜ | G3 |
| rollout 승인 및 legacy path 유지 기간 결정 | ⬜ | G6 |

## 2. 관련 GitHub 이슈

- **#15 QA trace/verdict evidence pinning** — 외부가 QA 근거를 정확한 판본으로 재현 조회하려면 catalog pin, source build revision, report artifact digest가 필요하다. 이번 작업이 준비한 재료: CatalogSnapshot digest·`resolveDecodeLayout`(T0), observation provenance(F), codegen `catalogDigest`·`sourceDigest`(D). 빠진 재료: envelope의 `catalog_snapshot`과 registry의 불변 snapshot 저장(**Track B**), VerdictReport의 immutable artifact ID·digest(#15 고유 범위). #15의 `QA-T02`(digest 불일치 시 `stale`)는 B의 snapshot gate 판정을 재사용할 수 있다.
- **#16 문서** — #15의 pin 규칙을 설명하는 문서 이슈. 이 디렉토리의 ADR-010(버전 축 분리, 실패 9종)이 "exact pin과 stale/unknown 상태" 서술의 근거로 쓰일 수 있다.

## 3. 남은 작업 (우선순위)

| 순위 | 작업 | 이유 | 선행 조건 |
|---|---|---|---|
| **P0** | 테스트 CI job 추가 — 최소 `@qa-sdk/core`, `@qa-sdk/demo-tests`(codec-compat), `@qa-sdk/ingest-server`, `@qa-sdk/registry-service`, `@qa-sdk/decode-service` | 지금 CI는 def·visbug·bench·codegen만 돌린다. R-1을 막는 parity·corpus·PG parity 테스트가 CI에서 실행되지 않아 회귀를 막지 못한다 | 없음 |
| **P0** | 49 커밋 push 여부 결정 | 원격에 반영되지 않았고, `8a624692`에 다른 주제의 삭제분이 섞여 있다 | 사람 결정 |
| **P1** | Track B (envelope snapshot binding, registry 불변 snapshot, readiness) | registry `catalogHash`가 여전히 다른 알고리즘이라 SDK GENERATION 비교가 항상 어긋난다. #15의 catalog pin 재료 | **D-2 결정** |
| **P1** | core runtime 오류를 `CodecContractError`로 전환, browser-codec `null` 반환의 원인 코드 노출 | 원본 계획 "codec mismatch/error contract"의 미완 부분 | 없음 (Track A 소유 파일) |
| **P2** | 2순위 정리: 의존 0 라이브러리 8개, consumer 그룹(시각화 7·시뮬 6·데모 8), `stores/pg/*`(Plan 07d), 구조 중복 | 관리 비용 축소 | 그룹별 사람 결정 |
| **P2** | demo-tests 기존 타입 오류 21건 정리 후 전체 `tsc` 검사 | 지금은 `codec-compat`만 타입 검사 | 없음 |
| **P3** | Wave 2 (G2·G3·G5·G6) | 측정 게이트 이후 | C baseline 분산 기록, B, E·F 완료 |
| — | Notion 이슈 공식 번호 발급, Drive 계획 rev 0.2(R-1~R-11 반영) | 원본 이슈·계획과 저장소 상태 동기화 | Notion 연결 인증 |

## 4. 열린 결정

| ID | 내용 | 상태 |
|---|---|---|
| D-2 | `entry_snapshot` 처리 (B 착수 조건) | 대기 |
| D-9 | convergence scheduler 제거, worker 모드 convergence 부재 | G3에서 결정 |
| X-16 후속 | 없음 (삭제 완료) | — |
| 2순위 그룹 | 패키지 그룹별 유지·삭제 | 대기 |
