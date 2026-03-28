---
def:
  id: registry-version-lifecycle
  address: def_document:v1:1609
  scope: state
  aspect: domain_state
  depth: specification
  lifecycle: approved
  layer: domain
  svc: registry-service
  tags: [tier-infra]
  links:
    - target: registry-data-model
      type: depends_on
---
# Registry 버전 라이프사이클

## 목적 ^purpose

prefix 버전의 상태 전이 규칙. draft → locked → released → active → deprecated 5단계 라이프사이클과 각 전이의 전제 조건.

## 상태 전이 ^state-def

```
draft → locked      전제: capacity, entries 확정
locked → released   전제: readiness gate 통과 (stride 계산 완료)
released → active   전제: 배포 완료, 이전 active → deprecated
active → deprecated 전제: 신규 active 존재
```

## 제약 ^constraint

- draft에서만 capacity/entries 변경 가능
- locked 이후 capacity 변경 불가 (stride 안정성)
- active는 prefix당 최대 1개
- deprecated → active 역전이 불가 (새 버전으로만)
