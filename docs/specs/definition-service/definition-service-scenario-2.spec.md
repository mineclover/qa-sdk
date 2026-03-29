---
def:
  id: definition-service-scenario-2
  scope: feature
  aspect: scenario
  depth: specification
  lifecycle: draft
  svc: definition-service
  links:
    - target: definition-service-system
      type: refines
    - target: def-svc-graph-module
      type: depends_on
---
# 그래프 검증 + 영향분석

## 목적 ^purpose

문서 그래프의 무결성을 검증하고, 특정 문서 변경 시 영향 범위(blast radius)를 사전에 파악하는 흐름을 검증한다. 깨진 링크, 순환 참조, 고아 문서 등 구조적 결함을 탐지하고, concern 태그 전파가 올바르게 동작하는지 확인한다.

## 행위자 ^actor

- **문서 관리자**: 핵심 문서를 수정하기 전에 영향 범위를 확인하는 역할
- **definition-service**: 그래프 검증/영향분석 엔드포인트 제공 (GraphService, GraphController)

## 사전 조건 ^preconditions

- definition-service 기동 + 마이그레이션 완료
- 문서 그래프 시딩: 최소 5건의 문서가 contains/depends_on/implements 링크로 연결
  - doc-A (group) --contains→ doc-B (module) --contains→ doc-C (leaf)
  - doc-D --depends_on→ doc-B
  - doc-E --implements→ doc-B
- doc-B에 `security` concern 태그 부여
- 의도적 결함 1건 포함: doc-D가 존재하지 않는 `doc-phantom`에 depends_on 링크 보유 (broken-link)

## 스텝 ^steps

1. `POST /graph/validate` 호출 → 전체 그래프 검증 실행
2. 응답의 issues 배열에서 broken-link 이슈 확인 (doc-D → doc-phantom)
3. `GET /docs/doc-B/children` 호출 → contains 자식 목록 반환 (doc-C 포함)
4. `GET /docs/doc-B/parent` 호출 → contains 부모 반환 (doc-A)
5. `GET /docs/doc-B/incoming-links` 호출 → 역링크 목록 (doc-D depends_on, doc-E implements)
6. `GET /graph/doc-B/impact` 호출 → doc-B 변경 시 영향받는 문서 목록 조회
7. 영향 분석 결과에서 직접 의존자(doc-D), 구현체(doc-E), 하위 문서(doc-C) 확인
8. `GET /graph/doc-B/concerns` 호출 → security concern 전파 대상 조회
9. doc-B에 자기 참조 링크 추가 시도: `POST /docs/doc-B/links` + `{ target: "doc-B", type: "depends_on" }`
10. `POST /graph/validate` 재실행 → self-ref 이슈 추가 탐지 확인

## 검증 ^assertions

- POST /graph/validate → 200 OK, issues 배열 반환
- broken-link 이슈: `{ severity: "error", docId: "doc-D", target: "doc-phantom" }` 형태
- GET /docs/:id/children → 200 OK, contains 관계 자식만 반환 (depends_on 등 제외)
- GET /docs/:id/parent → 200 OK, contains 부모 1건 반환 (다중 부모 시 경고)
- GET /docs/:id/incoming-links → depends_on, implements 등 모든 유형의 역링크 포함
- GET /graph/:id/impact → 직접 의존자 + 전이적 의존자 포함, 영향 범위 트리 구조
- impact 결과에 doc-D (depends_on), doc-E (implements), doc-C (contains 하위) 포함
- GET /graph/:id/concerns → depends_on 링크를 타고 하위 전파된 concern 목록
- security concern이 doc-D (depends_on 역방향)에 전파 확인
- self-ref 링크 추가 후 validate → self-ref severity: "error" 탐지
- 순환 참조 없는 정상 그래프 → circular-ref 이슈 0건

## 변형 ^variants

### V1: 순환 참조 탐지

- doc-X --depends_on→ doc-Y --depends_on→ doc-X 구성
- POST /graph/validate → circular-ref error 탐지, 관련 docId 쌍 반환

### V2: 고아 문서 탐지

- approved 상태인데 어떤 문서도 참조하지 않는 문서 추가
- validate → orphan warning 발생 확인
- draft 상태 고아 → warning 미발생 (draft/review 제외 규칙)

### V3: contains 깊이 초과

- contains 체인 5단계 구성 (A→B→C→D→E→F)
- validate → contains-depth warning 발생 (4단계 초과)

### V4: 다중 부모 (cross-scope 태그)

- doc-Z가 두 group에 동시 contains → multi-parent warning
- doc-Z에 cross-scope 태그 부여 → warning 해제 확인

## 재검토 트리거 ^update-trigger

- def-svc-graph-module: 그래프 탐색 알고리즘 변경 시
- definition-taxonomy: LinkType 규칙 변경 시 (순환 허용/금지 등)
- definition-state-model: lifecycle 상태에 따른 orphan 판정 변경 시
- def-svc-data-model: document_links 테이블 스키마 변경 시
