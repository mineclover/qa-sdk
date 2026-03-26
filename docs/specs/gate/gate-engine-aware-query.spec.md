---
def:
  id: gate-engine-aware-query
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  svc: gate-service
  tags: [security, tier-infra]
  links:
    - target: gate-engine-group
      type: member_of
    - target: gate-engine-core
      type: depends_on
---
# Gate-Aware Query

## 목적 ^purpose

gate-aware-query — 정책 해소 결과에 gate 상태를 합성하여 최종 허용 범위를 결정하는 질의 레이어.

## 구성 ^overview

- **gateFilterRanges**: 주소 범위에서 gate 차단 범위를 제거하여 유효 범위만 반환
- **3가지 모드**: encodable(active+open), decodable(active+inactive), active(active만)
- **정책 합성 흐름**: resolvePolicy() → gateFilterRanges() → 교집합 = 최종 허용 범위
- **Fail-open**: gate check 실패 시 허용 + warning diagnostic (gate-service는 읽기 전용 캐시)

---

## gateFilterRanges

주소 범위에서 gate 차단 범위를 제거하여 유효 범위만 반환한다.

### 모드

| mode | 반환 범위 | 용도 |
|------|----------|------|
| encodable | active + open | 인코딩 가능한 주소 |
| decodable | active + inactive | 디코딩 가능한 주소 |
| active | active만 | 현재 사용 중인 주소 |

### 정책 합성

1. `resolvePolicy()`로 정책 해소 → 허용 주소 범위
2. `gateFilterRanges()`로 gate 상태 합성 → 유효 주소 범위
3. 교집합 = 최종 허용 범위

```
정책 허용 범위:    [0..31]
gate 차단 범위:    [8..15] (inactive), [24..31] (reserved)
최종 encodable:    [0..7] ∪ [16..23]
```

### gate-service 관계

- gate-service = 읽기 전용 캐시. GateEngine 인스턴스 없음
- query-service = gate-service HTTP 클라이언트로 gate 상태 소비
- Fail-open: gate check 실패 → 허용 + warning diagnostic
