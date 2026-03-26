---
def:
  id: bench-browser
  scope: data
  aspect: system_data
  depth: specification
  lifecycle: approved
  svc: weighted-index
  tags: [performance, testing]
  links:
    - target: wi-layout-protocol
      type: depends_on
    - target: browser-monitor-spec
      type: depends_on
---

# 벤치마크 — 브라우저 실행 검증

## 목적 ^purpose

브라우저 환경에서의 좌표 연산 실행 검증. 레이아웃 시뮬레이터 성능.

테스트 파일: `packages/platform-demo/src/pages/layout.ts`
검증 로직: `packages/weighted-index/src/layout-fit.ts` -> `computeLayoutViewModel()`
테스트: `packages/weighted-index/src/layout-fit.test.ts`
접근: `http://localhost:5178/layout` -> 인덱스 순차 진행 패널

## 구성 ^overview

- **테스트 우선 설계**: 모든 수치 계산은 computeLayoutViewModel() 순수 함수에서 수행, UI는 ViewModel을 그대로 렌더링
- **Number/BigInt 이중 모드**: Number 모드는 MAX_SAFE_INTEGER 제한, BigInt 모드는 16^budget UUID 실제 용량 사용
- **정합성 불변식**: 오버플로우 없음, utilization 100% 도달 가능, 라운드트립 보장 등 테스트로 증명
- **시간 예산 배치 처리**: requestAnimationFrame 기반 프레임당 12ms 예산 내 최대 처리 후 자동 중단
- **WeightedIndex 메모리**: 52차원에서도 4KB 미만, 100개 동시 보유 시 약 106KB
- **MetaCodec 메모리**: 3Dx500 구성에서 41KB, 10개 독립 코덱 동시 보유 시 코덱당 약 21KB
- **DecodeMap 와이어 크기**: entry ID 문자열 길이에 비례, gzip으로 50~70% 압축 가능

---

## 1. 설계 원칙: 테스트 우선, UI는 시각화만

모든 수치 계산은 `computeLayoutViewModel()` 순수 함수에서 수행하고,
UI는 리턴된 `LayoutViewModel`을 그대로 렌더링한다.
이 함수의 정합성은 Node.js 단위 테스트(`layout-fit.test.ts`)로 증명한다.

```
┌─────────────────────────────────────────────┐
│  layout-fit.test.ts (Node, vitest)          │
│  — 수학 불변식 증명                           │
│  — 모드별 정합성 검증                         │
│  — encode/decode 라운드트립                   │
└──────────────┬──────────────────────────────┘
               ↓ 증명된 순수 함수
┌─────────────────────────────────────────────┐
│  computeLayoutViewModel()                   │
│  — config + shape + mode -> LayoutViewModel  │
│  — 모든 표시 값, 활용률, dimMax 한 벌 리턴    │
└──────────────┬──────────────────────────────┘
               ↓ 시각화만 담당
┌─────────────────────────────────────────────┐
│  layout.ts (브라우저 UI)                     │
│  — repaint 함수들이 ViewModel만 읽어서 렌더   │
│  — 자체 수치 계산 없음                        │
└─────────────────────────────────────────────┘
```

---

## 2. 모드별 정합성 모델

UI에서 모든 숫자가 동일한 기준점(effective max)을 공유해야 모순이 없다.

**Number 모드** — 기준: `min(16^budget, MAX_SAFE_INTEGER)`

```
effectiveMax = 9.007 x 10^15  (budget=29일 때)
dimMax(i)    = floor(effectiveMax / 나머지곱)
utilization  = product / effectiveMax x 100
              -> 슬라이더를 끝까지 올리면 100% 도달 가능
isCapped     = true  -> "실제 UUID 용량: 10^34.9" 안내 표시
```

**BigInt 모드** — 기준: `16^budget` (UUID 실제 용량)

```
effectiveMax = 16^29 ~ 8.5 x 10^34
dimMax(i)    = 16^budget / 나머지곱 (float 근사)
utilization  = product / 16^budget x 100
              -> 전체 UUID 공간 대비 활용률
isCapped     = false
```

**정합성 불변식** (테스트로 증명):

