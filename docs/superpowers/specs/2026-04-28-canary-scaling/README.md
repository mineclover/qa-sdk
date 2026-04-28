# Enterprise-PM Canary & Scaling — Spec Set

> enterprise-pm 시뮬에 카나리 배포 + 수평 스케일링 운영 컨트롤 플레인을 도입하는 설계 문서 군. 시뮬 자체가 qa-sdk decision-flow + version axis + audit-recorder + permission-engine Pass 1/2 패턴의 운영 응용 사례가 되도록 구성한다.

## 1. 문서 인덱스

| # | 파일 | 핵심 내용 |
|---|---|---|
| 00 | [overview.md](./00-overview.md) | 목적·범위·아키텍처 토폴로지·신규/변경/유지 컴포넌트 |
| 01 | [decision-model.md](./01-decision-model.md) | 2-pass 결정 알고리즘, 8 카테고리 verdict, 30s 사이클, 분류·측정 체계 근거 |
| 02 | [canary-topology.md](./02-canary-topology.md) | v1/v2 동시 배포, qa-sdk catalog version axis 통합, gateway 단일 라우팅 책임 |
| 03 | [identifier-grammar.md](./03-identifier-grammar.md) | 식별자 합성 문법 15종, 린팅 체계, 라운드트립 보장 |
| 04 | [scaling-infra.md](./04-scaling-infra.md) | replica, read replica, outbox 락, bitmap TTL/version, host.docker.internal 제거 |
| 05 | [error-and-scenarios.md](./05-error-and-scenarios.md) | fail policy 매트릭스, 17 시나리오 검증 매트릭스, break-glass CLI |
| 06 | [roadmap.md](./06-roadmap.md) | 13단계 마이그레이션 시퀀스 + 의존성 그래프 + 후속 sub-project 분리 |

## 2. 읽는 순서

처음 진입자는 다음 순서를 권장한다.

1. **00-overview** — 큰 그림 (10분)
2. **01-decision-model** — 컨트롤러가 무엇을 어떻게 결정하는가 (15분)
3. **02-canary-topology** — 카나리 대상 서비스가 어떻게 v1/v2로 갈라지는가 (10분)
4. **03-identifier-grammar** — 모든 합성 문자열의 SSOT (15분, 본 사이클의 가장 중요한 토대)
5. **04-scaling-infra** — 스케일링·인프라 보강 상세 (15분)
6. **05-error-and-scenarios** — 어떻게 실패를 잡고 어떻게 검증하는가 (10분)
7. **06-roadmap** — 어떤 순서로 구현하는가 (10분)

## 3. 핵심 결정 요약

본 spec 군에서 합의된 핵심 결정을 한 표에 모은다.

| 결정 영역 | 합의 사항 | 출처 |
|---|---|---|
| 카나리 대상 | `approval-api` 단일 서비스 | 00 §2.1 |
| 컨트롤 플레인 | 신규 `sim-canary-controller` 서비스 (:5300) | 00 §3, 01 전체 |
| 트래픽 분할 | sticky-by-user(`hash(user_id) % 100`) + `x-canary-override` escape hatch | 02 §3 |
| 결정 신호 | 8개 카테고리 verdict (PASS/WARN/FAIL), 가중 합산 금지 | 01 §2 |
| 결정 모델 | 2-pass (안전성 → 자원), permission-engine Pass 1/2 동형 | 01 §3, §4 |
| 사이클 주기 | 30s (env override 가능) | 01 §5 |
| 버전 식별 | qa-sdk catalog version axis (service prefix `sim.svc.approval`) | 02 §2 |
| 식별자 합성 | typed builder만 허용, raw 보간 금지, 라운드트립 property test 강제 | 03 전체 |
| Read replica | 별도 PG 컨테이너 + DataSource 분리 (BFF/reporting → read) | 04 §4 |
| Outbox 안전성 | `FOR UPDATE SKIP LOCKED` + idempotency_key + outbox_consumer_log | 04 §2 |
| Bitmap 캐시 | TTL 120s + version-check 3단계 (pub/sub은 최적화 격하) | 04 §3 |
| Fail 정책 | 결정 지점마다 fail-open/fail-closed 명시, hard rollback 2종 | 05 §1 |
| 시나리오 | 기존 8 + 신규 9 = 17, 각 단언이 결정 객체 verdict 자체에 대해 작성 | 05 §3 |
| 마이그레이션 | 13단계, 각 단계 단독 PR 가능 | 06 §1 |

## 4. 본 사이클이 명시적으로 제외하는 항목

다음은 후속 sub-project로 분리한다 — 본 사이클 spec 군에서 다루지 않는다.

| 항목 | 이유 | 처리 위치 |
|---|---|---|
| 카오스 시나리오 일반화 | fault-injector 1차 토대만 본 사이클에 | 06 §4 |
| HTTP retry 표준화 (sim-otel-utils) | controller 내부 retry만 본 사이클에 | 06 §4 |
| k6 부하 + SLO 매트릭스 | 시나리오 12에 burst generator 1개만 | 06 §4 |
| BFF lint rule 일반화 | read DataSource lint 1개만 본 사이클에 | 06 §4 |
| 다른 서비스 카나리 확장 | approval-api 단일 집중 | — |
| database-per-service 분리 | 시뮬 단순성 우선 | — |
| 캐시 health 카테고리 결정 모델 승격 | 메트릭 노출만 본 사이클에 | 04 §3.5 |
| dbPool skew 기반 LB 진단 | 평균 dbPool만 본 사이클 결정 입력 | 04 §5 |

## 5. 검증 자산 매핑

본 spec 군이 정의한 검증 자산을 종류별로 분류.

| 종류 | 자산 |
|---|---|
| 시나리오 (17개) | 05 §3 |
| 인프라 검증 (6종) | 05 §4 |
| 결정 객체 단위 단언 | 01 §1 + 05 §3 |
| identifier 라운드트립 property test | 03 §5 |
| Fail policy 매트릭스 | 05 §1 |
| 단계별 CI 게이트 | 06 §3 |
| Definition of Done (7항목) | 06 §5 |

## 6. 변경 이력

| 날짜 | 내용 |
|---|---|
| 2026-04-28 | 초기 작성 (7개 문서) |
