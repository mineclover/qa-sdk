---
def:
  id: wi-format-registry
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  tags: [tier-infra]
  links:
    - target: wi-pack-format-def
      type: depends_on
---
# FormatRegistry

## 목적 ^purpose

PackFormat을 등록/조회하는 수평 확장 레지스트리. 새 포맷을 추가할 때 기존 코드를 수정하지 않고 레지스트리에 등록만 하면 된다.
