---
def:
  id: definition-service-scenario-4
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

# boundary 구조 + direct coupling 조회

## 목적 ^purpose

definition-service가 문서의 boundary 구조와 direct coupling만 목적/개요 수준으로 반환하는지 검증한다.

## 행위자 ^actor

- **CLI / 에이전트**: 특정 boundary 문서를 기계적으로 조회하는 소비자
- **definition-service**: boundary 요약 응답을 조립하는 서비스

## 사전 조건 ^preconditions

- definition-service 기동 완료
- 대상 문서가 `contains` 멤버와 `depends_on/refines/constrains` direct 링크를 최소 1건씩 가진다
- 대상 문서와 연결 문서 모두 `^purpose` 또는 `^overview`를 가진다

## 스텝 ^steps

1. `GET /docs/:id/boundary` 호출
2. 응답의 `boundary` 블록에서 scope/aspect/depth/lifecycle 확인
3. `members` 배열에서 direct `contains` 멤버만 포함되는지 확인
4. `couplings.outgoing`에서 direct `depends_on/refines/constrains`만 포함되는지 확인
5. `couplings.incoming`에서 direct incoming coupling만 포함되는지 확인
6. `GET /docs/:id/boundary?level=purpose` 호출
7. purpose 레벨 응답에서 overview 기반 요약이 제거되는지 확인

## 검증 ^assertions

- `GET /docs/:id/boundary` → 200 OK
- 응답에는 `boundary`, `members`, `couplings.outgoing`, `couplings.incoming` 키가 존재
- `members`에는 direct `contains` 멤버만 포함되고 손자 문서는 포함되지 않음
- `couplings`에는 `depends_on/refines/constrains`만 포함되고 `contains`는 포함되지 않음
- `level=purpose` 요청 시 summary는 `purpose` 기준으로만 생성됨
- 존재하지 않는 문서 ID → 404 Not Found

## 변형 ^variants

### V1: contains 멤버가 없는 leaf boundary

- `members`는 빈 배열
- `couplings`만 반환

### V2: direct coupling이 없는 isolated boundary

- `couplings.outgoing` / `couplings.incoming`은 빈 배열
- `boundary`와 `members`만 반환

### V3: refines만 가진 boundary

- `couplings`에 `refines`만 포함
- `depends_on/constrains`는 빈 배열

## 재검토 트리거 ^update-trigger

- def-svc-api-contract: boundary 응답 shape 변경 시
- definition-assembly: purpose/overview 조립 규칙 변경 시
- definition-mgmt-graph-links: direct coupling 정의 변경 시
