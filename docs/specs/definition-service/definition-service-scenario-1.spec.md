---
def:
  id: definition-service-scenario-1
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
# 문서 CRUD + 전문검색

## 목적 ^purpose

definition-service의 문서 생성/조회/수정/삭제와 FTS5 전문검색이 올바르게 동작하는지 검증한다. DB가 메타데이터 SSOT이며, 주소(address)는 scope×aspect×depth×seq 좌표에서 자동 계산된다.

## 행위자 ^actor

- **API 소비자**: definition-service REST API를 호출하는 클라이언트 (CLI, 다른 서비스, 또는 테스트 코드)
- **definition-service**: NestJS 기반 서비스 (port 3700, SQLite + drizzle ORM)

## 사전 조건 ^preconditions

- definition-service가 SQLite(`:memory:` 또는 파일)로 기동
- DDL 마이그레이션 완료 (documents, document_links, document_tags 테이블 + FTS5 인덱스 생성)
- 초기 문서 3건 이상 시딩 (scope=feature, scope=interface, scope=flow 각 1건)
- 시딩 문서 중 하나의 purpose 필드에 "검색 대상 키워드" 포함

## 스텝 ^steps

1. `GET /docs` 호출 → 전체 문서 목록 반환 확인
2. `GET /docs?scope=feature&limit=10&offset=0` 호출 → scope 필터 + 페이지네이션 동작 확인
3. `GET /docs?q=검색 대상 키워드` 호출 → FTS5 전문검색으로 해당 문서 반환
4. `GET /docs/:id` 호출 → 시딩된 문서 단건 조회
5. `PATCH /docs/:id` 호출 → `{ layer: "operation", lifecycle: "review" }` 메타데이터 업데이트
6. `GET /docs/:id` 재조회 → 변경된 layer, lifecycle 확인 + address 자동 재계산 확인
7. `POST /docs/:id/tags/security` 호출 → 태그 추가
8. `GET /docs?tag=security` 호출 → 태그 필터로 해당 문서 반환
9. `DELETE /docs/:id/tags/security` 호출 → 태그 제거
10. `POST /docs/:id/links` 호출 → `{ target: "다른문서id", type: "depends_on" }` 링크 추가
11. `GET /docs/:id/incoming-links` (target 문서) → 역링크에 방금 추가한 링크 포함 확인
12. `DELETE /docs/:id/links` 호출 → 링크 제거

## 검증 ^assertions

- GET /docs → 200 OK, 시딩 문서 수 이상의 결과 반환
- GET /docs?scope=feature → 반환된 모든 문서의 scope가 "feature"
- GET /docs?q=키워드 → 200 OK, 결과에 해당 키워드 포함 문서 존재 (FTS5 매칭)
- GET /docs/:id → 200 OK, id/scope/aspect/depth/address 필드 존재
- PATCH /docs/:id → 200 OK, 응답에 변경된 필드 반영
- PATCH 후 재조회 시 address 값이 좌표 변경에 따라 재계산됨 (이전 address와 다를 수 있음)
- POST /docs/:id/tags/:tag → 201 Created
- DELETE /docs/:id/tags/:tag → 204 No Content
- 존재하지 않는 문서 ID → GET /docs/:id 404 Not Found
- 중복 태그 추가 시도 → 409 Conflict 또는 멱등 처리
- POST /docs/:id/links → 201 Created, incoming-links에서 역방향 조회 가능
- DELETE /docs/:id/links → 204 No Content

## 변형 ^variants

### V1: 다중 필터 조합

- `GET /docs?scope=feature&layer=domain&svc=definition-service&limit=5` → 모든 필터 AND 조합 적용
- 반환된 각 문서가 세 필터 모두 만족하는지 확인

### V2: FTS5 부분 일치

- `GET /docs?q=검색*` → prefix 매칭으로 부분 일치 검색
- FTS5 토큰 기반 매칭이므로 중간 문자열 검색은 미지원 확인

### V3: 페이지네이션 경계

- 전체 문서 수 > limit 설정 → offset 증가 시 다음 페이지 반환
- offset이 전체 수 초과 → 빈 배열 반환

### V4: 잘못된 메타데이터 업데이트

- `PATCH /docs/:id` + `{ scope: "invalid_scope" }` → 400 INVALID_INPUT
- DB 상태 변경 없음 확인

## 재검토 트리거 ^update-trigger

- def-svc-api-contract: 엔드포인트 스키마/파라미터 변경 시
- def-svc-data-model: documents 테이블 컬럼 변경 시
- def-svc-search-module: FTS5 인덱스 구성 변경 시
- definition-addressing: 좌표 → address 계산 로직 변경 시
