---
def:
  id: spec-architecture-stack
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: approved
  tags: [entry-point]
  links:
    - target: spec-system-architecture
      type: refines
---

# Spec Architecture 스택

## 목적 ^purpose

spec-engine의 패키지 구성, DKG 타입 계층, skills, convergence, SDK/CLI/store 구조를 분리해 전체 스택 지도를 정리한다.

## 스택 구조

- 패키지 구성은 core, server, CLI, SDK, store가 어떤 경계로 협력하는지 보여준다.
- DKG 타입 계층과 schema category는 설계 정보를 그래프에 올리는 공통 모델이다.
- skills, convergence, CLI/store는 같은 스펙 엔진 위에서 다른 실행 표면을 제공한다.
