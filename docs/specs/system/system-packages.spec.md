---
def:
  id: system-packages
  scope: flow
  aspect: relation
  depth: overview
  lifecycle: approved
  tags: [tier-system]
  links:
    - target: spec-engine-architecture
      type: refines
    - target: registry-api
      type: refines
---

# 패키지 구조

## 목적 ^purpose

qa-sdk 모노레포의 패키지 의존 관계. 인코딩 라이브러리 체인(weighted-index → bit-index → permission-engine)과 플랫폼 체인(@qa-sdk/core → logger → codec → context → sdk).

## 구성 ^overview

overview: 총 3개 멤버.
- `인코딩 체인`: weighted-index에서 bit-index, permission-engine으로 이어지는 인코딩 라이브러리 의존 체인을 정리한다.
- `플랫폼 체인`: @qa-sdk/core에서 logger, codec, context, sdk로 이어지는 플랫폼 계층을 정리한다.
- `서비스`: ingest, registry, gate, query, decode 서버가 어떤 포트와 역할을 갖는지 요약한다.
플랫폼 체인: @qa-sdk/core → logger → codec → context → sdk.
서비스: ingest-server(3200), registry-service(3300), gate(3400), query(3500), decode(3600).
