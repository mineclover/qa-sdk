---
def:
  id: qa-sdk-engine-system
  type: spec
  level: module
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: domain
  svc: engine
---

# QA-SDK Engine System

## 목적 ^purpose

문서 그래프 분석, 로직 매칭, 실행 제어 등 QA-SDK의 핵심 도메인 추론 및 실행 로직을 담당한다.

## 구성 ^overview

- **Path Matcher**: 문서 및 코드 경로 매칭 엔진
- **Traverser**: 그래프 탐색 및 추적 로직
- **Logic Engine**: 비즈니스 규칙 평가 엔진
