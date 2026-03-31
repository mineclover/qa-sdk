---
def:
  id: policy-prefix-group
  level: module
  scope: data
  aspect: prefix_schema
  depth: overview
  lifecycle: approved
  tags: [structural, entry-point, generated]
  links:
    - target: prefix-permission
      type: contains
    - target: prefix-rbac
      type: contains
---

## 목적 ^purpose

권한/접근 제어 prefix
category: policy에 해당하는 prefix를 모아 관리한다.

## 구성 ^overview

- `permission`
- `rbac`
