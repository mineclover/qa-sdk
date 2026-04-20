---
def:
  id: weighted-wasm-spec
  level: leaf
  tier: component
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: domain
  svc: weighted-wasm
  tags: [runtime, performance, experimental]
  links:
    - target: wi-system
      type: refines
    - target: wi-hardware-acceleration
      type: depends_on
---
# Weighted WASM

## 목적 ^purpose

`weighted-index`와 bitmask 연산을 Rust + WASM으로 가속하는 패키지. JS wrapper가 WASM 로딩과 fallback을 담당한다.

## 구성 ^overview

- JS wrapper / public API
- Rust/WASM 코어
- benchmark harness
- wasm-pack 산출물 관리

## 관련 소스

- `packages/weighted-wasm/js/index.ts`
- `packages/weighted-wasm/js/bench.ts`
- `packages/weighted-wasm/src/lib.rs`
