---
def:
  id: definition-service-scenario-5
  scope: feature
  aspect: scenario
  depth: specification
  lifecycle: draft
  svc: definition-service
  links:
    - target: definition-service-system
      type: refines
    - target: def-svc-api-contract
      type: depends_on
---

# boundary context 복합 조회

## 목적 ^purpose

definition-service가 boundary 구조, concern 전파, impact, feedback trace를 한 번에 조립하는 복합 조회를 올바르게 반환하는지 검증한다.

## 행위자 ^actor

- **에이전트 / CLI**: 특정 boundary를 작업 단위로 조회하는 소비자
- **definition-service**: boundaryContext를 REST/GraphQL로 제공하는 서비스

## 사전 조건 ^preconditions

- 대상 문서가 boundary direct coupling을 가진다
- 대상 문서 또는 영향받는 문서 중 일부에 concern 태그가 존재한다
- review-feedback synthetic source가 있거나 feedback request 요약을 만들 수 있다

## 스텝 ^steps

1. `GET /graph/:id/boundary-context` 호출
2. 응답의 `boundary` 블록이 기존 `/docs/:id/boundary`와 같은 구조인지 확인
3. `concerns` 블록에서 direct/inherited/all 확인
4. `impact` 블록에서 blastRadius, impacted, affectedGroups 확인
5. `feedbackTrace` 블록에서 최근 feedback request 요약 확인
6. `GET /graph/:id/boundary-context?mode=direct` 호출
7. direct 모드에서 one-hop 영향만 남는지 확인
8. GraphQL `boundaryContext(docId, level, mode)` 호출
7. GraphQL `doc(id) { boundaryContext { ... } }` lazy field 호출
8. 두 GraphQL 응답 shape가 top-level REST 응답과 논리적으로 일치하는지 확인

## 검증 ^assertions

- `/graph/:id/boundary-context` → 200 OK
- 응답은 `boundary`, `concerns`, `impact`, `feedbackTrace` 키를 가진다
- `boundary.members`와 `boundary.couplings`는 direct 구조만 포함한다
- `concerns.all`은 direct + inherited union이다
- `impact.blastRadius`는 `impact.impacted.length` 이상과 정합하다
- `mode=direct`일 때 `impact.impacted[*].distance`는 1만 허용한다
- GraphQL top-level query와 lazy field 모두 null이 아닌 boundaryContext를 반환한다
- 존재하지 않는 문서 ID → 404 또는 GraphQL null

## 변형 ^variants

### V1: concern 없는 boundary

- `concerns.direct` / `concerns.inherited`는 빈 배열
- `impact`와 `boundary`는 정상 반환

### V2: feedback 없는 boundary

- `feedbackTrace`는 빈 배열
- 나머지 필드는 정상 반환

### V3: purpose level

- `level=purpose`일 때 summary는 purpose 기준으로 축약된다
- `overview` 기반 문구는 포함되지 않는다

## 재검토 트리거 ^update-trigger

- def-svc-api-contract: boundaryContext 응답 shape 변경 시
- definition-mgmt-graph-links: direct coupling 정의 변경 시
- definition-mgmt-feedback-loop: feedback trace 계산 규칙 변경 시
