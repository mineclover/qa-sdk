---
def:
  id: shared-utility-group
  type: spec
  tier: layout
  scope: data
  aspect: system_data
  depth: overview
  lifecycle: approved
  layer: domain
  links:
    - target: system-libraries
      type: depends_on
---
# Shared Utility Group
## 목적 ^purpose
특정 도메인에 종속되지 않는 공통 유틸리티(Git, Config, Classifier, Context 등)들을 포함한다.
