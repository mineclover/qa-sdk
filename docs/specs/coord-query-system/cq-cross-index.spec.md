---
def:
  id: cq-cross-index
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  tags: [tier-infra]
  links:
    - target: wi-api
      type: depends_on
---
# Cross-Index Query

## 목적 ^purpose

서로 다른 prefix 간 공유 축을 기반으로 합성 질의를 수행하는 함수. prefix A의 결과를 prefix B의 조건으로 변환하여 교차 탐색한다.
