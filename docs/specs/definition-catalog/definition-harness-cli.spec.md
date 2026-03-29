---
def:
  id: definition-harness-cli
  level: leaf
  scope: interface
  aspect: cli_contract
  depth: specification
  lifecycle: draft
  layer: mediation
  svc: definition-service
  tags: [tier-system]
  links:
    - target: definition-harness
      type: refines
    - target: definition-state-model
      type: depends_on
---
# Harness CLI — 상태 조회/전이/리포트

## 목적 ^purpose

CLI에서 문서/시스템의 상태 분포를 조회하고, 전이를 실행하고, 리포트를 출력한다. `def state` 서브커맨드로 통합.

## CLI 인터페이스 ^api-surface

```bash
# 전체 상태 분포 (4개 머신)
qa-sdk def state

# 특정 머신의 분포
qa-sdk def state doc-lifecycle
qa-sdk def state spec-impl
qa-sdk def state convention-compliance
qa-sdk def state db-sync

# 특정 문서의 상태 조회
qa-sdk def state <문서ID>

# 가능한 전이 조회
qa-sdk def state <문서ID> --transitions
```

## 출력 형식

```
=== doc-lifecycle ===
draft(13) review(0) approved(480) deprecated(63) archived(0)

=== spec-impl ===
designed(5) implementing(2) implemented(3) verified(1) source-referenced(489)

=== convention-compliance ===
unverified(490) partial(3) compliant(2) violated(0)
```
