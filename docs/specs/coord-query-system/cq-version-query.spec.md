---
def:
  id: cq-version-query
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  tags: [tier-infra]
  links:
    - target: wi-api
      type: depends_on
    - target: registry-version-lifecycle
      type: depends_on
---
# Version Query

## 목적 ^purpose

동일 prefix의 여러 버전을 횡단하여 주소 변환, 히스토리 조회, 마이그레이션 경로 탐색을 수행하는 함수.
