---
def:
  id: rlsc-text-occupancy-todo
  level: leaf
  scope: flow
  aspect: func_def
  depth: specification
  lifecycle: in_progress
  layer: mediation
  svc: rlsc
  tags: [text, measurement, pretext]
  links:
    - target: rlsc
      type: refines
---

# RLSC × pretext 텍스트 점유 분석 — TODO

## 목적 ^purpose

`@chenglou/pretext` 통합으로 RLSC에 텍스트 시각적 공간 점유 측정을 추가한다. 설계 상세: `docs/superpowers/specs/2026-04-06-rlsc-pretext-integration-design.md`

---

## Phase 0: 의존성 + 환경 ✅

- [x] `pnpm --filter rlsc add @chenglou/pretext@0.0.4` — 직접 의존성 추가
- [x] pretext 버전 확인 + tsup 번들에서 정상 import 되는지 빌드 테스트
- [x] `packages/rlsc/tsconfig.json` — pretext 타입 해석 확인

## Phase 1: 타입 확장 (`types.ts`) ✅

- [x] `TextFontInfo` 인터페이스 추가
- [x] `RLSCNode`에 `fontInfo?: TextFontInfo` 필드 추가
- [x] `CollectorOptions`에 `collectFontInfo?: boolean` 추가 (기본 true)
- [x] `TextOccupancy` 인터페이스 추가
- [x] `TextRegionDensity` 인터페이스 추가
- [x] `index.ts` — 새 타입 export 추가

## Phase 2: Collector 확장 (`collector.ts`) ✅

- [x] `extractFontInfo(el, style)` 헬퍼 함수 구현
- [x] `collectNode()` — textContent 있는 노드에 `fontInfo` 부착
- [x] `collectLayoutWithText()` 신규 함수 추가
  - 기존 `collectLayout()` 유지 (시그니처 무파괴)
  - 반환: `{ doc: RLSCDocument, textPrepared: TextPreparedMap }`
  - 내부: `collectNode()` 공유 + `prepareTextMap()` 호출

## Phase 3: 텍스트 점유 분석 (`text-occupancy.ts` 신규) ✅

- [x] `prepareTextMap(doc)` 함수 — 트리 순회 + pretext `prepare()` 호출
- [x] `analyzeTextOccupancy(doc, preparedMap, options?)` 함수
  - content-box 계산, layout/measureLineStats/measureNaturalWidth 호출
  - text-align → textX 위치 계산, margin 4방향, boundaryContact, overflow 판정
- [x] `aggregateTextRegions(doc, occupancies)` 함수 — 영역별 밀도 집계

## Phase 4: 메트릭 통합 (`metrics.ts`) ✅

- [x] `LayoutMetrics`에 텍스트 관련 필드 추가
  - `textDensity?: number` — 전체 가시 영역 대비 텍스트 점유 비율
  - `textBoundaryContactRate?: number` — 경계 접촉 노드 비율
  - `textOverflowCount?: number` — 오버플로우 노드 수
- [x] `measureLayout()` 확장 — TextOccupancy 배열 수용 (optional 파라미터)

## Phase 5: LLM 컨텍스트 통합 (`context.ts`) ✅

- [x] `generateDesignContext()`에 텍스트 점유 섹션 추가 (`textOccupancies` 옵션)
  - 경계 접촉 노드 목록
  - 오버플로우 위험 노드
- [x] `ContextOptions.sections`에 `"text"` 추가

## Phase 6: 적합성 검증 통합 (`intent.ts`) ✅

- [x] 텍스트 관련 ConformanceViolation 규칙
  - `text-overflow`: 텍스트가 컨테이너를 넘침
  - `textDensityRange`: 텍스트 밀도가 허용 범위 밖
- [x] `LayoutPattern`에 텍스트 의도 선언 필드 추가
  - `textDensityRange?: [number, number]` — 허용 밀도 범위

## Phase 7: 반응형 예측 유틸리티 ✅

- [x] `predictTextReflow(prepared, newWidth, lineHeight)` 함수
  - `layout(prepared, newWidth, lineHeight)` 래핑
- [x] `findBreakpointWidth(prepared, targetLineCount, lineHeight, minWidth, maxWidth)` 함수
  - 이진 탐색으로 목표 줄 수가 되는 최소 maxWidth 찾기

## Phase 8: 모니터 통합 (`monitor.ts`) ✅

- [x] `MonitorOptions.trackText` — 텍스트 점유 변화 감지 옵션
  - re-collect 시 `collectLayoutWithText` + `analyzeTextOccupancy` 자동 실행
  - `onTextOccupancyChange` 콜백으로 변화 전달

## Phase 9: index.ts export + 테스트 ✅ (단위) / 🔲 (E2E)

- [x] `index.ts` — 새 함수/타입 전체 export
  - `prepareTextMap`, `analyzeTextOccupancy`, `aggregateTextRegions`, `predictTextReflow`, `findBreakpointWidth`
  - `TextPreparedMap`, `TextOccupancyOptions`, `TextFontInfo`, `TextOccupancy`, `TextRegionDensity`

### 단위 테스트 (Node.js) — pretext mock ✅

- [x] `text-occupancy.test.ts` — 10개 테스트 PASS
  - pretext mock (prepare/layout/measureLineStats/measureNaturalWidth)
  - fillX/fillY/lineCount/margin 산술, overflow, text-align, boundaryContact, aggregateTextRegions
  - predictTextReflow, findBreakpointWidth 이진 탐색

### 통합 테스트 (Playwright) — 실제 Canvas + pretext

- [x] `platform-demo` rlsc 페이지에 Text 탭 추가 (텍스트 점유 시각화)
- [x] E2E: collectLayoutWithText → analyzeTextOccupancy 파이프라인 전체 검증
- [x] 반응형 예측: 같은 prepared에 다른 width → lineCount 변화 검증
