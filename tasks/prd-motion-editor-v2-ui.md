[PRD]
# PRD: Motion Content Editor V2 UI — 프로 에디터급 레이아웃 + 디자인 시스템 + 인라인 편집

## Overview

현재 motion-content-editor는 고정 3-column HTML 레이아웃으로, 공간 활용도가 낮고 값 편집이 불가능하며 디자인 시스템이 없다. After Effects / Premiere / Photoshop 수준의 프로 에디터 UI로 전환한다.

핵심 변화:
- 탭 기반 도킹 패널 + splitter 리사이즈 + localStorage 레이아웃 저장
- 하단 전체 폭 타임라인 (Premiere 스타일)
- CSS custom properties 기반 디자인 토큰 시스템 (다크/라이트)
- 모든 속성 인라인 편집 + layer/sequence CRUD 커맨드

## Goals

- 프로 에디터 수준의 공간 효율과 정보 밀도 달성
- 웹에서 모든 composition 속성을 직접 편집 가능하게
- 디자인 토큰 기반 테마 시스템으로 일관된 시각 언어 확립
- 사용자 레이아웃 커스텀을 localStorage에 저장/복원

## Quality Gates

모든 user story에 대해 다음 명령이 통과해야 한다:

- `pnpm --filter motion-content build`
- `pnpm --filter motion-content-editor build`
- `pnpm --filter @qa-sdk/motion-content-editor-demo build`
- `cd packages/motion-content && npx vitest run`
- `cd packages/motion-content-editor && npx vitest run`

## User Stories

### US-001: 디자인 토큰 시스템 구축

**Description:** 개발자로서, CSS custom properties 기반 디자인 토큰을 정의하여 모든 UI 컴포넌트가 일관된 시각 언어를 사용하게 한다.

**Acceptance Criteria:**
- [x] `design-tokens.ts`에 토큰 정의: 색상(surface/text/accent/border/state), 타이포(font-family/size/weight/line-height), 스페이싱(4px 배수 스케일), 라운딩(sm/md/lg), 섀도우(elevation 3단계)
- [x] 다크 테마와 라이트 테마 두 세트의 토큰 값 정의
- [x] CSS custom properties로 `:root`에 주입하는 `applyMotionEditorTheme(theme)` 함수 제공
- [x] 기본 폰트를 모노스페이스(`"JetBrains Mono", "Fira Code", "SF Mono", monospace`)로 설정
- [x] 기존 `styles.ts`의 인라인 색상/폰트/스페이싱을 토큰 참조(`var(--mce-*)`)로 전환
- [x] 다크 테마가 기본 적용됨

### US-002: 도킹 패널 레이아웃 시스템

**Description:** 사용자로서, 패널을 탭으로 그룹하고 splitter로 영역 크기를 조절할 수 있어야 한다.

**Acceptance Criteria:**
- [x] `panel-layout.ts` 모듈: PanelGroup(탭 기반 패널 컨테이너), Splitter(드래그 리사이즈) 구현
- [x] 기본 레이아웃: 좌측(Properties/Layers/Sequences 탭) | 중앙(Stage) | 우측(Selection Detail/Active State 탭) | 하단(Timeline)
- [x] splitter 드래그로 좌/중앙/우 너비, 하단 높이 조절 가능
- [x] 패널 탭 클릭으로 활성 패널 전환
- [x] 패널 접기(collapse) 버튼으로 영역 최소화 가능
- [x] 최소 너비/높이 제한으로 UI 깨짐 방지
- [x] CSS grid/flexbox 기반, 외부 라이브러리 없음

### US-003: 레이아웃 저장/복원

**Description:** 사용자로서, 내가 조정한 패널 크기와 탭 상태가 다음 접속 시 복원되어야 한다.

**Acceptance Criteria:**
- [x] 패널 크기, 활성 탭, collapse 상태를 localStorage에 저장
- [x] 저장 키: `mce-layout/v1`
- [x] 페이지 로드 시 저장된 레이아웃 복원, 없으면 기본 레이아웃 적용
- [x] "레이아웃 초기화" 버튼으로 기본 상태 복원 가능

### US-004: 하단 전체 폭 타임라인

**Description:** 사용자로서, Premiere처럼 화면 하단 전체 폭을 사용하는 타임라인에서 작업하고 싶다.

