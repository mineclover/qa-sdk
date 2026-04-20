---
def:
  id: sdk-scenario-multi-service
  tier: system
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
    - target: resolver-spec
      type: traces_to
---
# SDK 시나리오 — 멀티 서비스 스키마 공유

## 목적 ^purpose

프론트엔드, 백엔드, 분석 서비스가 동일 스키마를 독립적으로 소비하면서도 `VersionedValue`와 DecodeMap을 통해 같은 의미를 공유함을 검증한다.

## 구성 ^overview

- FE → BE round-trip
- DecodeMap만으로 독립 decode
- constants와 문자열 직접 입력의 동등성
- 혼재 버전 라우팅

## 검증 포인트

- FE encode 결과를 BE decode가 그대로 복원
- SDK 없이 MetaCodec + DecodeMap만으로 decode 가능
- 버전 혼재 환경에서도 versionId 기반 라우팅으로 정확한 decode 보장
