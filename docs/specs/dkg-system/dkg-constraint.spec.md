---
def:
  id: dkg-constraint
  scope: constraint
  aspect: tech_constraint
  depth: specification
  lifecycle: approved
  links:
    - target: dkg-node-types
      type: constrains
---
# DKG 불변식

## 목적 ^purpose

DKG 그래프의 구조적 불변 조건 7종(CON-001~CON-007). 그래프의 일관성과 좌표 시스템의 안정성을 보장한다.

## 불변 조건 ^constraint

1. **CON-001**: rbac_role과 role 동시 사용 금지
2. **CON-002**: 이벤트 prefix action dim은 *_action 축 사용
3. **CON-003**: DSL 관측/인프라 멤버는 svc_ref 필수
4. **CON-004**: classificationRate ≥ 80%
5. **CON-005**: critical anomaly → auto observation
6. **CON-006**: prefix_ref refEntries 필수. 미정의 → GateEngine reserved
7. **CON-007**: totalSpace > 2^53 → safePrecision=false
