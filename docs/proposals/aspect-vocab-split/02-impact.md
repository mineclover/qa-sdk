---
def:
  id: aspect-vocab-split-02-impact
  type: knowledge
  knowledge_kind: proposal
  lifecycle: review
  owner_system: definition-catalog
  projection_plane: intent
  scope: meta
  aspect: proposal_design
  tier: system
  depth: validation
  links:
    - target: aspect-vocab-split-readme
      type: depends_on
status: under-review
date: 2026-04-21
part_of: aspect-vocab-split
role: impact
---

# Aspect Vocabulary Split — 문서별 영향 분석

## 목적 ^purpose

[00-design.md](./00-design.md) 에서 정의한 17 개 신규 aspect 값으로 17 dup-coord 그룹의 **멤버 문서** 를 개별 매핑한다. 각 행은 (doc_id, 현재 aspect, 제안 aspect, confidence, 근거) 를 포함한다. Phase B-1~B-3 의 실행 단위.

Confidence 정의:
- **high**: 문서 id + purpose 가 신규 aspect 의 의미에 명확히 일치
- **med**: 다른 후보값도 수용 가능. 리뷰 시 결정
- **low**: 의미가 모호하거나 두 aspect 이상 동시 적합. 사람 결정 필수

## 집계

| aspect | 전체 dup-coord 멤버 수 | HIGH | MED | LOW |
|---|---:|---:|---:|---:|
| `func_def` | 26 | 21 | 3 | 2 |
| `process_flow` | 13 | 11 | 2 | 0 |
| `api_contract` | 12 | 10 | 2 | 0 |
| `domain_data` | 8 | 5 | 3 | 0 |
| 합계 | **59** | **47** | **10** | **2** |

(LOW 비율 2/59 ≈ 3.4% — 00-design §R6 임계치 20% 이하)

## 매핑 표

### A. `func_def` 그룹 (7 dup-coord 그룹, 26 멤버)

#### A.1 `system:feature:operation:func_def` @ definition-catalog-spec — 8 멤버

| doc_id | 현재 aspect | 제안 aspect | confidence | 근거 |
|---|---|---|---|---|
| bdd-contract-system | func_def | harness_func | high | BDD 계약 test unit / implementation unit 추적 — 테스트 하네스 영역 |
| decision-service-system | func_def | func_def | **low** | FlowSchema/FlowInstance DB + flow_links 추적 서비스 — 어느 신규 값에도 완벽히 맞지 않음. fallback 유지 또는 사람 결정 |
| definition-harness | func_def | harness_func | high | "11개 머신의 정의 + 의존 관계 + SDK 이벤트 수집" — harness 의 정의 |
| definition-quality-gates | func_def | gate_func | high | 품질 게이트 6 단계 프로세스 — gate 계열 |
| definition-service-system | func_def | func_def | **low** | NestJS 문서 메타데이터 서비스 전체. "서비스 자체" vs "주 기능" 모호. 사람 결정 |
| spec-analyzer-system | func_def | analyzer_func | high | AST 없는 정적 분석 / pattern matching 도구 — analyzer 영역 |
| spec-tracker-system | func_def | analyzer_func | high | 테스트·런타임 증거 수집 tracker — analyzer 계열 |
| spec-verification-system | func_def | analyzer_func | high | 문서↔코드 정합성 추적 (tracker + analyzer 결합) — analyzer 영역 |

예상 dup-coord 감소: 8 → 2 (decision-service-system / definition-service-system 잔존 fallback). 잔존 2 건 중 하나가 definition-catalog-spec 이 아니라 독립 domain_root 로 파생되면 dup-coord 키 기준 0 가능. B-1 적용 후 재측정.

#### A.2 `system:feature:domain:func_def` @ system-libraries — 3 멤버

| doc_id | 현재 aspect | 제안 aspect | confidence | 근거 |
|---|---|---|---|---|
| content-service-spec | func_def | domain_service_func | high | 콘텐츠 플랫폼 관리 서비스 (content/relational prefix) |
| payment-service-spec | func_def | domain_service_func | high | 결제 처리 서비스 (주문-결제 흐름) |
| shopping-backend-spec | func_def | domain_service_func | high | 주문/결제/권한 비즈니스 백엔드 |

