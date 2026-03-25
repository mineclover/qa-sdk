---
def:
  id: decode-api
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: approved
  tags: [tier-infra]
  links:
    - target: decode-bundle
      type: depends_on
---
# Decode Service REST API

## 목적 ^purpose

주소 정수를 entity ID 매핑으로 변환하는 REST 엔드포인트. decode(단일), batch(배치), deep(index_ref 확장) 3개 엔드포인트를 제공한다.

## 구성 ^overview

3개 엔드포인트: POST /decode(단일 변환), POST /decode/batch(배치 변환), POST /decode/deep(index_ref 재귀 확장).
포맷 자동 감지: colon protocol, URI protocol, compact protocol.
