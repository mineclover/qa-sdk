---
def:
  id: quality-gates-system
  level: unit
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: approved
  layer: operation
  svc: qa-sdk-cli
  tags: [testing, entry-point]
  links:
    - target: harness-state-model
      type: contains
    - target: work-domain-quality-bundle
      type: contains
---
# Quality Gates System

## 목적 ^purpose

실행 가능한 품질 게이트 문서를 개념 번들 단위로 묶고, 하네스를 유한 상태 모델(`concept-defined → contract-bound → gate-bound → verified`)로 읽게 하는 루트 그룹. `verified`는 문서 존재가 아니라 gate 실행 원장(`quality-ledger`)으로 판정한다.

## 구성 ^overview

현재 샘플은 `work-domain-quality-bundle` 하나를 포함한다.
각 번들은 인터페이스 계약 문서와 단일 gate 문서들을 함께 가진다.
