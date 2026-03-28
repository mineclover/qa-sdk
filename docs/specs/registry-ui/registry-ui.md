---
def:
  id: registry-ui
  address: def_document:v2:68643
  scope: feature
  aspect: func_def
  depth: overview
  lifecycle: approved
  svc: registry-ui
  tags: [experience, frontend, registry]
---
# registry-ui

## 목적 ^purpose

registry-service 웹 UI. 좌표계의 축(Axis), prefix, DSL을 시각적으로 탐색·구성할 수 있는 프론트엔드 애플리케이션.

## 구성 ^overview

- **3개 탭 페이지**: Glossary (용어/축 탐색), Prefix Builder (prefix 구성), DSL Builder (DSL 구조 편집)
- **store.ts**: 상태 관리 (registry-service API 연동)
- **Vite 빌드**: SPA, 정적 배포 가능
- registry-service `/api/*` 엔드포인트를 소비하여 카탈로그 데이터 표시

## 설계 결정 ^intent

- Vanilla TS + DOM API — 프레임워크 의존 없이 경량 구현
- 탭 기반 지연 렌더링 — 선택된 페이지만 렌더
- registry-service가 SSOT, UI는 읽기 전용 뷰어 + 구성 도구
