---
def:
  id: cf-workers-deployment
  scope: flow
  aspect: process_flow
  depth: specification
  level: leaf
  lifecycle: approved
  layer: operation
  tags: [infra, cloudflare, workers, deployment]
  links:
    - target: infra-service-operations
      type: refines
---
# Cloudflare Workers 배포

## 목적 ^purpose

Cloudflare Workers 환경에 배포되는 서비스의 URL, 번들 크기, 호환 패키지, 엔드포인트 피드백 방식을 정의한다.

## 배포 현황 ^overview

| 서비스 | URL | 번들 크기 |
|--------|-----|----------|
| decode-service | https://qa-decode-service.astralclover.workers.dev | 391 KiB (73 KiB gzip) |
| gate-service | https://qa-gate-service.astralclover.workers.dev | 292 KiB (53 KiB gzip) |
| query-service | https://qa-query-service.astralclover.workers.dev | 810 KiB (142 KiB gzip) |

## 특성

- Workers 호환 패키지: `index-meta-workers` (Node.js 전용 드라이버 제외)
- 배포 후 endpoint가 `cloudflare-prod.json`에 자동 기록
