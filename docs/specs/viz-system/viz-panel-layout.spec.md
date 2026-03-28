---
def:
  id: viz-panel-layout
  address: def_document:v2:129
  scope: ui
  aspect: layout
  depth: specification
  lifecycle: approved
  layer: experience
  svc: platform-demo
  tags: [tier-frontend]
  links:
    - target: viz-panels-spec
      type: refines
---

# Viz 패널 레이아웃

## 목적 ^purpose

viz-web의 scenario selector, event log, verdict panel을 하나의 보조 패널 시스템으로 배치하는 레이아웃 규칙을 정리한다.

## 구성 ^overview

platform-demo의 각 페이지가 공통 레이아웃 패턴(nav + sidebar + main + panel)을 따른다. 시나리오 선택기, 이벤트 로그, verdict 패널이 독립 스크롤 영역으로 분리되어 있으며, 공용 네비게이션 바가 페이지 간 이동을 담당한다.

## 공통 레이아웃 구조

```
┌──────────────────────────────────────────────────┐
│ #nav (36px)                                       │
│ ┌────┬──────────────────────────────────┬───────┐ │
│ │Brand│ Demo │ Monitor │ Diagram │ ...  │       │ │
│ └────┴──────────────────────────────────┴───────┘ │
├──────────────────────────────────────────────────┤
│ ┌──────────┬──────────────────────┬────────────┐ │
│ │ Sidebar  │      Main Content    │   Panel    │ │
│ │ (280~     │                      │ (440px~    │ │
│ │  340px)   │                      │  520px)    │ │
│ │           │                      │            │ │
│ │ 독립 스크롤│    독립 스크롤        │ 독립 스크롤 │ │
│ └──────────┴──────────────────────┴────────────┘ │
└──────────────────────────────────────────────────┘
```

## 네비게이션 바 — #nav

- 높이: 36px 고정
- 배경: `--bg2` (#161b22)
- 하단 border: `--border` (#30363d)
- 항목: Brand → Demo, Monitor, Diagram, Dashboard, Events, Insights, Flow, Debugger
- 활성 링크: 페이지별 하이라이트 색상 (green, mint)

## 시나리오 선택기 (Sidebar)

### diagram.html

- 너비: 280px 고정
- 헤더: 검색 필터 + 카운트 배지
- 본문: 카테고리별 트리 뷰 (prefix, service, DSL, observation)
- 선택 시 메인 영역의 다이어그램 갱신

### flow.html

- 너비: 340px 고정
- 헤더: 시나리오 정보 (ID, 상태, 진행률)
- 본문: 시나리오 step 목록 (체크리스트)
- 피드 영역: SSE 실시간 이벤트 스트림 (min-height 140px, max-height 260px)

### events.html

- 본문: trace/session 그룹별 이벤트 카드 목록
- 필터: 서비스, prefix, session, 시간 범위

## 이벤트 로그 (Main Content)

### events.html 이벤트 카드

- trace 카드: 서비스명, 시간, entry, flow 시퀀스, prefix 태그, session ID
- 선택 시 우측 패널에 상세 표시
- session 그룹핑: 같은 `qa_session_id` 끼리 묶어 표시

### flow.html 타임라인

- SSE 스트림에서 실시간 이벤트 수신
- 시간순 세로 스크롤
- 일시정지/재개 토글 버튼

## Verdict 패널 (Side Panel)

### events.html 상세 패널

- 너비: 440px
- 헤더: trace ID + 닫기 버튼 (sticky)
- trace 요약: 서비스, 시간 범위, record 수
- record 목록: event_key, 타입(log/span), 타임스탬프
- payload 표시: JSON pre-wrap (max-height 120px)
- address_context: prefix별 디코드 결과 표시

### insights.html

- summary 카드 그리드 (4열): 핵심 수치 (기록 수, prefix 수 등)
- 바 차트: prefix별 사용 빈도
- coverage donut: 서비스별 prefix 커버리지
- correlation 카드: Jaccard 기반 공출현 분석
- label 액션: confirmed/rejected/investigating 라벨링

## 통합 제약

- 세 패널(sidebar, main, panel)은 독립 스크롤 경계를 가진다
- 패널 간 정보 전달은 JavaScript 상태를 통해 이뤄지며, 직접 DOM 결합은 피한다
- 패널은 `display: none` / `.open` 클래스로 토글 — CSS 전환
- 다크 테마 통일: `--bg` (#0d1117), `--bg2` (#161b22), `--border` (#30363d)
- 폰트: 본문은 시스템 sans-serif, 코드/수치는 monospace (SF Mono / Cascadia Code)
- 모바일 미지원 — 데스크톱 전용 대시보드

## 페이지별 그리드

| 페이지 | Sidebar | Main | Panel |
|--------|---------|------|-------|
| diagram.html | 280px | flex:1 | 없음 |
| events.html | 없음 | flex:1 | 440px (토글) |
| flow.html | 340px | flex:1 | 없음 |
| monitor.html | 없음 | canvas 전체 | HUD 오버레이 |
| insights.html | 없음 | 전체 (max-width 1200px) | 없음 |
| rlsc.html | 없음 | canvas (grid) | 520px (탭) |