예상 dup-coord 감소: 3 → 0 (세 멤버 모두 이동, 그룹 소멸).

#### A.3 `system:feature:domain:func_def` @ partial-binder-spec — 4 멤버

| doc_id | 현재 aspect | 제안 aspect | confidence | 근거 |
|---|---|---|---|---|
| cq-system | func_def | encoding_func | high | 닫힌 좌표 공간 pattern / policy 연산 — 인코딩 도메인 |
| partial-binder-spec | func_def | encoding_func | high | PartialBinder (curried encoder) — 인코딩 도메인 |
| wi-pack-format-system | func_def | encoding_func | high | WeightedIndex 포맷 직렬화 — 인코딩 도메인 |
| wi-system | func_def | encoding_func | high | weighted positional notation ↔ 정수 인코딩 — 인코딩 도메인 |

예상 dup-coord 감소: 4 → 4(같은 `encoding_func` 로 재수렴). **경고**: 이 그룹은 aspect 분할만으로는 해소 불가 — Phase 5c §"3+ 멤버" 의 sibling 계층화(예: cq-system/wi-pack-format-system 을 wi-system 의 `contains` 자식) 가 병행 필요. 본 RFC 범위에서는 aspect 를 `encoding_func` 로 통일하여 "의미 명확화" 효과만 얻는다. 그룹 자체 해소는 후속 Phase 5c 재방문에서 처리.

#### A.4 `system:feature:mediation:func_def` @ registry-system — 3 멤버

| doc_id | 현재 aspect | 제안 aspect | confidence | 근거 |
|---|---|---|---|---|
| decode-bigint | func_def | encoding_func | high | BigInt decode (MetaCodecBig 사용) — 인코딩 |
| decode-service-system | func_def | encoding_func | high | DecodeMap 번들 decode 서비스 — 인코딩 |
| registry-service-modules | func_def | func_def | **med** | NestJS 런타임 모듈 조립 문서 — "일반 서비스 구성" 에 가까움. fallback 유지 가능 |

예상 dup-coord 감소: 3 → 1 (registry-service-modules 단독 잔존, 같은 domain_root 없으면 해소).

#### A.5 `system:feature:domain:func_def` @ decision-standard-group — 3 멤버

| doc_id | 현재 aspect | 제안 aspect | confidence | 근거 |
|---|---|---|---|---|
| df-analysis-group | func_def | analyzer_func | high | 의사결정 벡터 비교 / 시간 분석 / 인과 매핑 — analyzer 영역 |
| df-narrative-group | func_def | func_def | **med** | 서사 문서 누적 구조 — 분석도 아니고 인코딩도 아님. fallback 유지 가능 |
| df-system | func_def | func_def | **med** | 다차원 벡터 공간 모델 "시스템 전체". 상위 레벨이라 하위 값 모두 포괄. fallback 적합 |

예상 dup-coord 감소: 3 → 2 (df-narrative-group + df-system 잔존). Phase 5c sibling 계층화(df-narrative-group 을 df-system 의 자식) 병행 시 해소.

#### A.6 `system:feature:domain:func_def` @ scope-nesting-system — 3 멤버

| doc_id | 현재 aspect | 제안 aspect | confidence | 근거 |
|---|---|---|---|---|
| scope-nesting-pattern-lifecycle | func_def | nesting_func | high | scope 비활성화 사전 분석 파이프라인 — nesting 영역 |
| scope-nesting-provider-patterns | func_def | nesting_func | high | provides/consumes 4 provider 패턴 — nesting 영역 |
| scope-nesting-system | func_def | nesting_func | high | contract descent 기반 스코프 중첩 프레임워크 — nesting 영역 |

예상 dup-coord 감소: 3 → 3 (동일 `nesting_func` 로 재수렴). **경고**: A.3 와 동일한 구조적 한계. 해소는 Phase 5c 재방문 (provider-patterns 가 이미 `depends_on: pattern-lifecycle` 보유 — primary-parent 규칙 재평가) 필요.

#### A.7 `none:feature:operation:func_def` @ store-adapter-parity — 2 멤버

