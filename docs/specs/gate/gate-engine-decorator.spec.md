---
def:
  id: gate-engine-decorator
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
# GateEngine Decorator 패턴

## 목적 ^purpose

GateEngine Decorator 패턴. DimStateSpec을 외부에서 주입하여 gate 상태 계산을 확장.

## 구성 ^overview

- **DimStateSpec**: dim별 inactive/open 좌표 목록을 담는 값 객체로, 외부에서 GateEngine에 주입
- **순수 변환**: GateEngine은 상태 출처를 모르며 DimStateSpec → AddressStateCacheRecord 변환만 수행
- **확장 소스**: EntryFlagStore, 운영 설정, prefix_ref 전파 등에서 DimStateSpec을 생성
- **불변식**: 같은 DimStateSpec은 항상 같은 결과를 보장하며, Decorator는 생성만 담당하고 recompute에 개입하지 않는다

---

## DimStateSpec 주입

GateEngine은 dim별 상태를 외부에서 주입받아 recompute에 사용한다.

### 구조

```typescript
type DimStateSpec = Record<string, {
  inactive: number[];  // 비활성 좌표 목록
  open: number[];      // 열린 좌표 목록
}>;
```

### Decorator 확장 패턴

외부 소스(EntryFlagStore, 운영 설정 등)에서 DimStateSpec을 구성하여 GateEngine에 전달한다.
GateEngine 자체는 상태의 출처를 알지 않는다 — 순수하게 DimStateSpec → AddressStateCacheRecord 변환만 수행.

### 확장 사례

| 소스 | DimStateSpec 생성 방식 |
|------|----------------------|
| EntryFlagStore | flag=inactive인 entry의 position 수집 |
| 운영 설정 | 특정 dim의 좌표를 수동 비활성화 |
| prefix_ref 전파 | 참조 대상의 상태를 참조자의 DimStateSpec에 반영 |

### 불변식

- DimStateSpec은 값 객체 — GateEngine이 수정하지 않는다
- 같은 DimStateSpec → 항상 같은 AddressStateCacheRecord (순수성)
- Decorator는 DimStateSpec 생성만 담당, recompute 로직에 개입하지 않는다
