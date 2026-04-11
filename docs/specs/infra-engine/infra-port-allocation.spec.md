---
def:
  id: infra-port-allocation
  scope: constraint
  aspect: infra_constraint
  depth: specification
  level: leaf
  lifecycle: approved
  layer: operation
  tags: [infra, port, k3s, cf-workers]
  links:
    - target: infra-service-operations
      type: refines
---
# 서비스 포트 할당

## 목적 ^purpose

QA-SDK 마이크로서비스의 포트 할당 규칙을 정의한다. K3s 로컬 클러스터와 Cloudflare Workers URL을 포함한다.

## 포트 테이블 ^overview

| 서비스 | 포트 |
|--------|------|
| ingest-server | 3200 |
| registry-service | 3300 |
| gate-service | 3400 |
| query-service | 3500 |
| decode-service | 3600 |
| definition-service | 3700 |
| motion-workspace | 3710 |
| decision-service | 3800 |
| gRPC debug | 50051 (`GRPC_PORT` 설정 시) |
