---
def:
  id: scaffold-system
  type: spec
  tier: layout
  owner_system: scaffold
  scope: interface
  aspect: cli_contract
  depth: overview
  lifecycle: approved
  layer: operation
  svc: scaffold
  tags: [scaffold, architecture, codegen, contract, structural]
  links:
    - target: system-packages
      type: refines
    - target: scaffold-domain-schematic
      type: refs
    - target: scaffold-domain-development-convention
      type: refs
    - target: scaffold-template-catalog
      type: refs
    - target: scaffold-architecture-validator
      type: refs
    - target: scaffold-governance-metadata
      type: refs
    - target: scaffold-openmetadata-storage
      type: refs
    - target: scaffold-cache-key-dsl
      type: refs
sources:
  - packages/architecture-schematics/package.json
  - packages/architecture-schematics/src/index.ts
---

# scaffold system

## 목적 ^purpose

`@qa-sdk/scaffold`는 Domain Slice Architecture를 빠르게 코드 구조로 물질화하는 스캐폴딩 도구다. 이 구조는 사내 도메인 계층, CQRS read/write 분리, adapter boundary, transaction/logging ports, optional BFF surface, Nest module assembly, OpenAPI fragment, 데이터 거버넌스 메타데이터 표준을 하나의 생성 단위로 묶는다.

## 구성 ^overview

- `scaffold-domain-schematic`: `nest g @qa-sdk/scaffold:domain`으로 bounded context/domain slice의 기본 파일과 Nest module wiring을 생성한다.
- `scaffold-domain-development-convention`: Domain Slice Architecture 코드 레이어를 책임 토폴로지에 매핑하는 개발 컨벤션을 정의한다.
- `scaffold-template-catalog`: 생성 템플릿을 표준 문법 카탈로그로 노출해 학습/리뷰 기준으로 사용한다.
- `scaffold-architecture-validator`: 생성 코드나 기존 코드가 계층 import, transaction/logging port, BFF/read-model metadata, OpenAPI entity exposure 규칙을 위반하는지 검사한다.
- `scaffold-governance-metadata`: OpenMetadata 기반 데이터 자산/계보/품질 메타데이터를 스캐폴딩 대상 표준으로 정의한다.
- `scaffold-openmetadata-storage`: OpenMetadata seed manifest의 저장 방식과 SSOT 경계를 정의한다.
- `scaffold-cache-key-dsl`: cache key prefix를 DSL로 관리하고 `prefix:version:id...` concrete key를 생성/검증한다.

## 입력 표준

- `/Users/junwoobang/document/아키텍처/도메인 계층 구조 및 모듈 설계 표준.md`: aggregate boundary, domain/application/infrastructure/presentation 디렉터리, alias/deep path, read model 규칙.
- `/Users/junwoobang/document/아키텍처/데이터 거버넌스 및 메타데이터 관리 전략.md`: OpenMetadata service/entity mapping, lineage, domain owner/team, glossary, active metadata injection, data quality/profiler 규칙.

## 책임 경계

- 이 패키지는 표준 구조를 생성하고 기본 규칙을 검사한다.
- 실제 비즈니스 aggregate 경계 판단, glossary 용어 승인, OpenMetadata 운영 API 호출은 소비 프로젝트/배포 파이프라인의 책임이다.
- 템플릿 변경은 architecture standard 변경으로 간주하며, catalog와 validator 테스트를 함께 갱신해야 한다.
