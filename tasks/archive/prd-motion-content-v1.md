[PRD]
# PRD: Motion Content V1 — GSAP 기반 선언형 모션 콘텐츠 편집기

## Overview

`motion-content`는 Remotion식 개념층을 참고하되 런타임은 GSAP으로만 실행하는 선언형 모션 시스템이다.
현재 모노레포에는 다음 세 패키지가 존재한다.

- `packages/motion-content`
  모션 SSOT 모델, JSON 입출력, editor command/state/history, GSAP runtime
- `packages/motion-content-editor`
  DOM 기반 편집기 셸, 타임라인 lane, scrubber, import/export, debug panel
- `packages/motion-content-editor-demo`
  브라우저에서 바로 검증 가능한 얇은 소비 앱

이번 V1의 목적은 “작동하는 데모”를 넘어서, 다른 앱이 붙일 수 있는 표준 편집기/런타임 계약을 닫는 것이다.

## Goals

- JSON 직렬화 가능한 `MotionCompositionDef`를 V1 편집 포맷으로 고정
- GSAP runtime transport를 표준 제어 API로 정리
- layer / sequence / caption / transition 편집을 같은 command 모델로 통합
- 디버깅과 검증을 위한 snapshot / diagnostics 표면 확보
- 데모 앱에서 preset, 파일 import/export, 브라우저 검증 루프를 완성
- V1 범위의 문서와 테스트를 마련해 라이브러리화 준비를 끝냄

## Concept Glossary

### 핵심 모델

- `Composition`
  하나의 모션 문서. duration, parameters, assets, layers, sequences, captions, transitions의 SSOT
- `Parameter`
  템플릿 치환과 스타일 조정을 위한 런타임 입력값
- `Asset`
  stage DOM에 투영되는 text/style 바인딩 항목
- `Layer`
  개별 DOM 타깃의 cue 단위 애니메이션
- `Sequence`
  레이어와 캡션을 묶는 장면 윈도우
- `Transition`
  두 sequence 사이의 감정 곡선과 시간 겹침
- `Caption`
  시간축에 따라 노출되는 자막 cue

### 실행 계층

- `Runtime`
  GSAP timeline으로 composition을 실행하는 계층
- `Transport`
  play, pause, restart, seek, loop, playbackRate 같은 재생 제어 API
- `Stage Adapter`
  composition asset과 layer가 실제 DOM 노드에 투영되는 계약

### 편집 계층

- `Editor State`
  selection, viewport, transport, active lane 정보를 가진 편집 상태
- `Editor Command`
  parameter 수정, timeline 이동, JSON 교체를 표현하는 단일 command 모델
- `Editor Session`
  undo/redo를 포함한 present/past/future 히스토리 래퍼
- `Debug Snapshot`
  현재 시간 기준 active sequence/layer/caption과 resolved asset 상태

## Package Composition

### `motion-content`

- V1 편집 포맷과 validation 책임
- runtime / state / history / io를 모두 제공
- 브라우저 UI와 무관한 순수 계약 계층

### `motion-content-editor`

- DOM 셸, 타임라인 lane, toolbar, panels, devtools 제공
- `motion-content` command/state를 소비하는 thin UI 계층

### `motion-content-editor-demo`

- preset 선택, import/export, 브라우저 검증용 샌드박스
- V1 acceptance QA의 기준 소비처

## V1 Done Definition

- 편집 포맷이 문서화되고 JSON import/export가 안정적이다
- transport/runtime API가 명시적이고 stage adapter 계약이 정리된다
- timeline에서 layer/sequence/caption/transition 편집이 일관되게 동작한다
- editor session이 drag preview와 checkpoint를 올바르게 다룬다
- debug/devtools가 현재 active 상태와 property diff를 보여준다
- demo 앱에서 preset 전환, 파일 로드/저장, 브라우저 검증이 가능하다
- 코어와 편집기 경로에 대한 자동 테스트가 존재한다

## Quality Gates

모든 user story에 대해 다음 명령이 통과해야 한다.

- `pnpm --filter motion-content build`
- `pnpm --filter motion-content-editor build`
- `pnpm --filter @qa-sdk/motion-content-editor-demo build`

UI가 포함된 story는 추가로 다음을 확인한다.

- `http://127.0.0.1:4176/` 에서 브라우저 수동 검증

## User Stories

### MC-001: V1 개념 용어집 + 패키지 계약 문서화

