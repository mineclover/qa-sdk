---
def:
  id: query-api
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: approved
  tags: [tier-infra]
  links:
    - target: query-rules
      type: depends_on
    - target: gate-api
      type: depends_on
---
# Query Service REST API

## 목적 ^purpose

좌표 질의를 수행하는 REST 엔드포인트. resolve(단일 해소), match-ranges(범위 매칭), compose-query(복합 질의), version-query(버전 질의), cross-index(교차 인덱스)를 제공한다.

## 구성 ^overview

5개 질의 엔드포인트: POST /query/resolve, POST /query/match-ranges, POST /query/compose, POST /query/version, POST /query/cross-index.
Gate 통합: gateMode 파라미터로 gate 필터 적용 여부 선택.