**Acceptance Criteria:**
- [x] 타임라인이 스테이지 아래가 아닌 하단 전체 폭 영역으로 이동
- [x] splitter로 타임라인 높이 조절 가능
- [x] 시간 눈금(ruler)이 타임라인 상단에 표시됨
- [x] 현재 재생 시점 표시선(playhead)이 타임라인 전체 높이를 관통
- [x] 기존 타임라인 기능(드래그/리사이즈/선택) 유지

### US-005: 테마 전환 (다크/라이트)

**Description:** 사용자로서, 다크 테마와 라이트 테마를 전환할 수 있어야 한다.

**Acceptance Criteria:**
- [x] 툴바에 테마 토글 버튼 추가
- [x] 토글 시 즉시 전체 UI에 반영 (페이지 새로고침 없음)
- [x] 테마 선택이 localStorage에 저장되어 다음 접속 시 복원
- [x] 스테이지 영역은 테마 영향을 받지 않음 (콘텐츠 프리뷰는 원본 유지)

### US-006: CRUD 커맨드 확장 — Layer 추가/삭제

**Description:** 사용자로서, 에디터에서 직접 새 layer를 추가하거나 기존 layer를 삭제할 수 있어야 한다.

**Acceptance Criteria:**
- [x] `MotionEditorCommand`에 `add-layer`, `remove-layer` 타입 추가
- [x] `add-layer`: id, label, target, content, enter(기본 cue), durationMs를 받아 composition.layers에 추가
- [x] `remove-layer`: layerId를 받아 composition.layers에서 제거 + 관련 sequence.layerIds/layers 슬롯에서도 제거
- [x] `applyMotionEditorCommand`에서 add/remove 처리
- [x] history checkpoint 전략: `add-layer`와 `remove-layer`는 `append`
- [x] Layers 패널에 "+ 추가" 버튼과 각 layer에 "✕ 삭제" 버튼

### US-007: CRUD 커맨드 확장 — Sequence/Caption/Transition 추가/삭제

**Description:** 사용자로서, 에디터에서 sequence, caption, transition을 직접 추가/삭제할 수 있어야 한다.

**Acceptance Criteria:**
- [x] `MotionEditorCommand`에 `add-sequence`, `remove-sequence`, `add-caption`, `remove-caption`, `add-transition`, `remove-transition` 타입 추가
- [x] 각 add 커맨드는 필수 필드를 받아 해당 배열에 추가
- [x] 각 remove 커맨드는 id를 받아 제거 + 참조 정리 (transition의 sequence 참조 등)
- [x] 각 패널에 추가/삭제 버튼

### US-008: 인라인 숫자 편집 (드래그 스크럽)

**Description:** 사용자로서, 숫자 값(timing, duration, offsetMs 등)을 After Effects처럼 드래그로 조절하고 싶다.

**Acceptance Criteria:**
- [x] `scrub-input.ts` 모듈: 숫자 필드에 마우스 좌우 드래그로 값 변경
- [x] Shift 키: 10배 단위, Alt 키: 0.1배 단위
- [x] 더블클릭: 직접 입력 모드 전환
- [x] Selection Detail 패널의 모든 숫자 값에 적용 (startMs, durationMs, offsetMs, zIndex 등)
- [x] 값 변경 시 해당 `MotionEditorCommand` dispatch

### US-009: 인라인 드롭다운/컬러 편집

**Description:** 사용자로서, enum 값(cue kind, content type, transition style, role)은 드롭다운으로, 색상은 컬러 피커로 편집하고 싶다.

**Acceptance Criteria:**
- [x] Selection Detail에서 cue kind 변경 시 드롭다운 (fade/slide-up/slide-left/slide-right/scale-pop)
- [x] content type 변경 시 드롭다운 (dom/image/video/svg/canvas)
- [x] transition style 변경 시 드롭다운 (crossfade/flash/lift)
- [x] slot role 변경 시 드롭다운 (background/content/overlay/accent)
- [x] transition params의 glowColor 편집 시 네이티브 컬러 피커
- [x] Parameter 패널의 color 타입도 네이티브 컬러 피커 사용
- [x] cue preset 참조 변경 시 preset 목록 드롭다운

### US-010: 인라인 텍스트/문자열 편집

**Description:** 사용자로서, label, title, text, id 등 문자열 값을 패널에서 직접 수정하고 싶다.

