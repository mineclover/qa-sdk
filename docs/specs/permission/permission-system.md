---
def:
  id: permission-system
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: approved
  tags: [security, entry-point]
  links:
    - target: permission-model
      type: contains
    - target: permission-encoding
      type: contains
    - target: permission-constraint
      type: contains
---
# 권한 엔진 시스템

## 목적 ^purpose

닫힌 권한 공간을 bitmask로 압축하고, 계층 상속과 외부 컨텍스트를 분리하는 권한 엔진. role → flat permission mask → scope 기반 해소 경로.

## 구성 ^overview

3개 정의: 권한 모델(PermissionSet/TernaryMask/ScopedEngine), 인코딩(WeightedIndex/BitIndex/IndexBridge), 제약 규칙(리소스 형식/permission code/인코딩 선택).
