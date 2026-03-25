---
def:
  id: ingest-runtime-middleware
  scope: constraint
  aspect: infra_constraint
  depth: specification
  lifecycle: approved
  tags: [performance, observability, tier-infra]
  links:
    - target: ingest-infra-spec
      type: refines
    - target: ingest-api-spec
      type: constrains
---

# Ingest 런타임 미들웨어

## 목적 ^purpose

health check, rate limiting, request ID, error handler 미들웨어 규칙을 분리해 ingest 서비스의 공통 제약을 정리한다.

## 미들웨어 규칙

- health check는 저장소/큐 의존성과 분리된 가벼운 경로를 유지해야 한다.
- rate limiting은 ingest API 보호가 목적이며 운영용 admin 경로와 같은 값으로 묶지 않는다.
- request ID와 error handler는 모든 요청 흐름에 동일하게 적용돼야 진단이 가능하다.