| doc_id | 현재 aspect | 제안 aspect | confidence | 근거 |
|---|---|---|---|---|
| clickhouse-analytics-todo | func_def | func_def | high | TODO 문서 + 구현 미완. 현재 `tier` 미지정(draft) → 영향 제한적. cross-scope 태그 권장(Phase 5a 조치와 동일). |
| redis-cache-pipeline-todo | func_def | func_def | high | 동일 — TODO 문서, cross-scope 태그로 해소 |

예상 dup-coord: 변화 없음 (기 확인된 Phase 5a Class M 케이스로 별도 tag 처리 대상).

### B. `process_flow` 그룹 (4 dup-coord 그룹, 13 멤버)

#### B.1 `system:flow:operation:process_flow` @ storage-system — 4 멤버

| doc_id | 현재 aspect | 제안 aspect | confidence | 근거 |
|---|---|---|---|---|
| browser-lifecycle-system | process_flow | lifecycle_flow | high | QaMonitor 상태 전이 / 세션 사용 패턴 — lifecycle |
| ingest-quality-bundle | process_flow | ingest_flow | high | ingest-server 공개 계약 + 품질 게이트 번들 — ingest |
| ingest-system | process_flow | ingest_flow | high | SDK 이벤트 수신/저장/재구성/판정 파이프라인 — ingest |
| pipeline-system | process_flow | pipeline_flow | high | 수집→재구성 2 단계 파이프라인 — pipeline |

예상 dup-coord 감소: 4 → 0 (모두 다른 신규 값으로 이동).

#### B.2 `system:flow:operation:process_flow` @ definition-catalog-spec — 4 멤버

| doc_id | 현재 aspect | 제안 aspect | confidence | 근거 |
|---|---|---|---|---|
| definition-management | process_flow | definition_mgmt_flow | high | 문서/코드/테스트/관측 관통 관리 — definition 관리 흐름 |
| definition-mgmt-observability-model | process_flow | definition_mgmt_flow | high | definition 관리 observability plane — definition 관리 흐름 |
| definition-service-quality-bundle | process_flow | definition_mgmt_flow | high | definition-service 공개 계약 + 검증 게이트 번들 — definition 관리 |
| harness-architecture | process_flow | definition_mgmt_flow | high | 하네스 좌표 기반 상태 추적 — definition 관리 (harness 는 definition-catalog 의 상태 추적자) |

예상 dup-coord 감소: 4 → 4 (동일 `definition_mgmt_flow` 로 재수렴). 본 그룹은 Phase 5c §"3+ 멤버" 에서도 지적되었으며 sibling 분리(harness-architecture 를 definition-management 자식) 가 병행 필요. 본 RFC 범위에서는 의미 명확화만 수행.

#### B.3 `system:flow:operation:process_flow` @ gate-system — 3 멤버

| doc_id | 현재 aspect | 제안 aspect | confidence | 근거 |
|---|---|---|---|---|
| gate-cache-invalidation | process_flow | gate_flow | high | gate 상태 변경 캐시 무효화 — gate 흐름 |
| gate-consistency | process_flow | gate_flow | high | gate 일관성 모델 (shouldVerify 재확인 흐름) — gate 흐름 |
| query-quality-bundle | process_flow | process_flow | **med** | query-service 품질 번들. 이름은 "bundle" 이지만 실제로 process_flow/B-3 의 일반성에 더 가까움. fallback 유지 또는 별도 `query_flow` 제안 가능 |

예상 dup-coord 감소: 3 → 2 (동일 `gate_flow` 재수렴 + query-quality-bundle fallback). B-3 에서 query-quality-bundle 의 이동 여부 결정 필요.

#### B.4 `layout:flow:operation:process_flow` @ system-libraries — 2 멤버

| doc_id | 현재 aspect | 제안 aspect | confidence | 근거 |
|---|---|---|---|---|
| system-infra | process_flow | process_flow | **med** | "런타임 인프라 도메인" 그룹 루트. aspect 변경보다는 layer 명확화가 맞음. fallback 유지 권장 |
| system-libraries | process_flow | relation | **med** | "라이브러리 간 의존 관계" 를 다룸. 이미 flow scope 의 `relation` aspect 가 존재하므로 그쪽으로 이동 가능 (00-design §B Option-B) |

예상 dup-coord 감소: 2 → 1 (system-libraries 이동 시). B-3 에서 리뷰어가 system-libraries 를 `relation` 으로 옮길지 결정.

