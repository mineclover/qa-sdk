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

원본 이슈(Notion `ISSUE-TEMP-SWC-NEXT-QA-SDK-OPTIMIZATION`)의 체크리스트와 관련 GitHub 이슈(#15, #16)를 기준으로 지금까지 반영한 것과 남은 것을 한 곳에 정리한다. 로컬 `main`은 `origin/main`보다 80 커밋 이상 앞서 있고 push하지 않았다.

## 1. 원본 이슈 체크리스트 대조 ^defines

| 체크리스트 (Drive 계획 §10) | 상태 | 근거 |
|---|---|---|
| Phase 0 기준선과 baseline benchmark 확정 | ✅ | Track C — `benchmarks/baseline/codec-24cbafbb.json` (282 case) |
| `CatalogSnapshot` contract 초안 및 ADR 검토 | ✅ | T0 + ADR-010 |
| SemanticAddress compatibility matrix 작성 | 🟡 | core ↔ DecodeMap ↔ browser-codec parity는 있음. **WASM은 미포함**, matrix 문서 없음 |
| legacy-v1 golden corpus 생성 | ✅ | Track A — 619 case |
| codec mismatch/error contract 구현 | ✅ | T0 계약, B의 gate·`CorruptEnvelope`·HTTP 매핑, core runtime 주소 해석 오류 28곳 `CodecContractError` 전환(+`StrideOverflow` guard 신설), browser-codec `encodeDetailed`/`decodeDetailed`. catalog 정의 결함 4곳은 의도적으로 일반 `Error` |
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
| **P0** | ✅ 로컬 CI — `pnpm ci:local` (`scripts/ci-local.mjs`): workflow 검사(def·codegen·format·arch)와 핵심 18개 패키지 테스트·bench smoke. 결정: CI는 로컬에서 확인한다 (2026-10-29). `arch:verify`가 `.antigravitycli/` 깨진 symlink로 중단되던 문제는 git 기준 파일 목록으로 격리 — 28/28 | — |
| **P0** | 미push 커밋(80+) push 여부 결정 | 원격에 반영되지 않았고, `8a624692`에 다른 주제의 삭제분이 섞여 있다 | 사람 결정 |
| **P1** | ✅ Track B — registry generation이 digest 기준이 되어 SDK GENERATION 비교가 일치. 남은 #15 재료: batch 문맥 조회 API, VerdictReport artifact digest | — |
| **P1** | ✅ core runtime 오류 전환, browser-codec 원인 코드 노출 | — | — |
| **P1** | 🟡 기능 정리·안정화 — [06](./06-feature-cleanup-candidates.md). 완료: 결함 S-1·S-2·S-5~S-9(S-4 부분), 테스트 공백 T-1·T-2·T-4~T-6(registry e2e 45건 NestJS 이식 + SQL capacity 정밀도 결함 수정), 중복 M-1·M-4·M-5, stub N-2·N-3·N-7. 남음: S-3(gateway 인증 기본값)·S-4 엔진 데이터 공급·M-3(Plan 07d)·N-1(App Hub stub)·§3 미사용 라우트·§5 패키지 그룹·V-1 배포 규칙 | 남은 항목은 대부분 사람 결정 | — |
| **P2** | 2순위 정리: 의존 0 라이브러리 8개, consumer 그룹(시각화 7·시뮬 6·데모 8), `stores/pg/*`(Plan 07d), 구조 중복 | 관리 비용 축소 | 그룹별 사람 결정 |
| **P2** | ✅ I-1 삭제. 남은 인터페이스 정리 후보 I-2(`entrySnapshot` 옵션 제거 시점) — [05-interface-map.md](./05-interface-map.md) §4 | 실제 envelope 계약과 다른 두 번째 정의 | 사람 결정 |
| **P2** | ✅ demo-tests 전체 `tsc` 검사 (`tsconfig.typecheck.json`) — 16건 수정, 죽은 registry skip 테스트 5개만 제외(06 T-6) | — | — |
| **P3** | Wave 2 (G2·G3·G5·G6) | 측정 게이트 이후 | C baseline 분산 기록, B, E·F 완료 |
| — | Notion 이슈 공식 번호 발급, Drive 계획 rev 0.2(R-1~R-11 반영) | 원본 이슈·계획과 저장소 상태 동기화 | Notion 연결 인증 |

## 4. 열린 결정

| ID | 내용 | 상태 |
|---|---|---|
| D-2 | `entry_snapshot` 처리 | ✅ 확정 (catalog_snapshot 추가, entry_snapshot deprecated 유지) |
| D-9 | convergence scheduler 제거, worker 모드 convergence 부재 | G3에서 결정 |
| X-16 후속 | 없음 (삭제 완료) | — |
| 2순위 그룹 | 패키지 그룹별 유지·삭제 | 대기 |
