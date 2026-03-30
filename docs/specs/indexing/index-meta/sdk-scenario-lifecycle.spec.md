---
def:
  id: sdk-scenario-lifecycle
  level: leaf
  scope: feature
  aspect: scenario
  depth: validation
  svc: index-meta
  lifecycle: approved
  layer: domain
  tags: [testing]
  links:
    - target: sdk-scenarios
      type: refines
    - target: sdk-system
      type: traces_to
---
# SDK 시나리오 — 소비 라이프사이클

## 목적 ^purpose

MetaRegistryInput 작성 → `createIndexSDK()` → client → constants → encode/decode까지의 전체 소비 라이프사이클이 정확하게 동작함을 검증한다.

## 구성 ^overview

- 스키마 정의 → SDK 생성 → version-pinned client 획득
- constants 자동완성
- encode/decode round-trip
- 예약 토큰 encode 허용
- 결정적 인코딩 보장

## 핵심 시나리오

```text
1. MetaRegistryInput 작성
2. createIndexSDK(input)
3. sdk.client("perm","v1")
4. client.constants("role")
5. client.encode(...)
6. client.decode(...)
```

## 검증 포인트

- 전체 경로 round-trip
- 예약 토큰은 constants에서 제외되지만 encode/decode는 가능
- 같은 입력은 같은 VersionedValue를 생성
- range query 결과가 조건과 일치
