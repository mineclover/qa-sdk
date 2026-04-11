---
def:
  id: authorization-ontology-system
  type: knowledge
  knowledge_kind: concept
  level: group
  scope: constraint
  aspect: biz_constraint
  depth: overview
  lifecycle: draft
  layer: domain
  tags: [security, structural, cross-scope, entry-point]
  links:
    - target: operational-ontology-system
      type: depends_on
    - target: permission-system
      type: depends_on
    - target: authorization-ontology-realm-model
      type: contains
    - target: authorization-ontology-cerbos-mapping
      type: contains
    - target: authorization-ontology-auth-chain
      type: contains
    - target: authorization-ontology-column-lineage-policy
      type: contains
    - target: authorization-ontology-decision-observation
      type: contains
    - target: authorization-ontology-package-architecture
      type: contains
---

# Authorization Ontology System — Cerbos 중심 권한 관리 온톨로지

## 목적 ^purpose

Cerbos를 단일 권한 선언/판정 중심으로 두고, ZITADEL, Authentik proxy, Caddy, Cloud LB, Pulumi, ArgoCD, 데이터 컬럼 리니지를 같은 operational ontology 좌표계로 연결하는 권한 관리 온톨로지를 정의한다.

## 구성 ^overview

authorization ontology는 Cerbos를 대체하지 않는다. Cerbos가 표현하는 principal/resource/action/policy/decision을 canonical declaration으로 읽고, Cerbos 밖의 영역을 보완한다.

- **identity realm**
  ZITADEL issuer, SSO principal, service account
- **enforcement realm**
  Cloud LB, Caddy, Authentik proxy, service middleware, Cerbos PDP
- **policy realm**
  Cerbos resource policy, derived role, policy version
- **deployment realm**
  Pulumi stack, ArgoCD application, Git revision
- **data realm**
  dataset/table/view/column과 column-level lineage
- **observation realm**
  실제 authorization decision, checkpoint, diff

## 정의 ^defines

핵심 원칙:

1. 권한 관리 주체는 하나로 통일한다.
2. Cerbos는 선언형 authorization policy의 중심이다.
3. Authentik proxy는 경로 차단형 enforcement point다.
4. ZITADEL은 identity issuer/SSO realm이다.
5. Pulumi/ArgoCD는 policy와 service wiring의 provenance다.
6. column-level lineage는 권한 정책 전파의 근거다.
7. 실제 Cerbos decision은 별도 decision node와 relation graph로 관측한다.
8. realm은 resource kind가 아니라 authority boundary다.
9. 실제 decision은 checkpoint로 관측되고 snapshot/diff로 관리된다.
