---
def:
  id: registry-api
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: approved
  links:
    - target: registry-data-model
      type: depends_on
    - target: registry-version-lifecycle
      type: depends_on
---
# Registry Service REST API

## 목적 ^purpose

Prefix 등록/조회, 버전 생성/전이, DAG 관계 질의를 제공하는 REST 엔드포인트.

## 구성 ^overview

Prefix 관리: POST/GET /prefixes, GET /prefixes/:id.
버전 관리: POST /prefixes/:id/versions, POST /versions/:id/lock, POST /versions/:id/release, POST /versions/:id/activate.
DAG 질의: GET /prefixes/:id/dependants, GET /prefixes/:id/dependencies.
Draft: POST /drafts, POST /drafts/:id/simulate, POST /drafts/:id/apply.
