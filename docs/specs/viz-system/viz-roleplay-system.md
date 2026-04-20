---
def:
  id: viz-roleplay-system
  tier: system
  address: def_document:v2:1028
  scope: ui
  aspect: component
  depth: overview
  lifecycle: approved
  layer: experience
  svc: roleplay-web
  tags: [structural]
  links:
    - target: form-builder-structure
      type: contains
    - target: form-builder-renderer
      type: contains
    - target: qa-bridge-runtime
      type: contains
---

# Viz 역할놀이 그룹

## 목적 ^purpose

roleplay-web의 form-builder와 QA bridge를 구조 모델, 렌더링, 이벤트 전송 문서로 분리해 편집기 변경과 계측 변경을 독립시킨다.

## 구성 ^overview

- `form-builder-structure`: DOM 트리와 편집기 패널의 구조 모델을 정리한 문서.
- `form-builder-renderer`: auto-layout과 폼 렌더러 연결 규칙을 정리한 문서.
- `qa-bridge-runtime`: 사용자 상호작용을 QA 이벤트로 변환하고 템플릿과 통합하는 런타임 문서.

원본: `docs/specs/roleplay/form-builder.spec.md` (`form-builder-spec`), `docs/specs/roleplay/qa-bridge.spec.md` (`qa-bridge-spec`)
