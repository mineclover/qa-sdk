---
def:
  id: weighted-gpu-spec
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
sources:
  - packages/weighted-gpu/src/index.ts
  - packages/weighted-gpu/src/index.test.ts
  - packages/weighted-gpu/src/bench.ts
  - packages/weighted-gpu/src/shaders/encode.wgsl
  - packages/weighted-gpu/src/shaders/decode.wgsl
  - packages/weighted-gpu/src/shaders/reduce.wgsl
  - packages/weighted-gpu/package.json
  - scripts/package-surfaces.mjs
---
# Weighted GPU

## 목적 ^purpose

`weighted-index` 연산을 WebGPU compute shader로 가속하는 실험 패키지. batch encode/decode/reduceByKey 경로를 GPU로 오프로드한다.

현재 surface 판정은 `scripts/package-surfaces.mjs`의 `quarantine-candidates` / `no-promotion`이다. 따라서 이 문서는 구현과 테스트가 존재하는 실험 패키지 계약을 source-back하며, 제품 코어 승격 근거로 해석하지 않는다.

## 구성 ^overview

- `GPUEncoder` public API
- benchmark harness
- GPU 미지원 시 fallback/null 경로
- encode/decode/reduceByKey 배치 가속 실험

## 관련 소스

- `packages/weighted-gpu/src/index.ts`
- `packages/weighted-gpu/src/bench.ts`
- `packages/weighted-gpu/src/index.test.ts`
