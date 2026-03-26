---
def:
  id: benchmark-system
  scope: data
  aspect: system_data
  depth: overview
  lifecycle: approved
  svc: weighted-index
  tags: [structural, performance, testing]
  links:
    - target: bench-encode-decode
      type: contains
    - target: bench-cross-index
      type: contains
    - target: bench-range-calc
      type: contains
    - target: bench-browser
      type: contains
    - target: wi-system
      type: depends_on
    - target: wi-pack-format-system
      type: depends_on
---

# 벤치마크 시스템

## 목적 ^purpose

좌표 시스템의 성능 한계를 측정하는 벤치마크. 차원 수, encode/decode, cross-index, 브라우저 실행.

## 구성 ^overview

- `bench-encode-decode`: WeightedIndex encode/decode 처리량과 차원 수 한계 측정.
- `bench-cross-index`: cross-index 종단 좌표 탐사의 응답 시간과 메모리 사용량 측정.
- `bench-range-calc`: calcAddressRanges 범위 연산의 처리량과 BigInt/UUID 직렬화 성능 측정.
- `bench-browser`: 브라우저 환경에서의 좌표 연산 실행 검증.

테스트 환경: Node.js, vitest, Apple Silicon
테스트 파일:
- `packages/weighted-index/src/bench.test.ts` — 좌표 encode/decode, 차원 확장 한계, calcAddressRanges
- `packages/weighted-index/src/bench-cross-index.test.ts` — cross-index 종단 좌표 탐사
- `packages/weighted-index/src/bench-resource.test.ts` — WeightedIndex 메모리, range 캐시 크기
- `packages/weighted-index/src/bench-bigint-uuid.test.ts` — BigInt encode/decode/pack, UUID 직렬화, 레이아웃, 포맷 유틸
- `packages/index-meta/src/bench-info-decode.test.ts` — 정보 디코딩 파이프라인 (MetaCodec)
- `packages/index-meta/src/bench-resource.test.ts` — MetaCodec 메모리, DecodeMap 와이어 크기, cross-index 리소스

## 구성 문서

| 문서 | 내용 |
|---|---|
| [bench-encode-decode.spec.md](bench-encode-decode.spec.md) | WeightedIndex encode/decode 처리량과 차원 수 한계 |
| [bench-cross-index.spec.md](bench-cross-index.spec.md) | cross-index 종단 좌표 탐사의 응답 시간과 메모리 사용량 |
| [bench-range-calc.spec.md](bench-range-calc.spec.md) | calcAddressRanges 범위 연산의 처리량과 BigInt/UUID 직렬화 성능 |
| [bench-browser.spec.md](bench-browser.spec.md) | 브라우저 환경에서의 좌표 연산 실행 검증 |

## 결론 요약

| 관심사 | 안전 범위 | 병목 가능성 |
|---|---|---|
| 좌표 encode/decode | 52차원까지 수백만~수천만 ops/s | 없음 |
| 정보 디코딩 (MetaCodec) | 12차원에서도 ~650ns | 없음 — 차원당 ~40ns 추가 |
| 엔트리 수 증가 | 500개/dim에서도 ~210ns | 없음 — Map O(1) |
| cross-index 종단 | 4레벨 대규모에서 ~400ns | 없음 |
| calcAddressRanges | 연속 제약은 안전 | 비연속 OR은 사전 계산 + containsAddress O(log n)으로 해결 |
| BigInt encode/decode | 8D에서 17M+ ops/s | 없음 — Number 대비 ~2-3x 느리나 절대 성능 충분 |
| BigInt UUID pack | 7.5M+ ops/s (Number보다 빠름) | 없음 — 비트 연산 단일 경로 |
| BigInt clampShape/ViewModel | 480K~3.4M ops/s | 없음 — UI 갱신 빈도(~60fps) 대비 충분 |
| UUID 문자열 변환 | toUUID/fromUUID 라운드트립 ~2.4M ops/s | 없음 |
| UUID 필드 pack/unpack | pack+unpack 라운드트립 ~1.3M ops/s | 없음 |
| 포맷 유틸 | hexBoundary/hexCeil/hexFloor 27~41M ops/s | 없음 |
| WI 인스턴스 메모리 | 52차원에서도 ~4KB | 없음 — 100개 동시 보유 ~106KB |
| MetaCodec 메모리 | 8Dx50에서도 ~94KB | 없음 — entries 수에 비례하나 KB 수준 |
| DecodeMap 와이어 | 3Dx500에서도 ~13KB | 없음 — gzip 시 50~70% 압축 |
| range 캐시 메모리 | 4,608 ranges에서 ~342KB | 없음 — MB 미만 |
