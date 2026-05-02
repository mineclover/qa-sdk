[PRD]
# PRD: Motion Editor Scene-Based Concurrent Editing — 씬 분할 + 동시 편집 + 멀티트랙 재생

## Overview

현재 motion editor는 하나의 composition을 하나의 snapshot으로 관리한다. workspace 전체가 단일 revision으로 잠기므로 동시 편집이 불가능하고, 큰 애니메이션을 시간 단위로 나눠 작업할 수 없다.

이번 단계에서는 **씬(Scene)** 을 도입하여 하나의 캔버스를 시간 구간으로 분할한다.

- 공유 리소스(DOM 타겟, 파라미터, 프리셋, 에셋)는 전체 composition이 소유한다
- 모든 시각 속성과 애니메이션 타이밍은 씬에 귀속된다
- 씬은 글로벌 타임라인 위에 자유 배치되며 겹침을 허용한다 (멀티트랙)
- 씬 간 전환 효과는 없다 — 각 씬은 독립 재생
- 씬 단위 revision으로 동시 편집이 가능하다
- WebSocket으로 실시간 존재감(presence)과 알림을 제공한다
- 어셈블리를 통해 모든 씬을 하나의 GSAP 타임라인으로 병합하여 재생한다

## 핵심 모델 변경

### Layer → Target 분리

```
[기존 MotionLayerDef]                    [v2]
id + target + content + startMs +        공유 타겟: id + target + content (시간 없음)
durationMs + enter + exit                씬 배치: targetId + startMs + durationMs + enter + exit
```

### 씬 모델

```
MotionCompositionDef (v2)
├── targets: MotionTargetDef[]           ← DOM 노드 참조 (공유, 불변)
├── parameters, cuePresets, assets       ← 공유 리소스
└── scenes: MotionSceneDef[]
    └── id, title, startMs, durationMs   ← 글로벌 타임라인 위치 (겹침 허용)
        ├── placements: SceneLayerPlacement[]  ← 타겟 참조 + 씬 내 상대 타이밍
        ├── sequences, captions          ← 씬 내부 구조
        └── (씬 간 전환 없음)
```

### 동시 편집 모델

```
MotionWorkspaceSnapshotV2
├── resources: { targets, params, presets, assets }  ← 충돌 없음 (불변 참조)
├── scenes: Map<sceneId, { ...scene, revision }>     ← 씬별 독립 revision
├── globalRevision                                    ← 구조 변경 (씬 추가/삭제)
└── WebSocket: presence + scene lock + 변경 알림
```

## Approved Package Changes

| 패키지 | 변경 |
|--------|------|
| `motion-content` | composition v2 타입, v1↔v2 변환, 씬 커맨드, 어셈블리 |
| `motion-workspace` | 씬 단위 controller, 씬별 revision |
| `motion-workspace-client` | 씬 API, WebSocket client |
| `@qa-sdk/motion-workspace-service` | 씬 endpoints, WS hub, 씬별 저장 |
| `motion-content-editor` | 멀티씬 타임라인, 씬 패널, presence UI |
| `@qa-sdk/motion-content-editor-demo` | 씬 편집 흐름, 동시 접속 |
| `@qa-sdk/cli` | 씬 관리 커맨드 |

## Goals

- 하나의 캔버스를 시간 구간(씬)으로 나눠 독립 작업 후 합친다
- 씬 단위 동시 편집으로 여러 사용자가 같은 workspace에서 작업한다
- 공유 리소스(DOM 타겟)는 구조적으로 충돌이 없다
- 기존 v1 composition과 호환된다 (어셈블리 → v1 평탄화)
- 각 브라우저에서 독립적으로 전체/개별 씬을 재생한다

## Non-Goals

- 같은 씬 내 동시 편집 (씬 단위 잠금으로 충분)
- 씬 간 전환 효과 (crossfade, flash 등)
- 공유 리소스 속성 동시 수정 (속성은 씬에 귀속)
- OT/CRDT 기반 실시간 병합
- 비디오 렌더 파이프라인

## Quality Gates

모든 user story에 대해 다음 명령이 통과해야 한다:

