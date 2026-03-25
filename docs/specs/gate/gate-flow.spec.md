---
def:
  id: gate-flow
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: approved
  links:
    - target: gate-api
      type: refines
    - target: gate-engine-func
      type: refines
---
# Gate 운영 흐름

> encode/recompute/query 경로별 gate 상태 확인과 전파 순서. ^purpose

## 흐름 1: encode 경로 ^overview

```
클라이언트 → encode 요청
  → checkGate(prefix, version, address)
  → state = active? → 허용
  → state = open?   → 허용 (shouldVerify=true)
  → state = inactive/reserved? → 차단 + 진단 코드 반환
```

## 흐름 2: 상태 변경 전파

```
release/setFlag 이벤트 발생
  → recompute(prefix, version) 트리거
  → DimStateSpec 재생성
  → AddressStateCacheRecord 갱신
  → composite 참조 그래프 탐색
  → cascadeRecompute → 상위 prefix도 갱신
  → 캐시 무효화 알림 (미구현: MQ 경로)
```

## 흐름 3: query 경로

```
query-service → gateFilterRanges(prefix, version, ranges, mode)
  → gate 차단 범위 제거
  → 유효 범위만 반환
```
