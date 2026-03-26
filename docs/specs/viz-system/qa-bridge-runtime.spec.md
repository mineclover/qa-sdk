---
def:
  id: qa-bridge-runtime
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: approved
  tags: [tier-frontend]
  links:
    - target: qa-bridge-spec
      type: refines
---

# QA Bridge 런타임

## 목적 ^purpose

roleplay-web의 사용자 폼 상호작용을 QA 이벤트로 변환하고 템플릿 렌더링과 오케스트레이션에 연결하는 런타임 계약을 정리한다.

## 구성 ^overview

QA Bridge는 motion-content의 이벤트 시스템과 browser-sdk의 전송 계층을 연결한다. 에디터 세션 내 사용자 액션을 `MotionEventLog` 으로 로컬 기록하고, 필요 시 QaMonitor를 통해 ingest 경로로 전달한다.

## 이벤트 변환 경로

```
사용자 폼 상호작용
  │
  ├── 에디터 커맨드 (set-parameter, update-item-timing 등)
  │     │
  │     └── MotionEditorCommand → applyMotionEditorCommand()
  │           └── EditorState 갱신
  │
  ├── transport 제어 (play, pause, seek, restart)
  │     │
  │     └── MotionPlayer API 호출
  │           └── GSAP timeline 제어
  │
  └── 이벤트 로그 기록
        │
        └── MotionEventLog.append()
              └── 로컬 세션 기록 (event-log.ts)
```

## 도메인 액션 정의

motion-content는 4가지 액션 카테고리를 정의한다:

### transport 액션
`play`, `pause`, `seek`, `restart`, `complete`, `set_loop`, `set_rate`

### 편집 액션
`select`, `edit_timing`, `edit_parameter`, `undo`, `redo`

### 타임라인 액션
`drag_start`, `drag_commit`

### 컴포지션 라이프사이클 액션
`import`, `export`, `preset_switch`

## 서비스 메타데이터

```typescript
const MOTION_EDITOR_SERVICE = {
  serviceId: "motion-content-editor",
  name: "모션 콘텐츠 편집기",
  description: "GSAP 기반 선언형 모션 콘텐츠 편집기",
};

const MOTION_DEMO_SERVICE = {
  serviceId: "motion-content-editor-demo",
  name: "모션 편집기 데모",
  description: "motion-content-editor의 브라우저 검증 앱",
};
```

## 템플릿 렌더링 연동

`applyMotionTemplate(template, values)` 가 `{{paramId}}` 패턴을 파라미터 값으로 치환한다.

- 텍스트 자산: `"{{headline}}"` → `"GSAP Motion Canvas"`
- 스타일 자산: `"{{accent}}"` → `"#f08f20"`
- MotionStageAdapter가 `data-motion-id` 로 DOM 타겟을 해석

## QaMonitor 통합 (선택적)

motion-content 자체는 전역 좌표계에 참여하지 않는다 (`ownedPrefixes` 없음). 다만 호스팅 앱이 QaMonitor를 가지고 있으면:

1. 에디터 액션을 `monitor.emit()` 로 전송 가능
2. `emitWithCoords()` 로 좌표 컨텍스트 부여 가능
3. 이는 호스팅 앱의 책임이며, motion-content 라이브러리 자체는 순수

## EventEmitter 패턴

폼 컴포넌트와 QA 기록 계층 사이의 결합은 느슨하다:

- 폼 컴포넌트 → EditorCommand 발행 → state 갱신
- state 갱신 → 이벤트 로그 기록 (로컬)
- 이벤트 로그 → QaMonitor 전송 (선택적, 호스팅 앱 책임)
- 이 구조에서 폼 컴포넌트는 QaMonitor의 존재를 모른다
