---
def:
  id: package-implementation-review
  type: knowledge
  knowledge_kind: guide
  scope: flow
  aspect: process_flow
  depth: validation
  lifecycle: approved
  tags: [entry-point, testing, migration]
  links:
    - target: system-overview
      type: refines
    - target: spec-convention
      type: constrains
---
# QA-SDK 패키지 구현 현황 리뷰

## 목적 ^purpose

패키지별 구현 목표, 코드 표면, 문서 보강 필요 지점을 한곳에 정리해 패키지 단위 리뷰와 후속 문서 작업의 기준선으로 사용한다.

- 기준일: `2026-04-07`
- 전체 패키지: `86`개 (`foundation 40 / platform 25 / app 9 / service 9 / data 3`)
- 구현 signal: `구현 57 / 부분 4 / 기반 18 / 쉘 7`
- 로컬 문서 surface: `README 77 / specs redirect 11 / 둘 다 없음 0`
- 추가 메모: `package.json description 없음 49`, `코드 패키지인데 패키지 내부 테스트가 없는 패키지 18`

이 문서의 상태 라벨은 품질 게이트 verdict가 아니라 `src/test/readme` 표면을 기준으로 한 리뷰 라벨이다. `구현 > 부분 > 기반 > 쉘` 순으로 읽는다.

이미 패키지 진입 문서가 있는 축은 기존 surface를 유지한다: `address-index`, `apm`, `bench`, `bit-index`, `browser-codec`, `browser-sdk`, `canvas-viewport`, `cli`, `cli-command`, `codec`, `codec-proto`, `codegen-core`, `config-loader`, `context`, `convergence`, `core`, `data-object-codegen`, `db-traffic-control`, `decision-flow`, `decision-service`, `definition-catalog`, `definition-client`, `definition-data-source`, `definition-service`, `demo-snapshot`, `demo-tests`, `dkg`, `engine`, `event-catalog`, `gateway`, `git-utils`, `index-meta`, `infra-engine`, `ingest-server`, `logger`, `motion-*`, `otel`, `package-classifier`, `permission-engine`, `pino`, `platform-demo`, `quality-ledger`, `query-service`, `registry-client`, `registry-service`, `registry-ui`, `review-ledger`, `rlsc`, `roleplay-web`, `sdk`, `snapshot-io`, `spec-analyzer`, `spec-core`, `spec-schema`, `spec-tracker`, `spec-transition`, `store`, `tag-search`, `test-scenario-store`, `test-types`, `viteplus-sdk-smoke`, `weighted-index`, `weighted-index-explorer`, `weighted-ui`, `viz-web`, `work-domain`.

2026-04-07 1차 반영:
- `infra-engine`, `cli`, `decision-service`, `definition-service`, `query-service`, `registry-service`, `registry-ui`, `platform-demo` README를 중앙 spec 참조형 인덱스로 추가했다.

2026-04-07 2차 반영:
- `address-index`, `canvas-viewport`, `cli-command`, `config-loader`, `package-classifier`, `snapshot-io`, `weighted-index-explorer`, `weighted-ui` README를 추가했다.
- 이 중 `canvas-viewport`, `config-loader`, `package-classifier`, `snapshot-io`, `weighted-index-explorer`, `weighted-ui`는 아직 전용 package spec이 없어, 가장 가까운 central spec을 기준으로 README를 구성했다.

2026-04-07 3차 반영:
- `apm`, `browser-codec`, `browser-sdk`, `codec`, `codec-proto`, `context`, `convergence`, `definition-client`, `logger`, `otel`, `spec-core` README를 추가했다.
- `infra-auth-integration-todo`, `store-adapter-parity` orphan 경고를 부모 문서 링크로 해소했다.

2026-04-07 4차 반영:
- `codegen-core`, `data-object-codegen`, `db-traffic-control`, `decision-flow`, `definition-catalog`, `definition-data-source`, `dkg`, `git-utils`, `permission-engine`, `quality-ledger`, `review-ledger`, `rlsc`, `spec-analyzer`, `spec-schema`, `spec-tracker`, `spec-transition`, `tag-search`, `test-scenario-store`, `test-types`, `work-domain` README를 추가했다.

