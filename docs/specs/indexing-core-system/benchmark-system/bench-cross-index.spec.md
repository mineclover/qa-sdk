---
def:
  id: bench-cross-index
  address: def_document:v2:343169
  scope: data
  aspect: system_data
  depth: specification
  lifecycle: approved
  layer: domain
  svc: weighted-index
  tags: [performance]
  links:
    - target: cq-relational-engine
      type: depends_on
    - target: resolver-spec
      type: depends_on
---

# 벤치마크 — Cross-index 종단 탐사

## 목적 ^purpose

cross-index 종단 좌표 탐사의 응답 시간과 메모리 사용량 측정.

하위 인덱스 압축값이 상위 인덱스의 차원으로 편입될 때의 종단 decode/encode.

## 구성 ^overview

- **레벨 깊이별 성능**: 2~4레벨 cross-index 종단 encode/decode — 레벨당 ~10ns 추가로 병목 아님
- **대규모 시나리오**: SaaS 권한(1M 공간) 21M ops/s, 4레벨 대규모(5M 공간) 12M ops/s 달성
- **flat vs nested 비교**: 동일 6차원에서 flat 대비 2레벨 ~1.4배, 3레벨 ~1.6배 수준의 오버헤드
- **종단 정보 디코딩**: SaaS 대규모(1M)에서 E2E decode 409ns, E2E encode 335ns
- **리소스 사용량**: 비용 핵심은 entries 배열 크기 — 하위 공간이 클수록 상위 DecodeMap이 커짐
- **zero-alloc 최적화**: 대규모 4레벨에서 zero-alloc 적용 시 decode 12M → 16M ops/s 향상

---

## 1. 레벨 깊이별

| 깊이 | 구조 | 공간 크기 | encode E2E | decode E2E |
|---|---|---|---|---|
| 2레벨 | 3x4 -> 12x5 | 60 | 17M ops/s | 17M ops/s |
| 3레벨 | -> 60x8 | 480 | 5M ops/s | 9M ops/s |
| 4레벨 | -> 480x4 | 1,920 | 5M ops/s | 13M ops/s |

---

## 2. 대규모 시나리오

| 시나리오 | 구조 | decode E2E | decode zero-alloc |
|---|---|---|---|
| SaaS 권한 | 10x20x50 -> 10Kx100 = 1M | 21M ops/s | -- |
| 4레벨 대규모 | 20x50 -> 1Kx10 -> 10Kx100 -> 1Mx5 = 5M | 12M ops/s | **16M ops/s** |

---

## 3. flat vs nested (동일 6차원, 각 5)

| 방식 | encode | decode |
|---|---|---|
| flat | 123M ops/s (8ns) | 21M ops/s (47ns) |
| 2레벨 | 73M ops/s (14ns) | 15M ops/s (65ns) |
| 3레벨 | 55M ops/s (18ns) | 13M ops/s (74ns) |

레벨당 ~10ns 추가. 좌표 수준 cross-index는 병목 아님.

---

## 4. Cross-index 종단 정보 디코딩

| 시나리오 | 단일 decode | E2E decode | E2E encode |
|---|---|---|---|
| 소규모 2레벨 (60) | 153ns | 324ns | 286ns |
| SaaS 대규모 (1M) | 160~188ns | **409ns** | 335ns |

---

## 5. 리소스 사용량

### Cross-index 계층 리소스

SaaS 2레벨 (perm 10x20x50 -> access 10Kx100 = 1M):
- perm DecodeMap: 1.3 KB
- access DecodeMap: 117.5 KB (perm_ref 10,000개가 비용의 대부분)
- 총 힙: ~2.7 MB

**비용의 핵심은 entries 배열 크기.** cross-index에서 하위 인덱스의 size가 상위 entries 수가 되므로, 하위 공간이 클수록 상위 DecodeMap이 커진다.
