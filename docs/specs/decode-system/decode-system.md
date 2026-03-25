---
def:
  id: decode-system
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: approved
  tags: [entry-point]
  links:
    - target: decode-api
      type: contains
    - target: decode-bundle
      type: contains
    - target: decode-deploy
      type: contains
---
# Decode 시스템

## 목적 ^purpose

MetaRegistry 없이 DecodeMap 번들로 독립 decode를 수행하는 경량 서비스. Edge Worker부터 Standalone Node.js까지 다양한 배포 형태를 지원한다.

## 구성 ^overview

3개 정의: REST API(decode/batch/deep), DecodeMap 번들 관리, 배포 토폴로지(embedded/sidecar/standalone).