2026-04-07 5차 반영:
- `decision-flow-store`, `decode-service`, `demo-types`, `docs-explorer`, `e2e`, `facet-tests`, `gate-service`, `pipe-store-sqlite`, `platform-demo-api`, `shop-web`, `simulation-tests`, `viz-3d`, `viz-core`, `weighted-gpu`, `weighted-wasm` README를 추가했다.
- 이제 모든 패키지가 `README` 또는 `specs/README` 진입 surface를 가진다.

2026-04-07 6차 반영:
- `config-loader`, `package-classifier`, `db-traffic-control`, `otel`, `definition-client`, `snapshot-io`, `canvas-viewport`, `weighted-ui`, `e2e`, `facet-tests`, `simulation-tests`, `shop-web`, `viz-3d`, `weighted-index-explorer`, `weighted-gpu`, `weighted-wasm`의 package-level central spec을 추가했다.
- 상위 모듈 문서(`system-support`, `definition-service-system`, `apm-codegen-system`, `browser-system`, `viz-system`, `wi-system`)에 `contains` 링크를 추가해 문서 그래프 편입도 마쳤다.

## 1. Foundation 보강 후보

| 패키지 | 구현 목표 | 상태 | 우선 보강 |
|---|---|---|---|
| `address-index` | `address_context` 역색인과 prefix×address 범위 조회 | 구현 | README |
| `canvas-viewport` | 캔버스 pan/zoom/minimap 공통 수학 | 기반 | README+테스트 |
| `cli-command` | zero-dependency CLI 명령 트리와 라우팅 | 기반 | README+테스트 |
| `codegen-core` | catalog/snapshot 기반 TS·Proto 코드 생성 | 구현 | README |
| `config-loader` | catalog/DKG 설정 파일 자동 탐지와 로더 체인 | 기반 | README+테스트 |
| `data-object-codegen` | DataObject typed binding 코드 생성 | 구현 | README |
| `db-traffic-control` | DB 버짓 기반 동시성·QPS 제어 | 구현 | README |
| `decision-flow` | gate/branch/path 기반 의사결정 엔진 | 구현 | README |
| `decision-flow-store` | decision-flow 인스턴스 SQLite 영속 | 기반 | README+테스트 |
| `definition-catalog` | definition taxonomy, graph lint, harness 규칙 | 구현 | README |
| `definition-data-source` | local SQLite와 remote API를 묶는 DefDataSource 팩토리 | 구현 | README |
| `dkg` | Design Knowledge Graph 모델·분석·추적 API | 구현 | README |
| `git-utils` | commit/tag/scope 추출과 모노레포 Git 유틸리티 | 구현 | README |
| `infra-engine` | deploy/discover/export/verify 운영 파이프라인 | 기반 | README+테스트 |
| `package-classifier` | workspace 패키지 tier/runtime/scope 분류 | 기반 | README+테스트 |
| `permission-engine` | 권한 encode/grant/check 엔진 | 구현 | README |
| `pipe-store-sqlite` | meta-semantic PipeStore/ManifestRegistry SQLite 영속 | 구현 | README |
| `quality-ledger` | 품질 게이트 실행 결과 원장 | 구현 | README |
| `review-ledger` | 파일/커밋 기준 리뷰 완료 이력 원장 | 구현 | README |
| `rlsc` | Relative Layout Structured Content 추출·해석 DSL | 구현 | README |
| `snapshot-io` | snapshot JSON 읽기/쓰기/검증 유틸리티 | 기반 | README+테스트 |
| `spec-analyzer` | 스펙 선언과 실제 코드의 정적 정합성 분석 | 구현 | README |
| `spec-schema` | schema 카테고리·검증·preset 시스템 | 구현 | README |
| `spec-tracker` | 런타임/테스트 증거를 스펙 claim에 연결 | 구현 | README |
| `spec-transition` | 좌표 기반 Transition Spec DSL 엔진 | 구현 | README |
| `tag-search` | 태그 기반 역색인 검색 | 구현 | README |
| `test-scenario-store` | 테스트 시나리오 저장소와 Drizzle 영속 | 구현 | README |
| `test-types` | TestPhase/Kind/Scope/Lifecycle SSOT | 기반 | README+테스트 |
| `weighted-gpu` | weighted-index 가속용 GPU 실험 surface | 구현 | README+실행예 |
| `weighted-index-explorer` | weighted-index 디버그/탐색 UI | 기반 | README+smoke |
| `weighted-ui` | weighted-index 계열 앱용 공통 UI/token | 기반 | README+테스트 |
| `weighted-wasm` | weighted-index WASM 빌드/브리지 surface | 쉘 | README+소스경계 |
| `work-domain` | 작업 유형 분류와 품질 게이트 매핑 | 구현 | README |

