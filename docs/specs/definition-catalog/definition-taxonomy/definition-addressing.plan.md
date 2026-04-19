---
def:
  id: definition-addressing-plan
  type: knowledge
  knowledge_kind: proposal
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: draft
  layer: domain
  svc: definition-service
  links:
    - target: definition-addressing
      type: refines
---

# Definition Addressing — 전환 계획

## 목적 ^purpose

`id` 중심 문서 식별에서 `v2 address` 병행 저장과 address-first 조회로 이동하는 전환 단계를 추적한다.

## 현재 단계

- explicit `def_document:v2:*`는 sync/DB에 보존된다.
- incoming/outgoing/impact/boundary 조회면에서 address를 병행 노출한다.
- `document_links`는 id와 address를 함께 저장한다.

## 다음 단계

- address-first query surface 확장
- v1 fallback 축소
- 내부 read model의 address 우선화
