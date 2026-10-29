---
def:
  id: weighted-index-system
  type: spec
  tier: system
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  layer: domain
  svc: weighted
  tags: [structural, entry-point, performance]
  links:
    - target: wi-system
      type: contains
    - target: wi-hardware-acceleration
      type: refs
    - target: weighted-wasm-spec
      type: refs
    - target: weighted-gpu-spec
      type: refs
    - target: weighted-index-explorer-spec
      type: refs
    - target: system-packages
      type: refs
sources:
  - docs/specs/weighted-index-system/wi-system.md
  - docs/specs/weighted-index-system/wi-math.spec.md
  - docs/specs/weighted-index-system/wi-api.spec.md
  - docs/specs/weighted-index-system/wi-hardware-acceleration.spec.md
  - docs/specs/weighted-index-system/weighted-wasm.spec.md
  - docs/specs/weighted-index-system/weighted-gpu.spec.md
  - docs/specs/weighted-index-system/weighted-index-explorer.spec.md
  - docs/specs/system/system-packages.spec.md
  - scripts/package-surfaces.mjs
  - packages/weighted-index/package.json
  - packages/weighted-index/src/index.ts
  - packages/weighted-index/src/math/weighted-index.ts
  - packages/weighted-index/src/math/weighted-index.test.ts
  - packages/weighted-wasm/package.json
  - packages/weighted-wasm/js/index.ts
  - packages/weighted-wasm/js/index.test.ts
  - packages/weighted-index-explorer/package.json
  - packages/weighted-index-explorer/scripts/static-smoke.test.mjs
---
# Weighted Index System

## 목적 ^purpose

WeightedIndex 기반 좌표 압축의 코어 수학, public API, 하드웨어 가속 실험, 데모/탐색 UI를 한곳에서 찾기 위한 system entry 문서다. 실제 ownership은 `wi-system`과 하위 스펙이 나눠 갖고, 이 문서는 package surface와 검증 경로를 라우팅한다.

## 구성 ^overview

- `wi-system`: mixed-radix encode/decode, vocab, protocol, partial binder, range query를 묶는 코어 레이아웃.
- `wi-hardware-acceleration`: WASM/GPU 가속 구현 현황과 적용 기준.
- `weighted-wasm-spec`: Rust/WASM batch encode/decode 및 bitmask 가속 패키지 계약.
- `weighted-gpu-spec`: (deprecated) WebGPU 실험 패키지 — 2026-10-29 삭제.
- `weighted-index-explorer-spec`: weighted-index 개념을 시각화하는 브라우저 데모 consumer.

## 검증 ^validation

```bash
corepack pnpm --filter weighted-index test
corepack pnpm --filter weighted-index build
corepack pnpm --filter weighted-wasm test:js
corepack pnpm --filter weighted-index-explorer test
corepack pnpm def:check
corepack pnpm arch:feedback
```