**Description:** 개발자로서, Composition/Sequence/Layer/Transition/Caption/Transport/DebugSnapshot의 의미와 패키지 경계를 문서에서 바로 이해할 수 있어야 한다.

**Acceptance Criteria:**
- V1 개념 용어집이 문서에 정리된다
- `motion-content`, `motion-content-editor`, `motion-content-editor-demo`의 책임 경계가 문서화된다
- V1 Done Definition과 비목표(non-goal)가 문서에 포함된다

### MC-002: Composition JSON 포맷 V1 고정

**Description:** 개발자로서, JSON 파일 하나만으로 composition을 저장하고 다시 불러올 수 있어야 한다.

**Acceptance Criteria:**
- `MotionCompositionDef` V1 직렬화 포맷이 고정된다
- parse validation이 필수 필드와 shape 오류를 구체 메시지로 반환한다
- import/export 예제가 문서와 demo에서 동일 포맷을 사용한다

### MC-003: Asset / Stage Adapter 계약 표준화

**Description:** 개발자로서, asset과 layer가 selector 수준을 넘어 stage adapter 계약으로 연결되도록 표준화하고 싶다.

**Acceptance Criteria:**
- asset target과 layer target의 V1 표준 규칙이 정리된다
- stage adapter가 필요한 입력과 책임 범위가 문서와 타입으로 명시된다
- demo stage가 해당 계약을 따라 동작한다

### MC-004: Runtime / Transport 표면 안정화

**Description:** 개발자로서, play/pause/seek/restart/loop/playbackRate와 snapshot 조회를 안정적인 런타임 계약으로 사용하고 싶다.

**Acceptance Criteria:**
- runtime transport API와 snapshot API가 문서화된다
- GSAP player가 transport 상태와 동기화된다
- runtime 재생 제어가 demo에서 확인 가능하다

### MC-005: Editor Session / History / Checkpoint 정리

**Description:** 개발자로서, 편집 중 selection이나 drag preview가 undo stack을 오염시키지 않게 하고 싶다.

**Acceptance Criteria:**
- selection은 undo stack에 쌓이지 않는다
- drag는 preview와 commit이 분리된다
- import/set-composition 시 checkpoint가 예측 가능하게 생성된다
- dirty state 또는 checkpoint 전략이 문서화된다

### MC-006: Timeline 편집 UX 마감

**Description:** 사용자로서, layer / sequence / caption / transition을 같은 타임라인 모델로 선택, 이동, resize할 수 있어야 한다.

**Acceptance Criteria:**
- layer / sequence / caption / transition lane이 모두 렌더링된다
- 각 lane의 move/resize 제약이 일관된다
- transition duration 편집이 시퀀스 경계와 모순되지 않는다
- scrubber와 selection이 타임라인 편집 후에도 동기화된다

### MC-007: Devtools / Diagnostics 강화

**Description:** 개발자로서, 현재 composition이 왜 그렇게 보이는지 active cue와 resolved property 기준으로 추적하고 싶다.

**Acceptance Criteria:**
- active sequence/layer/caption 정보가 panel에서 확인된다
- resolved asset 또는 property diff를 노출한다
- import 실패나 validation 실패가 UI에서 즉시 보인다
- frame/drop 또는 timing 진단의 최소 표면이 정의된다

### MC-008: Demo 앱 워크플로우 완성

**Description:** 사용자로서, preset 전환과 파일 로드/저장을 포함한 V1 편집 흐름을 demo 앱 하나에서 끝낼 수 있어야 한다.

**Acceptance Criteria:**
- demo 앱에서 preset을 전환할 수 있다
- JSON 파일 업로드와 다운로드가 동작한다
- 마지막 composition이나 선택 preset을 로컬에 유지할 수 있다
- 브라우저 수동 검증 시나리오가 문서화된다

### MC-009: Core 자동 테스트 추가

**Description:** 개발자로서, 모델/IO/state/history/runtime이 회귀 없이 유지되길 원한다.

**Acceptance Criteria:**
- model/io/state/history/runtime 핵심 경로 테스트가 추가된다
- transport와 parse validation의 경계 케이스가 포함된다
- quality gate 명령이 통과한다

### MC-010: Editor 자동 테스트 추가

**Description:** 개발자로서, timeline command와 import/export UI 흐름이 회귀 없이 유지되길 원한다.

**Acceptance Criteria:**
- editor shell의 command 흐름 테스트가 추가된다
- timeline lane 편집과 import error 노출을 검증한다
- demo 소비 경로가 빌드로 검증된다
