---
def:
  id: weighted-gpu-spec
  level: leaf
  tier: component
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: domain
  svc: weighted-gpu
  tags: [runtime, performance, experimental]
  links:
    - target: wi-system
      type: refines
    - target: wi-hardware-acceleration
      type: depends_on
---
# Weighted GPU

## 목적 ^purpose

`weighted-index` 연산을 WebGPU compute shader로 가속하는 실험 패키지. batch encode/decode/reduce 경로를 GPU로 오프로드한다.

## 구성 ^overview

- `GPUEncoder` public API
- benchmark harness
- GPU 미지원 시 fallback/null 경로
- encode/decode/reduce 배치 가속 실험

## 관련 소스

- `packages/weighted-gpu/src/index.ts`
- `packages/weighted-gpu/src/bench.ts`
- `packages/weighted-gpu/src/index.test.ts`