- `pnpm --filter motion-content build`
- `pnpm --filter motion-content-editor build`
- `pnpm --filter motion-workspace build`
- `pnpm --filter motion-workspace-client build`
- `pnpm --filter @qa-sdk/motion-workspace-service build`
- `pnpm --filter @qa-sdk/cli build`
- `pnpm --filter @qa-sdk/motion-content-editor-demo build`
- `cd packages/motion-content && npx vitest run`
- `cd packages/motion-content-editor && npx vitest run`
- `cd packages/motion-workspace && npx vitest run`
- `cd packages/motion-workspace-client && npx vitest run`
- `cd packages/motion-workspace-service && npx vitest run`
- `cd packages/cli && npx vitest run`

UI story에 대해서는 추가로:

- `motion-content-editor-demo` preview에서 브라우저로 직접 검증

## User Stories

### Phase 1: Composition v2 스키마 + 변환

#### US-001: composition v2 target/scene 스키마 정의

**Description:** 개발자로서, layer의 정체성/콘텐츠와 시간/애니메이션을 분리한 v2 스키마가 필요하다.

**Acceptance Criteria:**
- [x] `MotionTargetDef`가 정의된다 (id, target, content — 타이밍 없음)
- [x] `MotionSceneDef`가 정의된다 (id, title, startMs, durationMs)
- [x] `SceneLayerPlacement`가 정의된다 (targetId, startMs, durationMs, enter, exit — 씬 내 상대좌표)
- [x] 씬 내부에 sequences, captions이 포함된다
- [x] `MotionCompositionDefV2`가 targets[] + scenes[]를 포함한다
- [x] 씬 겹침이 스키마 수준에서 허용된다 (startMs 제약 없음)

#### US-002: composition v2 IO (parse/validate/serialize)

**Description:** 개발자로서, v2 composition을 안전하게 파싱하고 검증할 수 있어야 한다.

**Acceptance Criteria:**
- [x] v2 composition parse/serialize/validate API가 추가된다
- [x] targetId 참조 무결성이 검증된다 (placement.targetId → targets[].id)
- [x] 씬 내 sequence/caption referential integrity가 검증된다
- [x] 잘못된 스키마에 대한 에러 테스트가 추가된다

#### US-003: v1 → v2 마이그레이션 + v2 → v1 어셈블리

**Description:** 개발자로서, 기존 v1 문서를 v2로 업그레이드하고, v2를 v1으로 평탄화하여 기존 GSAP 플레이어와 호환할 수 있어야 한다.

**Acceptance Criteria:**
- [x] `migrateCompositionV1toV2`가 추가된다: layer → target 분리, 단일 "main" 씬 생성
- [x] `assembleComposition`이 추가된다: v2 scenes → v1 flat composition (기존 플레이어 호환)
- [x] 어셈블리가 겹치는 씬의 레이어를 글로벌 절대 좌표로 변환한다
- [x] v1 → v2 → assemble → v1 라운드트립 테스트가 추가된다
- [x] 기존 v1 프리셋(createPromoGridComposition)에 대한 호환성 테스트가 추가된다

### Phase 2: 씬 편집

#### US-004: 씬 CRUD 커맨드 추가

**Description:** 개발자로서, 씬을 추가/삭제/수정하는 커맨드가 필요하다.

**Acceptance Criteria:**
- [x] `add-scene`, `remove-scene`, `update-scene-timing` 커맨드가 추가된다
- [x] `rename-scene` 커맨드가 추가된다
- [x] 씬 삭제 시 씬 내 placements/sequences/captions이 함께 제거된다
- [x] 커맨드 적용 + undo/redo 테스트가 추가된다

#### US-005: 씬 내 placement CRUD 커맨드 추가

**Description:** 개발자로서, 씬 내에서 타겟 배치를 추가/삭제/수정하는 커맨드가 필요하다.

**Acceptance Criteria:**
- [x] `add-scene-placement`, `remove-scene-placement` 커맨드가 추가된다
- [x] `update-scene-placement-timing`, `update-scene-placement-cue` 커맨드가 추가된다
- [x] 공유 타겟 풀에서 타겟을 선택하여 씬에 배치하는 흐름이 지원된다
- [x] placement 커맨드 테스트가 추가된다

#### US-006: 씬 단위 editor session + undo/redo

**Description:** 개발자로서, 씬별 독립 undo/redo 스택이 필요하다.

**Acceptance Criteria:**
- [x] 씬별 `MotionEditorSession`이 관리된다
- [x] 씬 A에서 undo해도 씬 B의 히스토리에 영향 없다
- [x] 씬 전환 시 해당 씬의 session이 복원된다
- [x] 씬별 dirty 상태가 개별 추적된다

