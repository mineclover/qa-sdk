---
def:
  id: authorization-ontology-cerbos-mapping
  type: knowledge
  knowledge_kind: concept
  scope: constraint
  aspect: biz_constraint
  depth: specification
  lifecycle: draft
  layer: domain
  tags: [security, structural]
  links:
    - target: authorization-ontology-system
      type: refines
    - target: authorization-ontology-realm-model
      type: depends_on
---

# Authorization Ontology Cerbos Mapping — Cerbos 정책 선언 투영

## 목적 ^purpose

Cerbos resource policy를 authorization ontology의 policy/resource/action/relation graph로 투영하는 방식을 정의한다. 목표는 Cerbos의 선언적 권한 표현력을 유지하면서, 배포 provenance와 리니지 기반 정책 전파 같은 Cerbos 외부 영역을 ontology가 보완할 수 있게 하는 것이다.

## 구성 ^overview

기본 대응은 다음과 같다.

- Cerbos `resourcePolicy` → `PolicyRef`
- Cerbos `resource` → `ResourceRef`
- Cerbos `actions` → `ActionRef`
- Cerbos `rules.effect` → `allows_action` 또는 `denies_action`
- Cerbos `roles/derivedRoles/condition` → relation metadata

## 정의 ^defines

Cerbos는 policy decision point이자 선언형 권한 정책 중심이다. authorization ontology는 Cerbos policy YAML을 opaque file로 보지 않고, policy/resource/action/condition/effect/relation으로 분해하여 관측과 diff가 가능한 graph로 만든다.

Cerbos가 직접 커버하지 않는 영역:

- 어떤 Pulumi stack/ArgoCD application으로 배포됐는가
- 어떤 Caddy/AuthentiK route에서 enforcement 되는가
- 어떤 ZITADEL issuer/principal과 연결되는가
- 어떤 데이터 컬럼 lineage에 따라 downstream 권한이 파생되는가
