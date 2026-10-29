---
def:
  id: weighted-gpu-spec
  tier: component
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: deprecated
  layer: domain
  svc: weighted-gpu
  tags: [runtime, performance, experimental]
  links:
    - target: wi-system
      type: refines
    - target: wi-hardware-acceleration
      type: depends_on
sources:
  - scripts/package-surfaces.mjs
---
# Weighted GPU (deprecated — 패키지 삭제됨)

> 2026-10-29 삭제 (소비처 0, 제품 surface 미승격 — 핵심 기능 정리 1순위). 구현은 git 이력에서 확인한다.

## 목적 ^purpose

`weighted-index` 연산을 WebGPU compute shader로 가속하는 실험 패키지. batch encode/decode/reduceByKey 경로를 GPU로 오프로드한다.

`quarantine-candidates` / `no-promotion` 대기열에 있다가 실제 consumer나 성능 승격 근거가 생기지 않아 삭제했다. GPU 가속이 다시 필요해지면 C baseline benchmark에서 병목이 확인된 뒤 새 spec으로 시작한다.

## 구성 ^overview

- `GPUEncoder` public API
- benchmark harness
- GPU 미지원 시 fallback/null 경로
- encode/decode/reduceByKey 배치 가속 실험

## 관련 소스

- (삭제됨) `packages/weighted-gpu/` — git 이력 참고