## 2. Platform 보강 후보

| 패키지 | 구현 목표 | 상태 | 우선 보강 |
|---|---|---|---|
| `apm` | address context와 metric record를 묶는 APM 보조층 | 구현 | README |
| `browser-codec` | 브라우저용 address_context encode/decode SSOT | 구현 | README |
| `browser-sdk` | 브라우저 auto-capture, session, flush SDK | 구현 | README |
| `cli` | `qa-sdk` 운영 명령 진입점과 workflow orchestration | 구현 | README |
| `codec` | SDK payload/dim wire codec 보조 유틸리티 | 기반 | README+설명 |
| `codec-proto` | protobuf 전송 codec과 transport bridge | 기반 | README+테스트 |
| `context` | QA context 생성과 catalog provider 조립 | 기반 | README+설명 |
| `convergence` | usage snapshot 기반 구조 수렴 분석 엔진 | 구현 | README |
| `definition-client` | definition-service HTTP client | 구현 | README |
| `docs-explorer` | definition-catalog 기반 문서 탐색 웹 UI | 쉘 | README+실행경로 |
| `e2e` | Playwright 기반 cross-app E2E 실행 패키지 | 쉘 | README+시나리오 인덱스 |
| `facet-tests` | 패싯 분리 회귀 테스트 묶음 | 쉘 | README+패싯 목록 |
| `logger` | 서비스/라이브러리 공통 로거 surface | 구현 | README |
| `otel` | OpenTelemetry bridge와 변환 유틸리티 | 구현 | README |
| `spec-core` | spec propagation, DKG bridge, convergence 핵심 레이어 | 구현 | README |
| `simulation-tests` | 시뮬레이션 기반 검증 시나리오 묶음 | 쉘 | README+대상 패키지 |

## 3. Service·App 보강 후보

| 패키지 | 구현 목표 | 상태 | 우선 보강 |
|---|---|---|---|
| `decision-service` | decision-flow 인스턴스/이력 API 서비스 | 기반 | README+smoke |
| `decode-service` | DecodeMap 기반 독립 decode API | 부분 | README+테스트 |
| `definition-service` | 문서 sync/search/graph/intent API 서비스 | 부분 | README+테스트 |
| `demo-types` | demo catalog 파생 타입·SDK 팩토리 | 구현 | README |
| `gate-service` | 주소 상태 게이트·cascade recompute 서비스 | 구현 | README |
| `platform-demo` | monitor/diagram/debugger를 묶는 데모 앱 | 기반 | README+테스트 |
| `platform-demo-api` | platform-demo 보조 API/edge surface | 기반 | README+smoke |
| `query-service` | 정책 해소·gate 통합 질의 서비스 | 부분 | README+테스트 |
| `registry-service` | catalog/prefix/service/event/workspace registry API | 구현 | README |
| `registry-ui` | registry 관리용 웹 UI | 기반 | README+smoke |
| `shop-web` | 커머스 시나리오 데모 앱 | 쉘 | README+앱경로 |
| `viz-3d` | 3D 모니터링과 좌표 시각화 앱 | 구현 | README |
| `viz-core` | 시각화 primitive, token, renderer 코어 | 구현 | README |

## 4. 이번 리뷰의 결론

- 패키지 구현 자체는 넓게 진행돼 있지만, 패키지 단위 목표를 빠르게 읽는 문서 surface는 약하다.
- 특히 `service/app` 계열의 `README` 공백이 커서 구현 목표와 실행 진입점이 코드 안에만 숨어 있다.
- 1차로 service/app 핵심 surface README는 반영했다.
- 다음 보강 우선순위는 package-level spec 신규 생성보다, 기존 spec 공백이 남은 consumer/demo 패키지(`docs-explorer`, `platform-demo-api`, `viz-core`)의 세부 멤버 문서 분해와, README 내부의 오래된 깨진 링크(index-meta, motion-content 계열)를 정리하는 것이다.
