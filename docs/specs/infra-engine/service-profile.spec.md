---
def:
  id: service-profile
  scope: feature
  aspect: func_def
  depth: specification
  level: leaf
  lifecycle: approved
  layer: operation
  tags: [infra, service-profile, url, cli]
  links:
    - target: infra-service-operations
      type: refines
---
# Service Profile (서비스 URL 중앙 관리)

## 목적 ^purpose

CLI와 서비스가 사용하는 URL을 `~/.qa-sdk/service-profile.json`으로 중앙 관리하고, 모드 전환으로 일괄 변경하는 방식을 정의한다.

## 구성 ^overview

- `~/.qa-sdk/service-profile.json` — 모든 CLI 명령의 서비스 URL 소스
- `qa-sdk service mode local|staging|prod` — 전체 URL 일괄 전환
- `qa-sdk service mode --set <serviceId>=<url>` — 개별 URL 커스텀
- URL 우선순위: **환경변수 > --flag > service-profile > local 기본값**
- `ingest mode`는 `service mode`의 alias (하위 호환)
- `service-profile.ts` (`cli/src/lib/`) — `getServiceUrl(serviceId)` 공용 유틸. 새 CLI 명령에서 URL 하드코딩 금지
