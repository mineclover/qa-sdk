---
def:
  id: platform-demo-api-spec
  scope: interface
  aspect: api_contract
  depth: overview
  lifecycle: approved
  layer: mediation
  svc: platform-demo
  tags: [tier-app]
  links:
    - target: motion-content-glossary
      type: refines
---
# Platform Demo API

## 목적 ^purpose

데모 카탈로그의 codec/registry를 Hono API로 노출하는 라이브러리. 서비스/권한/이벤트 인코딩·디코딩 엔드포인트와 버전별 DimDef/capacity 조회를 제공하여, platform-demo 프론트엔드와 외부 도구가 좌표계를 HTTP로 소비할 수 있게 한다.

## 구성 ^overview

- 버전별 codec 제공: v1~v4 (service, permission, event)
- Registry: prefix/version/capacity 조회
- demo-snapshot 데이터 기반 — SSOT 파생
- 소스: `packages/platform-demo-api/src/`
