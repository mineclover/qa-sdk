---
def:
  id: authorization-ontology-permission-engine-bridge
  type: knowledge
  knowledge_kind: concept
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: draft
  layer: domain
  tags: [security, structural]
  links:
    - target: authorization-ontology-system
      type: refines
    - target: permission-system
      type: depends_on
    - target: authorization-ontology-audit-layer
      type: depends_on
source: packages/authorization-ontology/src/permission-engine-bridge.test.ts
---

# Authorization Ontology Permission Engine Bridge — bitmask 권한 커널 투영

## 목적 ^purpose

`permission-engine`의 bitmask 권한 커널을 authorization ontology graph로 투영하는 방식을 정의한다. 목표는 `PermissionSet`, role inheritance, org-role assignment, user override, audit result를 Cerbos/proxy/application graph와 같은 권한 관측 좌표계에서 비교할 수 있게 하는 것이다.

## 구성 ^overview

bridge는 `permission-engine`을 대체하지 않는다. 실행 성능과 O(1) check는 `permission-engine`이 담당하고, authorization ontology는 그 실행 구조와 결과를 graph로 저장/공유/감사한다.

지원하는 projection 표면:

- `PermissionSetSnapshot` 또는 grant list
- `DomainRoleDef`
- `OrgRoleDef`
- `UserPermissionEngine.audit()` 결과
- `PermissionMiddleware.check()` 결과

## 정의 ^defines

`PermissionSet`은 `feature × role` 행렬을 bitmask로 압축한다. authorization ontology에서는 feature를 `permission_feature` resource로, role을 `domain_role` role node로 투영한다. 부여된 bit는 `role -> grants_feature -> permission_feature` relation이 된다.

`ScopedEngine`의 scope key는 `permission_scope` resource로 투영한다. materialized mask policy는 `policy -> materializes_permission -> permission_scope` relation을 가진다.

`RoleRegistry`는 domain role inheritance와 deny를 표현한다.

- parent role 상속: `domain_role -> derives_role_from -> domain_role`
- 직접 feature 부여: `domain_role -> grants_feature -> permission_feature`
- feature deny: `domain_role -> denies_feature -> permission_feature`
- role deny: `domain_role -> denies_role -> domain_role`

`OrgRoleRegistry`는 조직 단위 역할 묶음이다.

- org role 상속: `org_role -> derives_role_from -> org_role`
- domain role 배정: `org_role -> assigns_role -> domain_role`

`UserPermissionEngine.audit()`는 최종 권한 판정을 decision graph로 투영한다. role 단계 source는 `principal -> has_role -> domain_role`과 `domain_role -> grants_feature -> permission_feature`로 남기고, user override는 `permission_engine_user_override -> denies_feature` 및 `overrides_permission`으로 남긴다.

`PermissionMiddleware.check()`는 token/schema/version/domain/feature 피드백을 decision graph로 투영한다. middleware가 반환하는 `VERSION_MISMATCH`, `SCHEMA_MISMATCH`, `NO_DOMAIN_CLAIM`, `FEATURE_NOT_FOUND`, `PERMISSION_DENIED`는 decision reason과 `denies_action` metadata에 보존된다.

이 bridge는 `permission-engine` runtime을 직접 import하지 않는다. 대신 snapshot/audit result와 호환되는 plain object를 입력으로 받아 브라우저/서버 양쪽에서 사용할 수 있는 graph 계약을 유지한다.

## 검증 ^validation

`authorization-ontology`는 bridge projector의 순수 계약 테스트와 별도로, `permission-engine` source runtime을 직접 사용하는 proof test를 가진다.

- 실제 `PermissionSet.toSnapshot()`의 bitmask grant와 `grants_feature` relation address가 일치해야 한다.
- 실제 `RoleRegistry`의 parent inheritance와 `OrgRoleRegistry`의 domain role assignment가 relation graph로 표현되어야 한다.
- 실제 `UserPermissionEngine.audit()`의 `granted`, `sources`, `denialReason`이 decision graph, role source, user override relation으로 보존되어야 한다.
- 실제 `PermissionMiddleware.check()`의 deny feedback이 `PERMISSION_DENIED`로 분리되고, middleware feedback graph에 보존되어야 한다.

## 구현 참조

- 구현: `packages/authorization-ontology/src/index.ts`
- 테스트: `packages/authorization-ontology/src/permission-engine-bridge.test.ts`