**Acceptance Criteria:**
- [x] Selection Detail에서 layer label, sequence title, caption text를 클릭하면 인라인 편집 모드
- [x] Enter로 확정, Escape로 취소
- [x] 변경 시 composition에 반영 (set-composition 또는 전용 커맨드)
- [x] 빈 문자열 방지 (최소 1글자)

### US-011: CuePreset 인라인 편집

**Description:** 사용자로서, CuePreset의 kind/durationMs/ease/amount를 패널에서 직접 수정하고, 참조하는 모든 layer에 즉시 반영되게 하고 싶다.

**Acceptance Criteria:**
- [x] CuePresets 섹션에서 preset 클릭 → Selection Detail에 preset 속성 표시
- [x] kind 드롭다운, durationMs 스크럽, ease 텍스트, amount 스크럽 편집 가능
- [x] preset 값 변경 시 composition.cuePresets 교체 → set-composition dispatch
- [x] 참조하는 모든 layer의 실행 결과가 즉시 갱신됨

### US-012: 정보 밀도 + 가독성 최적화

**Description:** 개발자로서, AE/Premiere 수준의 고밀도 레이아웃에서도 텍스트가 잘 읽히도록 타이포그래피와 간격을 최적화한다.

**Acceptance Criteria:**
- [x] 모든 텍스트가 모노스페이스 폰트 사용
- [x] 패널 헤더: 11px bold uppercase, 콘텐츠: 11px regular
- [x] 행 높이: 22px (리스트 아이템), 패딩: 4px 8px
- [x] 숫자 값은 고정 폭 정렬 (tabular-nums)
- [x] 선택 상태: accent border-left 3px + 배경 하이라이트
- [x] 비활성 텍스트: 50% opacity
- [x] 섹션 구분: 1px border-bottom (#333 다크 / #ddd 라이트)

## Functional Requirements

- FR-1: 디자인 토큰은 CSS custom properties(`--mce-*`)로 `:root`에 주입한다
- FR-2: 패널 레이아웃은 CSS grid 기반이며, splitter는 pointer event로 구현한다
- FR-3: 레이아웃 상태(크기/탭/collapse)는 `mce-layout/v1` 키로 localStorage에 저장한다
- FR-4: 타임라인은 하단 전체 폭 영역으로, 상단 영역과 splitter로 분리한다
- FR-5: CRUD 커맨드(add/remove layer/sequence/caption/transition)는 `MotionEditorCommand` 유니온에 추가하고 `applyMotionEditorCommand`에서 처리한다
- FR-6: 숫자 스크럽은 pointer lock 또는 pointermove delta 기반으로 구현한다
- FR-7: 인라인 편집 결과는 즉시 `dispatch()`를 통해 editor session에 반영한다
- FR-8: 테마 전환은 `:root` class 교체(`mce-dark` / `mce-light`)로 구현한다
- FR-9: 스테이지 영역은 `isolation: isolate`로 테마 영향을 차단한다

## Non-Goals

- 패널 드래그 재배치 (V3)
- 플로팅 패널 (undock)
- 키프레임 에디터 (커브)
- 멀티 composition 동시 편집
- 외부 UI 프레임워크 (React/Vue) 사용
- GSAP 외 애니메이션 라이브러리 추가
- motion-content 코어의 데이터 모델 변경 (커맨드 확장 제외)

## Technical Considerations

- 순수 DOM + CSS custom properties + pointer events로 구현
- splitter는 `pointermove` + `setPointerCapture`로 드래그 (기존 timeline drag 패턴 재사용)
- 패널 그룹은 `<div role="tablist">` + `<div role="tabpanel">` 접근성 구조
- 숫자 스크럽은 독립 모듈(`scrub-input.ts`)로 분리, 재사용 가능
- 디자인 토큰은 빌드 타임 생성이 아닌 런타임 CSS variable 주입
- CRUD 커맨드 추가 시 기존 io.ts 검증 로직 영향 없음 (composition 구조는 동일)

## Success Metrics

- 12개 user story 전부 quality gate 통과
- 모든 속성이 브라우저에서 인라인 편집 가능
- 패널 리사이즈/탭 전환/레이아웃 저장이 정상 동작
- 다크/라이트 테마 전환이 즉시 반영

## Open Questions

- 숫자 스크럽에 pointer lock API를 사용할지, 단순 pointermove delta를 사용할지
- CuePreset 편집을 별도 커맨드(update-cue-preset)로 만들지, set-composition으로 통일할지
[/PRD]
