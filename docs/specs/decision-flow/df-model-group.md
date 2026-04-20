---
def:
  id: df-model-group
  level: module
  tier: system
  address: def_document:v2:342021
  scope: data
  aspect: domain_data
  depth: overview
  lifecycle: approved
  layer: domain
  svc: decision-flow
  tags: [structural, decision]
  links:
    - target: df-axis-model
      type: contains
    - target: df-observation-space
      type: contains
    - target: df-state-model
      type: contains
    - target: df-serialization
      type: contains
---
# Decision Flow 핵심 모델

## 목적 ^purpose

의사결정 좌표 시스템의 축 정의, 관측 공간, 상태 전이, 직렬화 계약을 정의하는 핵심 모델 그룹.

## 구성 ^overview

- `df-axis-model`: FlowSchema의 축(gate) 정의와 좌표 인코딩 규칙.
- `df-observation-space`: 의사결정 관측 공간 — gate 선택을 벡터로 표현하는 구조.
- `df-state-model`: FlowInstance의 상태 전이 (pending → active → completed/abandoned).
- `df-serialization`: 좌표, 인스턴스, 서사의 직렬화/역직렬화 계약.
