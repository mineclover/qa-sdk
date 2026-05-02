---
def:
  tier: component
  id: platform-demo-api
  address: def_document:v2:412684
  scope: interface
  aspect: api_contract
  depth: overview
  lifecycle: approved
  svc: platform-demo-api
  tags: [mediation, demo, api]
  links:
    - target: platform-demo-api-spec
      type: refines
---
# platform-demo-api

## 목적 ^purpose

데모 API 스텁 + registry 연동 라이브러리. 좌표계의 인코딩/디코딩 데모를 위한 HTTP API를 제공하며, registry에 등록된 카탈로그 데이터를 기반으로 동작한다.

## 구성 ^overview

- **Hono 앱**: CORS 활성화된 REST API
- **registry.ts**: demo-snapshot에서 카탈로그·코덱·축 메타데이터를 가져와 API로 노출
- **버전 관리**: v1~v4 다중 버전 지원 (DemoVer 기반)
- **permission-engine 연동**: PermissionSet 기반 권한 인코딩/디코딩 데모
- **db/schema.ts**: 로컬 데이터 스키마
- **stubs/better-sqlite3.ts**: 환경 호환 스텁

## 설계 결정 ^intent

- demo-snapshot SSOT 준수 — 하드코딩 없이 카탈로그에서 동적 파생
- 버전별 코덱 인스턴스 분리 (svcCodec, permCodec, evtCodec × v1~v4)
- Hono + Cloudflare Workers 호환 — Edge 런타임 배포 가능