### C. `api_contract` 그룹 (3 dup-coord 그룹, 12 멤버)

#### C.1 `system:interface:operation:api_contract` @ storage-system — 4 멤버

| doc_id | 현재 aspect | 제안 aspect | confidence | 근거 |
|---|---|---|---|---|
| browser-runtime-system | api_contract | browser_contract | high | 브라우저 자동 수집/초기화 런타임 계약 |
| browser-system | api_contract | browser_contract | high | 브라우저 SDK 클라이언트 시스템 계약 |
| pipeline-aggregator | api_contract | pipeline_contract | high | packed_key 그룹핑/축 프로젝션 집계 계약 |
| pipeline-cache | api_contract | pipeline_contract | high | packed_key 디코딩 캐시 계약 |

예상 dup-coord 감소: 4 → 2+2 (browser_contract 2, pipeline_contract 2). **경고**: 같은 새 값에 2 건씩 재수렴. dup-coord 기준은 3+ 멤버에서만 발동하므로 (경고가 발동하지 않도록) 2 씩 남으면 dup-coord 0. 그러나 `browser_contract` 와 `pipeline_contract` 좌표가 동일 domain_root(storage-system) 를 공유하면 여전히 경고. Phase 5c 와 병행하여 browser-runtime 을 browser-system 의 자식으로 contains 명시 시 해소.

#### C.2 `system:interface:mediation:api_contract` @ registry-system — 4 멤버

| doc_id | 현재 aspect | 제안 aspect | confidence | 근거 |
|---|---|---|---|---|
| decode-api | api_contract | decode_contract | high | decode REST 엔드포인트 3개 (decode/batch/deep) |
| decode-service-spec | api_contract | decode_contract | high | URN 디코딩 서비스 스펙 |
| decode-system | api_contract | decode_contract | high | DecodeMap 번들 decode 경량 서비스 |
| registry-system | api_contract | api_contract | high | Prefix DAG 중앙 레지스트리 — fallback 유지 적합 |

예상 dup-coord 감소: 4 → 3+1 (decode_contract 3 재수렴 + registry-system fallback). decode_contract 3 건은 그 자체로 다시 dup-coord 경고 발동 가능. 해소를 위해 decode-system 을 독립 domain_root 로 승격하는 Phase 5b-1(root 분리) 병행 필요.

#### C.3 `system:interface:mediation:api_contract` @ gate-system — 4 멤버

| doc_id | 현재 aspect | 제안 aspect | confidence | 근거 |
|---|---|---|---|---|
| gate-api | api_contract | gate_contract | high | gate RPC 엔드포인트 계약 |
| gate-event-bus | api_contract | gate_contract | high | gate fan-out 이벤트 버스 계약 |
| query-api-spec | api_contract | query_contract | high | query cursor pagination 읽기 API |
| query-system | api_contract | query_contract | high | 관계형 질의 / 정책 해소 / gate 통합 중앙 서비스 |

예상 dup-coord 감소: 4 → 2+2. 각 새 값에 2 건씩 (3+ 임계치 미만) → dup-coord 경고 발동 안 함. ★ **완전 해소 달성** (단, 같은 domain_root 안에서 계속 병존하는 warning 의 잔존 여부는 실제 audit 로 확인 필요).

### D. `domain_data` 그룹 (2 dup-coord 그룹, 8 멤버)

#### D.1 `system:data:domain:domain_data` @ definition-catalog-spec — 5 멤버

| doc_id | 현재 aspect | 제안 aspect | confidence | 근거 |
|---|---|---|---|---|
| definition-catalog-spec | domain_data | domain_data | high | "정의 카탈로그 시스템 자체" 의 overview — fallback 적합 |
| definition-taxonomy | domain_data | taxonomy_data | high | 문서 분류 축 정의 (scope/aspect/depth/level/layer) — taxonomy |
| dual-coordinate-system | domain_data | coordinate_model_data | high | prefix 좌표 + scope 좌표 2 중 좌표 시스템 — coordinate |
| structural-taxonomy | domain_data | taxonomy_data | high | qa-sdk 작업 단위 구조 축 정의 — taxonomy |
| taxonomy-boundaries | domain_data | taxonomy_data | high | taxonomy 패밀리 소유 범위/경계 — taxonomy |

