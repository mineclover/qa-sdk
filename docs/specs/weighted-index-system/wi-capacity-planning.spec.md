---
def:
  id: wi-capacity-planning
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  tags: [performance]
  links:
    - target: wi-pack-format-def
      type: depends_on
    - target: wi-semantic-address
      type: depends_on
---
# Capacity 계획

## 목적 ^purpose

fitShape(shape 용량 맞춤), fitLayout(shape + layout 통합), planCapacity(growth-aware capacity 제안). 축 추가/확장 시 최적 capacity를 자동 계산한다.
