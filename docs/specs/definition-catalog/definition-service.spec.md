---
def:
  id: definition-service
  type: spec
  level: module
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: approved
  layer: operation
  svc: definition-service
  links:
    - target: definition-catalog-spec
      type: depends_on
---

# Definition Service — 문서 카탈로그 API 서비스

## 목적 ^purpose

`definition-catalog`가 정의한 메타데이터 모델을 SQLite 및 API로 제공하여 CLI, 웹 UI, 타 서비스들이 문서 정보를 조회하고 검증할 수 있게 하는 백엔드 서비스.

## 구성 ^overview

- **Docs Module**: 문서 단건 조회, 본문 조회, 검색 제공
- **Graph Module**: 문서 간 링크 분석, 바운더리 해석, 영향 범위 역추적
- **Ingest Module**: CLI가 동기화한 데이터를 DB에 반영
- **Core Database**: `definition-service.sqlite` 스키마 및 트랜잭션 관리