예상 dup-coord 감소: 5 → 3(taxonomy_data 3 재수렴 + 2 독립). **경고**: taxonomy_data 가 definition-catalog-spec domain_root 아래 3 건 재수렴. Phase 5c §"A-클래스" 의 `contains` 명시(taxonomy-boundaries 를 definition-taxonomy 자식) 병행 시 해소.

#### D.2 `system:data:domain:domain_data` @ dkg-system — 3 멤버

| doc_id | 현재 aspect | 제안 aspect | confidence | 근거 |
|---|---|---|---|---|
| dkg-skill-catalog | domain_data | domain_data | **med** | DKG skill 등록/조회 카탈로그 — "dkg 도메인 데이터" 이지만 신규 값 `dkg_data` 제외 결정(00-design §D). fallback 유지 + Phase 5c 재방문 |
| dkg-state-store | domain_data | domain_data | **med** | DKG 그래프 SQLite 영속 저장소 — 동일 |
| dkg-system | domain_data | domain_data | **med** | DKG 고정 축/성장 나선 시스템 전체 — 동일 |

예상 dup-coord 감소: 0 (의도적 — `dkg_data` 분할이 의미 없어 skip). 본 그룹은 Phase 5c (layout 승격 또는 sibling `contains`) 로만 해소 가능.

## 마이그레이션 수 집계

### HIGH 47 건

- `func_def` → 신규 값: 19 (A.1 hrns=1 gt=1 anl=3 / A.2 dsv=3 / A.3 enc=4 / A.4 enc=2 / A.5 anl=1 / A.6 nst=3 / A.7 skip=2) = HIGH 16 + TODO 2(A.7 tag만) = 실제 이동 HIGH 16, TODO 2 는 B-3 tag
- `func_def` → fallback (HIGH): bdd-contract-system 은 harness 로 이동, decision-service/definition-service 는 low 이므로 HIGH 에서 제외 → HIGH 계산 시 이동 21 포함 (A.1 6건 + A.2 3 + A.3 4 + A.4 2 + A.5 1 + A.6 3 + A.7 0 이동 = 19 + A.7 고정 tag 2 = 21)
- `process_flow` → 11 HIGH (B.1 4 + B.2 4 + B.3 2 + B.4 1 = 11)
- `api_contract` → 10 HIGH (C.1 4 + C.2 3 + C.3 3 = 10, 단 decode_contract 1+... C.1 4, C.2 3(decode-api/service-spec/system) + registry-system stays, C.3 4 = 10 혹은 11. 집계 정확도는 B-0 구현 직전 재검증)
- `domain_data` → 5 HIGH (D.1 4 이동 + definition-catalog-spec 유지)

### MED 10 건

func_def: registry-service-modules / df-narrative-group / df-system (+ decision-service-system, definition-service-system 은 LOW)
process_flow: query-quality-bundle / system-infra / system-libraries
api_contract: registry-system (fallback 유지 "선택") / (없음)
domain_data: dkg-skill-catalog / dkg-state-store / dkg-system

= 3 + 3 + 1 + 3 = 10 ✓

### LOW 2 건

decision-service-system, definition-service-system — A.1 의 "서비스 전체" 문서들. 사람 결정 필요.

## 배치 구성 (B-1 실행 순서)

| 배치 | 대상 aspect | HIGH 건수 | dup-coord 기대 감소 |
|---|---|---:|---|
| B-1a | func_def | 21 | 7 → 2–3 (일부 신규 값 재수렴 잔존) |
| B-1b | process_flow | 11 | 4 → 1–2 |
| B-1c | api_contract | 10 | 3 → 1 |
| B-1d | domain_data | 5 | 2 → 1 |

각 배치는 독립 PR 권장.

## 참조

- [00-design.md](./00-design.md) — 제안 분할 근거
- [01-migration.md](./01-migration.md) — 롤아웃 단계
- `pnpm exec qa-sdk def audit | grep duplicate-coordinate` — 그룹 재생성 원본 데이터
- `docs/proposals/domain-hierarchy/reviews/2026-04-20-phase5-redesign.md` §표 — 그룹 1–7, 8–13 원 행
