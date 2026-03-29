---
def:
  id: docs-explorer
  address: def_document:v2:68629
  scope: feature
  aspect: func_def
  depth: overview
  lifecycle: approved
  svc: docs-explorer
  tags: [planned, experience, frontend, definition]
  links:
    - target: definition-service-system
      type: depends_on
---
# docs-explorer

## 목적 ^purpose

definition-catalog 기반 문서 탐색기 웹 UI. 좌표 분류(scope/aspect/depth)로 문서를 필터링하고, 문서 간 링크 그래프를 시각적으로 탐색한다.

## 구성 ^overview

- **SPA 구조**: Vite 빌드, index.html 진입점
- **export-data.mjs**: definition-catalog에서 문서 데이터를 정적 JSON으로 추출
- **definition-catalog 의존**: 문서 스캔 결과를 빌드 시 static data로 변환
- definition-service API 또는 정적 데이터 기반으로 문서 목록·상세·그래프 표시

## 설계 결정 ^intent

- 빌드 시 데이터 추출 — 서버 없이 정적 배포 가능 (오프라인 탐색)
- definition-service 연동 시 실시간 데이터 사용 가능 (온라인 모드)
- 문서 좌표 시스템의 소비자 — scope/aspect/depth/lifecycle 필터 제공
