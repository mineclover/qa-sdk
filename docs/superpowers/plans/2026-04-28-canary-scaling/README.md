# Enterprise-PM Canary & Scaling — Implementation Plan Set

> spec set `docs/superpowers/specs/2026-04-28-canary-scaling/`을 구현하기 위한 plan. 분할 review 편의를 위해 **plan별 overview + 단계별 stage 파일**로 구성된다.

## Plan 인덱스

각 Plan은 단독 머지 가능한 단계 1~3개로 구성. 의존성/Goal/DoD/다음 plan 관계는 overview에, 실제 task는 stage 파일에.

| Plan | overview | 단계 | 분량 |
|---|---|---|---|
| **A. Foundation** | [A-overview.md](./A-overview.md) | 1·2·4 | 126 |
| **B. Core mechanics** | [B-overview.md](./B-overview.md) | 3·5·6 | 75 |
| **C. Canary delivery** | [C-overview.md](./C-overview.md) | 7·8 | 75 |
| **D. Controller** | [D-overview.md](./D-overview.md) | 9·10 | 82 |
| **E. Scenarios + closing** | [E-overview.md](./E-overview.md) | 11·12·13 | 79 |

## 단계 인덱스 (review 단위)

| 단계 | 파일 | 줄수 | 핵심 |
|---|---|---|---|
| **1** | [A-stage-1-host-and-ingest.md](./A-stage-1-host-and-ingest.md) | 273 | host.docker.internal 제거 + ingest 컨테이너화 |
| **2a-i** | [A-stage-2a-i-skeleton-and-grammar-1-5.md](./A-stage-2a-i-skeleton-and-grammar-1-5.md) | 1040 | 패키지 skeleton + 식별자 #1 service-prefix · #2 version-tag · #3 image-tag · #4 http-header · #5 event-name |
| **2a-ii** | [A-stage-2a-ii-grammar-6-10.md](./A-stage-2a-ii-grammar-6-10.md) | 731 | 식별자 #6 schemaHash · #7 decision-id · #8 cycle-id · #9 label-key · #10 pubsub-channel |
| **2a-iii** | [A-stage-2a-iii-grammar-11-15.md](./A-stage-2a-iii-grammar-11-15.md) | 823 | 식별자 #11 cache-key · #12 idempotency-key · #13 replication-slot · #14 decision-category · #15 decision-signal |
| **2b** | [A-stage-2b-grammar-tooling.md](./A-stage-2b-grammar-tooling.md) | 276 | catalog vocab + roundtrip 통합 + lint 스크립트 + identifier-gate CI |
| **4** | [A-stage-4-read-replica.md](./A-stage-4-read-replica.md) | 458 | qa-sdk-db 복제 + qa-sdk-db-replica 컨테이너 + db-bootstrap createDualConnection |
| **3** | [B-stage-3-sim-service-catalog.md](./B-stage-3-sim-service-catalog.md) | 976 | sim-service-catalog 패키지 (getServiceVersionTag/transitionState/getCurrentTopology) + 빌드 통합 + 4-way 정합성 |
| **5** | [B-stage-5-outbox-lock.md](./B-stage-5-outbox-lock.md) | 718 | `FOR UPDATE SKIP LOCKED` + idempotency_key + outbox_consumer_log + DLQ 격리 |
| **6** | [B-stage-6-bitmap-cache.md](./B-stage-6-bitmap-cache.md) | 612 | BitmapCacheEntry 확장 + getBitmap 3단계 (TTL → version-check → refresh) + pub/sub 격하 |
| **7** | [C-stage-7-gateway.md](./C-stage-7-gateway.md) | 897 | RoutingTable + sticky-by-user + escape hatch + version stamp + `/admin/routing` API |
| **8** | [C-stage-8-approval-api-v1v2.md](./C-stage-8-approval-api-v1v2.md) | 949 | approval-api v1/v2 빌드 분리 + schemaHash + READ_DATA_SOURCE 마이그레이션 + ESLint custom rule |
| **9** | [D-stage-9-controller.md](./D-stage-9-controller.md) | 950 | sim-canary-controller — advisory lock + metrics scrape + 8 카테고리 verdict + Pass1/Pass2 + 30s 사이클 |
| **10** | [D-stage-10-fault-injector.md](./D-stage-10-fault-injector.md) | 698 | schema break / audit anomaly / lag inject / dbPool 압박 4종 + toggle HTTP API |
| **11** | [E-stage-11-scenarios.md](./E-stage-11-scenarios.md) | 877 | 시나리오 9~17 + assertion 헬퍼 (결정 객체 verdict 단언) |
| **12** | [E-stage-12-break-glass.md](./E-stage-12-break-glass.md) | 658 | sim:canary {abort,force-promote,controller-stop} + sim:scale {set,pin} + audit 기록 |
| **13** | [E-stage-13-gates-closing.md](./E-stage-13-gates-closing.md) | 584 | 인프라 검증 6종 게이트 + ESLint read DataSource 호출 차단 + sim:smoke:full + 사이클 마감 보고서 |