### Phase 3: 씬 단위 저장 + 동시성

#### US-007: workspace v2 씬별 revision 스키마

**Description:** 개발자로서, 씬별 독립 revision을 가진 workspace snapshot v2가 필요하다.

**Acceptance Criteria:**
- [x] `MotionWorkspaceSnapshotV2`가 씬별 revision을 포함한다
- [x] globalRevision은 구조 변경(씬 추가/삭제)에만 증가한다
- [x] 씬 내용 변경은 해당 씬 revision만 증가시킨다
- [x] workspace v1 → v2 마이그레이션이 추가된다

#### US-008: repository 씬 단위 저장 + conflict

**Description:** 개발자로서, 씬 단위로 저장하고 충돌을 감지하는 repository가 필요하다.

**Acceptance Criteria:**
- [x] `saveScene(workspaceId, sceneId, sceneData, expectedRevision)` API가 추가된다
- [x] 씬별 `WHERE revision = ?` 가드가 적용된다
- [x] 다른 씬 저장은 서로 충돌하지 않는다 (테스트 증명)
- [x] 씬 conflict error shape가 sceneId를 포함한다

#### US-009: service 씬 단위 endpoint 추가

**Description:** 개발자로서, 씬을 개별적으로 읽고 저장하는 HTTP endpoint가 필요하다.

**Acceptance Criteria:**
- [x] `GET /workspaces/:id/scenes` — 씬 목록
- [x] `GET /workspaces/:id/scenes/:sceneId` — 개별 씬
- [x] `PUT /workspaces/:id/scenes/:sceneId` — 씬 저장 (revision guard)
- [x] `POST /workspaces/:id/scenes` — 씬 추가
- [x] `DELETE /workspaces/:id/scenes/:sceneId` — 씬 삭제
- [x] 씬 conflict 409 응답 테스트가 추가된다

#### US-010: client 씬 API 추가

**Description:** 개발자로서, typed client가 씬 단위 CRUD를 지원해야 한다.

**Acceptance Criteria:**
- [x] client에 `listScenes`, `getScene`, `updateScene`, `createScene`, `deleteScene` 메서드가 추가된다
- [x] 씬 conflict error를 감지하는 helper가 추가된다
- [x] 씬 API 테스트가 추가된다

### Phase 4: 실시간 동기화 (WebSocket)

#### US-011: workspace service WS hub 구축

**Description:** 개발자로서, workspace당 WebSocket 연결을 관리하는 hub가 필요하다.

**Acceptance Criteria:**
- [x] workspace service에 `ws://host/workspaces/:id/ws` endpoint가 추가된다
- [x] 연결별 userId + workspaceId가 관리된다
- [x] hub가 같은 workspace의 모든 연결에 broadcast할 수 있다
- [x] 연결 해제 시 자동 정리된다

#### US-012: 씬 lock/unlock 프로토콜

**Description:** 개발자로서, 씬 편집 시작/종료를 다른 클라이언트에 알리는 soft lock이 필요하다.

**Acceptance Criteria:**
- [x] `scene:lock { sceneId, userId }` 메시지가 정의된다
- [x] `scene:unlock { sceneId, userId }` 메시지가 정의된다
- [x] 같은 씬에 lock이 있으면 경고를 표시한다 (hard block은 아님)
- [x] 연결 끊김 시 lock이 자동 해제된다
- [x] lock/unlock 프로토콜 테스트가 추가된다

#### US-013: presence + 변경 알림

**Description:** 사용자로서, 누가 어떤 씬을 편집 중인지 보고, 다른 사람이 저장하면 알림을 받아야 한다.

**Acceptance Criteria:**
- [x] `presence { userId, activeSceneId?, cursor? }` 메시지가 정의된다
- [x] `scene:updated { sceneId, revision }` 알림이 저장 시 broadcast된다
- [x] `resource:updated { revision }` 알림이 공유 리소스 변경 시 broadcast된다
- [x] 클라이언트가 알림 수신 시 해당 씬/리소스를 pull할 수 있다

#### US-014: client WebSocket 통합

**Description:** 개발자로서, typed client가 WebSocket 연결 + 메시지 수신/발신을 지원해야 한다.

