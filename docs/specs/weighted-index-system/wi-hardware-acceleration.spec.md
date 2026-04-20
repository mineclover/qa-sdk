---
def:
  id: wi-hardware-acceleration
  type: knowledge
  knowledge_kind: concept
  tier: component
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: domain
  svc: weighted-index
  tags: [runtime, performance]
  links:
    - target: wi-system
      type: depends_on
---

# 하드웨어 가속 — WASM / GPU / FPGA

## 목적 ^purpose

WeightedIndex 연산(encode/decode/bitmask)에 대한 하드웨어 가속 구현 현황, 성능 기준, 적용 전략을 정의한다.

## 구현 현황 ^defines

### weighted-wasm (Rust -> WASM 20KB)

- `encode_batch` / `decode_batch` (u32, tight loop) — G-1
- `popcountWasm`, `maskAndWasm`, `maskOrWasm`, `masksOverlapWasm` (u64 단위) — G-4
- 7 Rust tests, JS fallback 래퍼 포함
- 벤치마크 (G-5): `weighted-wasm/js/bench.ts` — batch 1K/10K/100K encode/decode/popcount/maskAnd

### weighted-gpu (WebGPU WGSL)

- `encode.wgsl`, `decode.wgsl`, `reduce.wgsl` — 3 compute shaders — G-2
- `GPUEncoder` 클래스, GPU 미지원 시 null 반환
- 벤치마크 (G-6): `weighted-gpu/src/bench.ts` — batch 10K/100K encode/decode/reduce

## CPU 성능 기준 (Node.js, Apple Silicon)

| 연산 | 4D (100) | 8D (172K) | 32D (4.3B) |
|------|----------|-----------|------------|
| encode | 138M ops/s (7ns) | 73M ops/s (14ns) | 24M ops/s (41ns) |
| decode | 49M ops/s (20ns) | 16M ops/s (62ns) | 8.6M ops/s (116ns) |
| matchRanges | 6M ops/s (162ns) | 2.3K ops/s (426us) | — |

## 적용 전략

```
단건 연산 (< 1us): CPU 단독 최적 (전송 오버헤드 > 연산)
배치 > 1K건:       GPU 전송 비용 상쇄 시작
배치 > 10K건:      GPU compute shader 우위
스트리밍 연속:      FPGA 파이프라인 우위 (전송 오버헤드 없음)
```

### 경로별 배치

| 경로 | 전략 |
|------|------|
| write (ingestion) | CPU resolver -> GPU/FPGA batch encode -> CPU store |
| read (query) | CPU resolver -> GPU/FPGA batch decode -> CPU cache |
| hot (permission check) | CPU 단독 (단건 7ns, GPU 전송 비용 > 연산) |
| cold (batch aggregation) | GPU group-by reduction -> materialized view |

## 잔여

- G-3: FPGA 인터페이스 설계 (FPGAAdapter + threshold 기반 CPU/FPGA 분기) — 우선순위 낮
