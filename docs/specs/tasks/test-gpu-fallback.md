---
def:
  id: task-test-gpu-fallback
  type: knowledge
  knowledge_kind: guide
  tier: component
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: deprecated
  layer: operation
  svc: weighted-gpu
  tags: [testing, performance, task-record]
  links:
    - target: wi-hardware-acceleration
      type: traces_to
sources:
  - docs/specs/weighted-index-system/weighted-gpu.spec.md
---

# weighted-gpu fallback 테스트 (deprecated)

> 대상 패키지 `weighted-gpu` 2026-10-29 삭제 (소비처 0, 제품 surface 미승격 — 핵심 기능 정리 1순위). 구현은 git 이력에서 확인한다.

> GPUEncoder의 device unavailable 경로가 테스트 미검증.

## 목적 ^purpose

weighted-gpu fallback test 보강 task의 완료 위치를 추적한다. 대상 패키지가 삭제되어 이 task 기록은 역사 기록으로만 남는다.

## 우선순위: 🟡 6순위

## 대상

`packages/weighted-gpu/src/index.ts`

| export | 설명 |
|---|---|
| `GPUEncoder.create(shape)` | GPU 초기화 (null if unavailable) |
| `GPUEncoder.isAvailable()` | static 가용성 확인 |
| `encodeBatch()` | GPU 배치 인코딩 |
| `decodeBatch()` | GPU 배치 디코딩 |
| `reduceByKey()` | GPU group-by 집계 |
| `destroy()` | 리소스 해제 |

## 테스트 파일

`packages/weighted-gpu/src/index.test.ts`

## 시나리오

| # | 시나리오 | 설명 |
|---|---|---|
| 1 | isAvailable() 환경 감지 | Node.js(no GPU) → false |
| 2 | create() GPU 없음 → null | graceful null 반환 |
| 3 | API 계약 검증 | 메서드 시그니처 + 타입 확인 |

> WebGPU 환경 없이 실행 가능한 테스트만 포함.
> 실제 GPU 연산 테스트는 브라우저 환경에서 수동 검증.
