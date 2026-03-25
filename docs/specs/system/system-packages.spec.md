---
def:
  id: system-packages
  scope: flow
  aspect: relation
  depth: overview
  lifecycle: approved
---
# 패키지 구조

## 목적 ^purpose

qa-sdk 모노레포의 패키지 의존 관계. 인코딩 라이브러리 체인(weighted-index → bit-index → permission-engine)과 플랫폼 체인(@qa-sdk/core → logger → codec → context → sdk).

## 구성 ^overview

인코딩 체인: weighted-index → bit-index → permission-engine.
플랫폼 체인: @qa-sdk/core → logger → codec → context → sdk.
서비스: ingest-server(3200), registry-service(3300), gate(3400), query(3500), decode(3600).
