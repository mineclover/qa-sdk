---
def:
  id: authorization-management-hardening-todo
  level: leaf
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: draft
  layer: operation
  tags: [security, observability, structural]
  links:
    - target: authorization-management-usecases
      type: refines
    - target: authorization-management-usage-rule
      type: depends_on
    - target: authorization-ontology-system
      type: depends_on
---

# Authorization Management Hardening — 보강 TODO

## 목적 ^purpose

현재 구현된 권한 관리 usecase를 운영 가능한 권한 관리 시스템으로 안정화하기 위해 남은 구현 항목을 추적한다.

## 구현 항목

### Graph Store / API

- [ ] `AuthorizationOntologyGraph` 저장용 store adapter 정의
- [ ] graph snapshot 저장/조회 API 추가
- [ ] decision observation ingest API 연결
- [ ] graph diff API 추가

### Policy Source Adapter

- [ ] Cerbos YAML/JSON loader 추가
- [ ] Cerbos bundle/sourceRef/version metadata adapter 추가
- [ ] Caddy config adapter 추가
- [ ] Authentik outpost/application adapter 추가
- [ ] ArgoCD/Pulumi output에서 route-policy map 자동 생성

### Runtime Feedback

- [ ] `PermissionMiddleware` feedback을 ingest event로 전송하는 adapter 추가
- [ ] `VERSION_MISMATCH` 발생 시 token refresh/remediation workflow 정의
- [ ] `SCHEMA_MISMATCH` 발생 시 re-authentication workflow 정의
- [ ] `PERMISSION_DENIED`와 `NO_DOMAIN_CLAIM`의 운영 alert severity 분리

### Audit / Coverage

- [ ] route-policy-domain-resource coverage score 계산
- [ ] proxy-only 보호 route와 app-only 보호 resource 차이 report
- [ ] allow decision이 policy action과 불일치할 때 gate 실패 처리
- [ ] dangling relation을 build/test gate로 승격
- [ ] column lineage policy propagation 결과를 audit report에 포함

### Monitor Web

- [ ] `authorization-monitor-web` live API adapter 추가
- [ ] graph store에서 실제 graph를 읽는 모드 추가
- [ ] audit issue panel 추가
- [ ] RLSC layout snapshot 자동 수집 테스트 추가
- [ ] edge/node alignment regression test 추가

### Security / Privacy

- [ ] principal/resource/action metadata masking rule 정의
- [ ] PII column lineage graph 공개 범위 정책 정의
- [ ] decision reason에 민감한 condition 값이 노출되지 않게 redaction rule 추가
- [ ] graph export 권한 정책 추가
