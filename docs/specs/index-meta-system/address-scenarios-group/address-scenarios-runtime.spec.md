---
def:
  tier: component
  id: address-scenarios-runtime
  address: def_document:v2:70018
  scope: feature
  aspect: scenario
  depth: validation
  lifecycle: approved
  layer: domain
  svc: index-meta
  tags: [testing]
  links:
    - target: address-spec
      type: traces_to
    - target: address-scenarios-group
      type: refines
sources:
  - packages/index-meta/src/address-protocol-manager.ts
  - packages/index-meta/src/address-protocol-manager.test.ts
  - packages/index-meta/src/meta-registry.ts
---

# Address 시나리오 - 런타임 프로토콜 관리

## 목적 ^purpose

런타임 프로토콜 lifecycle 관리와 schema-only consumer 시나리오를 정리해 주소 체계가 완전한 직렬화 없이도 소비되는 경로를 설명한다.

## 상태

implemented

## 기능 경계

| 기능 | 소유 API | 검증 범위 |
|------|----------|-----------|
| protocol registry | `register()` / `unregister()` / `registeredProtocols` | 런타임 protocol 추가, 동일 이름 교체, 제거 후 default/write/read/fallback 정리를 수행한다. schema registry를 변경하지 않는다. |
| negotiation | `negotiate(clientCapabilities, serverPreferences)` | 서버 우선순위에서 클라이언트도 지원하고 manager에 등록된 첫 protocol을 선택한다. 공통 protocol이 없으면 `NegotiationError`다. |
| write/read 전환 | `setWriteProtocol()` / `addReadProtocol()` / `removeReadProtocol()` | 새 address는 write protocol로 발행하고, 전환 기간에는 복수 read protocol을 허용한다. 제거된 read protocol 입력은 parse 실패한다. |
| fallback chain | `setFallbackChain()` / `getFallbackStats()` | 명시한 protocol 순서대로 parse를 시도하고 protocol별 attempted/succeeded 통계를 기록한다. fallback chain은 readProtocols보다 우선한다. |
| schema-only consumer | `MetaRegistry` 조회 API / `createCodec()` | address 설정 없이도 dim/index/version 조회와 codec encode/decode를 수행한다. address 설정이 있어도 조회 결과는 변하지 않는다. |

## 시나리오 맵

- §18-1: partner/custom protocol을 runtime에 등록해 serialize/parse하고, unregister 후에는 해당 protocol 사용이 실패한다.
- §18-2: client/server protocol 협상은 서버 선호 순서를 따른다. 공통 등록 protocol이 없으면 명시적으로 실패한다.
- §18-3: write protocol과 read protocol을 분리해 v4 입력을 읽으면서 v7로 새 address를 발행하고, 전환 완료 후 v4 읽기를 차단한다.
- §18-4: fallback chain은 protocol mismatch를 순차 parse로 흡수하고 성공/실패 통계를 남긴다.
- §19: schema-only registry consumer는 address 설정 없이 스키마 조회와 codec encode/decode를 수행한다. origin에서 serialize/parse한 VersionedValue도 edge codec에서 decode할 수 있다.

## 통합 포인트

- 외부 시스템 통합은 parse 경계(`address-scenarios-parse`)에서 VersionedValue를 얻은 뒤, runtime protocol 운영 경계에서 format migration과 fallback을 관리한다.
- protocol lifecycle은 address format compatibility의 문제이고, schema registry/capacity ownership 문제로 확장하지 않는다.
- schema-only consumer는 직렬화 없이 registry read model과 codec만 소비하므로 protocol runtime과 섞이지 않는다.