| 불변식 | 설명 |
|---|---|
| `dims[i].sliderMax x productOfOthers <= effectiveMax` | 오버플로우 없음 |
| Number 모드에서 `utilization == 100%` 도달 가능 | dimMax까지 올리면 |
| BigInt `effectiveMax >= Number effectiveMax` | BigInt가 더 넓은 공간 |
| 동일 shape -> BigInt `utilization <= Number utilization` | 분모가 더 크니까 |
| `simDecode(simEncode(coords)) == coords` | 라운드트립 |

---

## 3. 시간 예산 배치 처리

`requestAnimationFrame` 기반. 프레임당 시간 예산(12ms) 내에서 최대한 처리 후 자동 중단.

```
┌─ 1 frame (16.67ms @60Hz) ──────────────────┐
│                                             │
│  while (elapsed < 12ms && count < cap) {    │
│    simDecode(shape, index)                  │
│    simPackUUID(...)                         │
│    count++                                  │
│    if (count % 64 === 0) check time         │
│  }                                          │
│                                             │
│  남은 ~4ms -> DOM 갱신 + 브라우저 렌더        │
└─────────────────────────────────────────────┘
```

| 조작 | 효과 |
|---|---|
| 스킵 슬라이더 (0~60) | N프레임 건너뛰고 1프레임 연산. 육안 검증용 |
| 상한 슬라이더 (무제한~10M) | 프레임당 처리 상한. 무제한이면 시간 예산만 적용 |

성능 표시: `12.0ms에 4,000개 처리 (333.3K개/초)` — 배치 크기와 속도를 직관적으로 확인.

---

## 4. Node.js 벤치마크와의 대응

| 브라우저 동작 | 대응하는 Node 벤치마크 | 기대 |
|---|---|---|
| `simDecode(shape, index)` | encode/decode 처리량 | 4D 기준 ~30ns, 프레임 예산(16ms) 대비 무시 가능 |
| `simPackUUID(...)` | -- (hex 포매팅) | ~100ns 수준, 병목 아님 |
| 배치 처리량 (12ms 예산) | -- | ~1M+ ops/frame 기대 (연산만, DOM 제외) |
| DOM 테이블 갱신 (50행) | -- | innerHTML 재생성이 주 비용. 스킵으로 조절 |

---

## 5. 리소스 사용량

### WeightedIndex 인스턴스 메모리

| d | dimSize | 이론적 최소 | 실측 | 생성 시간 |
|---|---|---|---|---|
| 2 | 5 | 336 B | < 1 KB | 0.7 us |
| 8 | 5 | 768 B | ~1 KB | 0.5 us |
| 32 | 2 | 2.4 KB | ~2.1 KB | 2.7 us |
| 52 | 2 | 3.8 KB | ~3.1 KB | 1.5 us |

내부 구조: `weights(Float64Array, 8xd)` + `shapeBuf(Float64Array, 8xd)` + `shape(frozen)` + `labels(frozen)`.
52차원에서도 4KB 미만. 100개 동시 보유 시 ~106KB.

### MetaCodec 인스턴스 메모리

| 구성 | 총 entries | 코덱 메모리 | DecodeMap JSON | 생성 시간 |
|---|---|---|---|---|
| 3Dx5 | 15 | 7.9 KB | 398 B | 3 us |
| 3Dx50 | 150 | 37 KB | 1.4 KB | 10 us |
| 3Dx500 | 1,500 | 41 KB | 13 KB | 95 us |
| 8Dx10 | 80 | 32 KB | 1.2 KB | 8 us |
| 8Dx50 | 400 | 94 KB | 3.7 KB | 28 us |
| 12Dx5 | 60 | 29 KB | 1.4 KB | 7 us |

MetaCodec 내부: `DecodeMap(복사)` + `LabelRegistry(Mapx2xd)` + `PrefixCodec` + `WeightedIndex`.
10개 독립 코덱 동시 보유 시 코덱당 ~21KB, 멀티 버전(v1~v5) 시 버전당 ~32KB.

### DecodeMap 와이어 크기 (JSON)

| 구성 | 총 entries | JSON 크기 |
|---|---|---|
| 3Dx20 | 60 | 750 B |
| 3Dx100 | 300 | 2.6 KB |
| 3Dx500 | 1,500 | 13.2 KB |
| 8Dx50 | 400 | 3.7 KB |
| 12Dx5 | 60 | 1.4 KB |

와이어 크기는 entry ID 문자열 길이에 비례. 네트워크 전송 시 gzip으로 50~70% 압축 가능.