**총 plan 분량**: 약 12,000줄 (overview 437 + stage 11608 + README 90).

## 의존성 그래프

```
A (Foundation)
├── B (Core mechanics) ── 필요: A의 grammar #1 #2 #11 #12, db-bootstrap dual
├── C (Canary delivery) ── 필요: A grammar #2 #3 #4 #6, db-bootstrap dual; B의 sim-service-catalog
└── D (Controller) ──── 필요: A grammar #7 #8 #13 #14 #15; B의 transitionState/getCurrentTopology; C의 gateway /admin/routing
        └── E (Scenarios + closing) ── 필요: A·B·C·D 결과 모두

병렬 가능:
- A 단계 1 → 단계 2와 단계 4 동시
- A 완료 → B와 C 동시 시작 가능 (C 단계 7은 B와 독립)
- B·C 완료 → D 시작
- D 완료 → E 시작
```

## 단독 PR 단위

각 단계 = 1 PR. 13단계 = 13 PR.

## Spec 매핑

| Plan | spec 출처 |
|---|---|
| A | spec `03-identifier-grammar.md` 전체 + `04-scaling-infra.md` §4·§6 |
| B | spec `02-canary-topology.md` §2·§5 + `04-scaling-infra.md` §2·§3 |
| C | spec `02-canary-topology.md` §1·§3·§4 + `04-scaling-infra.md` §4.2·§4.3 |
| D | spec `01-decision-model.md` 전체 + `04-scaling-infra.md` §4.4 + `05-error-and-scenarios.md` §3 |
| E | spec `05-error-and-scenarios.md` §2·§3·§4 + `01-decision-model.md` §1 + `06-roadmap.md` §4·§5 |

## Definition of Done (1차 사이클 마감)

`E-stage-13-gates-closing.md` Task 13.5의 마감 보고서가 다음 8개 체크리스트를 모두 충족할 때 1차 사이클 종료:

1. 13 단계 모두 main 머지
2. 17 시나리오 PASS
3. 인프라 검증 6종 PASS
4. break-glass CLI 4종 단위 테스트 PASS
5. controller 30s 사이클 24시간 무중단
6. spec ↔ 코드 drift 0
7. README + spec `00-overview.md` 변경 영향 명시
8. 후속 sub-project 5종 (chaos / HTTP retry / k6 SLO / BFF lint 일반화 / README 보강) 별도 spec/plan으로 식별

## 변경 이력

| 날짜 | 내용 |
|---|---|
| 2026-04-28 | 초기 작성 — 5 plan overview + 16 stage 파일 = 21 review 단위 + README |
| 2026-04-28 | A-stage-2a 식별자 15종 파일을 그룹별 3 파일로 추가 분할 (1040/731/823 줄) |