**Acceptance Criteria:**
- [x] client에 `connectWorkspace(workspaceId, handlers)` 메서드가 추가된다
- [x] auto-reconnect + exponential backoff가 구현된다
- [x] `lockScene`, `unlockScene`, `sendPresence` 메서드가 추가된다
- [x] WS 메시지 수신 핸들러 인터페이스가 정의된다

### Phase 5: Editor UI

#### US-015: 멀티씬 타임라인 뷰

**Description:** 사용자로서, 여러 씬을 트랙 형태로 보고 씬 단위로 타이밍을 조정할 수 있어야 한다.

**Acceptance Criteria:**
- [x] 타임라인에 씬 트랙이 표시된다 (글로벌 시간축 위 블록)
- [x] 씬 블록을 드래그하여 startMs/durationMs를 조정할 수 있다
- [x] 겹치는 씬이 시각적으로 구분된다
- [x] 씬 클릭으로 해당 씬 편집 모드에 진입한다

#### US-016: 씬 편집 패널 + 포커스 모드

**Description:** 사용자로서, 특정 씬을 선택하면 해당 씬의 placements/sequences/captions만 편집할 수 있어야 한다.

**Acceptance Criteria:**
- [x] 씬 목록 패널이 추가된다 (추가/삭제/이름변경)
- [x] 씬 선택 시 타임라인이 해당 씬 내부 뷰로 전환된다
- [x] 씬 포커스 모드에서는 해당 씬의 placement만 표시된다
- [x] 공유 타겟 풀에서 씬에 타겟을 배치하는 UI가 추가된다

#### US-017: presence UI + 씬 lock 표시

**Description:** 사용자로서, 다른 사용자가 어떤 씬을 편집 중인지 볼 수 있어야 한다.

**Acceptance Criteria:**
- [x] 씬 블록/패널에 편집 중인 사용자 아바타/이름이 표시된다
- [x] 다른 사용자가 lock한 씬은 시각적으로 구분된다 (배경색, 아이콘 등)
- [x] 사용자 접속/해제 시 UI가 실시간 갱신된다
- [x] 브라우저 QA로 2개 탭 동시 접속 시나리오를 검증한다

#### US-018: 어셈블리 미리보기 (전체 재생)

**Description:** 사용자로서, 모든 씬을 합쳐서 전체 애니메이션을 미리볼 수 있어야 한다.

**Acceptance Criteria:**
- [x] "전체 재생" 모드가 추가된다 (모든 씬 → v1 어셈블리 → GSAP 플레이어)
- [x] 개별 씬 미리보기도 가능하다 (해당 씬만 v1 변환 → 재생)
- [x] 겹치는 씬의 레이어가 동시에 재생된다
- [x] 어셈블리 결과를 v1 JSON으로 export할 수 있다

### Phase 6: CLI + 마이그레이션

#### US-019: CLI 씬 관리 커맨드

**Description:** 개발자로서, 터미널에서 씬을 조회/추가/삭제할 수 있어야 한다.

**Acceptance Criteria:**
- [x] `qa-sdk motion scene list --workspace <id>` 가 추가된다
- [x] `qa-sdk motion scene show --workspace <id> --scene <id>` 가 추가된다
- [x] `qa-sdk motion scene create --workspace <id>` 가 추가된다
- [x] `qa-sdk motion scene delete --workspace <id> --scene <id>` 가 추가된다
- [x] CLI 테스트가 추가된다

#### US-020: 기존 workspace를 씬 기반으로 마이그레이션

**Description:** 사용자로서, 기존 v1 workspace를 v2 씬 기반으로 자동 업그레이드해야 한다.

**Acceptance Criteria:**
- [x] workspace 로드 시 v1 snapshot이 v2로 자동 마이그레이션된다
- [x] 기존 composition은 단일 "main" 씬으로 변환된다
- [x] 마이그레이션 후 기존 편집/재생 동작이 유지된다
- [x] 마이그레이션 라운드트립 테스트가 추가된다
- [x] CLI에서 v1 export가 여전히 가능하다 (어셈블리 경유)

## Success Metrics

- 두 사용자가 같은 workspace의 다른 씬을 동시에 편집하고 저장할 수 있다
- 씬 A 저장이 씬 B 편집자에게 conflict를 유발하지 않는다
- 모든 씬을 합친 전체 재생이 기존 GSAP 플레이어와 동일하게 동작한다
- 기존 v1 workspace가 무손실로 v2로 업그레이드된다
- v2 workspace를 v1 composition으로 export하면 기존 도구와 호환된다
[/PRD]
