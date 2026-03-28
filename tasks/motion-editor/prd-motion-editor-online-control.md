[PRD]
# PRD: Motion Editor Online Control Surface — 코드 API + 온라인 저장 + CLI

## Overview

현재 motion-content 스택은 composition 문서는 코어 JSON envelope로 관리하지만, editor layout/theme/document 저장은 shell/demo 쪽 localStorage에 흩어져 있다. 이 상태로는 코드 API, 브라우저 에디터, CLI가 같은 작업 상태를 공유하기 어렵다.

이번 단계에서는 motion editor를 **온라인 에디터**로 재정의한다.

- composition document는 계속 portable JSON으로 유지한다
- 문서/워크스페이스 저장은 원격 API와 온라인 workspace를 기준으로 한다
- layout/theme 같은 **UI preference**만 로컬에 남긴다
- 브라우저 셸과 CLI는 동일한 headless workspace/controller API를 사용한다

## Approved Package Split

- `motion-content`: composition/runtime core 유지
- `motion-workspace`: workspace schema, IO, migration, headless controller
- `motion-workspace-client`: typed HTTP client
- `@qa-sdk/motion-workspace-service`: 온라인 workspace service
- `motion-content-editor`: DOM shell + local prefs
- `@qa-sdk/motion-content-editor-demo`: online editor demo / preview

## Goals

- 코드 API, 브라우저 에디터, CLI가 같은 workspace 모델을 읽고 쓴다
- composition export/import는 기존 V1 envelope와 호환된다
- document 저장은 localStorage가 아니라 온라인 workspace API가 담당한다
- CLI에서 workspace 조회/적용/preview orchestration이 가능하다

## Non-Goals

- 멀티 유저 실시간 동시 편집
- 권한 체계/조직/공유 링크 UX
- 비디오 렌더 파이프라인
- layout/theme preference까지 서버 동기화

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
- `cd packages/cli && npx vitest run`

UI story에 대해서는 추가로:

- `motion-content-editor-demo` preview에서 브라우저로 직접 검증

## User Stories

### US-001: workspace snapshot schema 정의

**Description:** 개발자로서, portable composition 문서와 온라인 workspace 상태를 분리한 schema가 필요하다.

**Acceptance Criteria:**
- [ ] `MotionCompositionDocumentV1`는 기존 `qa-sdk.motion-composition/v1` envelope를 유지한다
- [ ] `MotionWorkspaceSnapshotV1` 또는 동등 계약이 document, source metadata, revision, editor-local preference boundary를 표현한다
- [ ] composition document와 workspace snapshot의 책임 차이가 문서화된다

### US-002: workspace IO parse/serialize/validate 추가

**Description:** 개발자로서, workspace snapshot을 어느 런타임에서나 일관되게 다룰 수 있는 IO helper가 필요하다.

**Acceptance Criteria:**
- [ ] workspace parse/serialize/validate API가 추가된다
- [ ] 잘못된 schemaVersion과 누락 필드에 대한 테스트가 추가된다
- [ ] composition document parser와 workspace parser가 분리된 entrypoint를 가진다

### US-003: workspace migration helper 추가

**Description:** 개발자로서, legacy 또는 future schema를 업그레이드할 migration helper가 필요하다.

**Acceptance Criteria:**
- [ ] workspace migrate API가 추가된다
- [ ] revision conflict 또는 unknown schemaVersion 입력에 대한 오류 shape가 정의된다
- [ ] migration 단위 테스트가 추가된다

### US-004: headless workspace controller 기본 API 추가

**Description:** 개발자로서, 브라우저와 CLI가 DOM 없이 workspace를 열고 저장할 수 있는 headless controller가 필요하다.

**Acceptance Criteria:**
- [ ] `MotionWorkspaceController` 또는 동등 API가 추가된다
- [ ] controller가 workspace load/save/export entrypoint를 제공한다
- [ ] controller가 `MotionEditorSession`을 내부에 소유한다

### US-005: controller command apply surface 추가

**Description:** 개발자로서, controller가 editor command를 직접 적용할 수 있어야 한다.

**Acceptance Criteria:**
- [ ] controller가 `set-parameter`, `update-item-timing`, CRUD command, `set-composition` 적용을 지원한다
- [ ] dirty, revision, checkpoint count를 읽을 수 있다
- [ ] controller command apply 테스트가 추가된다

### US-006: typed workspace HTTP client CRUD 추가

**Description:** 개발자로서, 브라우저와 CLI가 공통으로 쓸 typed workspace client가 필요하다.

**Acceptance Criteria:**
- [ ] typed workspace client가 추가된다
- [ ] `list/get/create/update/delete` 메서드를 제공한다
- [ ] browser/Node에서 모두 사용할 수 있는 fetch 기반 구현이다
- [ ] client CRUD 단위 테스트가 추가된다

### US-007: typed workspace HTTP client apply-command/conflict 추가

**Description:** 개발자로서, optimistic concurrency를 브라우저와 CLI에 동일하게 노출하려면 apply-command와 conflict helper가 필요하다.

**Acceptance Criteria:**
- [ ] client가 `apply-command` 메서드를 제공한다
- [ ] revision 기반 optimistic concurrency 에러 shape를 노출한다
- [ ] apply-command 및 conflict 단위 테스트가 추가된다

### US-008: workspace service persistence/repository 추가

**Description:** 개발자로서, 온라인 에디터 상태를 원격 저장할 repository 계층이 필요하다.

**Acceptance Criteria:**
- [ ] workspace snapshot 저장소 abstraction이 추가된다
- [ ] 기본 영속 저장은 SQLite 또는 동등한 서버 측 저장소를 사용한다
- [ ] revision 필드가 저장 구조에 포함된다
- [ ] repository 단위 테스트가 추가된다

### US-009: workspace service CRUD endpoint 추가

**Description:** 개발자로서, 온라인 workspace를 읽고 생성하고 삭제할 HTTP endpoint가 필요하다.

**Acceptance Criteria:**
- [ ] workspace CRUD endpoint가 추가된다
- [ ] service health 및 기본 오류 응답 테스트가 추가된다
- [ ] typed workspace client CRUD 테스트가 실제 endpoint와 roundtrip 된다

### US-010: workspace service apply-command endpoint 추가

**Description:** 개발자로서, 원격 workspace도 동일한 command 모델로 변경할 수 있어야 한다.

**Acceptance Criteria:**
- [ ] workspace apply-command endpoint가 추가된다
- [ ] revision mismatch 시 conflict 응답을 돌려준다
- [ ] apply-command endpoint 테스트가 추가된다

### US-011: shell layout/theme prefs store 분리

**Description:** 개발자로서, layout/theme는 문서 저장과 분리된 local prefs store로 이동해야 한다.

**Acceptance Criteria:**
- [ ] layout/theme persistence가 local prefs store로 분리된다
- [ ] shell 내부 localStorage 하드코딩이 prefs store 경유로 바뀐다
- [ ] 기존 layout/theme 테스트가 유지되거나 갱신된다

### US-012: shell controller 주입 구조로 리팩터

**Description:** 개발자로서, `motion-content-editor` 셸이 문서 저장을 소유하지 않고 injected controller를 사용해야 한다.

**Acceptance Criteria:**
- [ ] `createMotionEditorShell()`이 workspace/controller 훅을 받는다
- [ ] 문서 저장 책임이 shell 내부에서 제거된다
- [ ] 기존 undo/redo, selection detail, timeline 동작이 유지된다
- [ ] shell 테스트가 새 주입 구조에 맞게 갱신된다

### US-013: demo workspace bootstrap/open/create 흐름 추가

**Description:** 사용자로서, demo 앱이 local sandbox가 아니라 workspace를 열고 생성하는 온라인 에디터처럼 동작해야 한다.

**Acceptance Criteria:**
- [ ] demo 앱이 workspace id 또는 신규 workspace 생성 흐름을 가진다
- [ ] preset은 새 workspace seed 또는 import source로 동작한다
- [ ] document 저장은 원격 workspace client를 통해 수행된다
- [ ] layout/theme 같은 UI preference만 로컬에 남는다

### US-014: demo autosave/status/conflict UI 추가

**Description:** 사용자로서, 온라인 저장 성공/실패/충돌 상태를 명확히 볼 수 있어야 한다.

**Acceptance Criteria:**
- [ ] autosave 상태, last saved, conflict/error 상태가 UI에 표시된다
- [ ] revision conflict 시 사용자에게 복구 또는 재시도 가능한 상태를 노출한다
- [ ] 브라우저 QA로 저장/에러 상태를 검증한다

### US-015: CLI motion document validate/inspect 추가

**Description:** 개발자로서, 터미널에서 composition/workspace 문서를 검증하고 확인할 수 있어야 한다.

**Acceptance Criteria:**
- [ ] `qa-sdk motion validate <file>`가 추가된다
- [ ] `qa-sdk motion inspect <file>`가 추가된다
- [ ] CLI help/usage와 테스트가 추가된다

### US-016: CLI workspace CRUD/import/export 추가

**Description:** 개발자로서, 터미널에서 온라인 workspace를 생성/조회/삭제하고 import/export할 수 있어야 한다.

**Acceptance Criteria:**
- [ ] `qa-sdk motion workspace list/show/create/delete`가 추가된다
- [ ] `qa-sdk motion export --workspace <id> --out <file>`가 추가된다
- [ ] `qa-sdk motion import <file> --workspace <id>`가 추가된다
- [ ] CLI가 typed workspace client를 사용한다

### US-017: CLI workspace apply/preview 추가

**Description:** 개발자로서, 터미널에서 remote workspace에 command를 적용하고 preview를 띄울 수 있어야 한다.

**Acceptance Criteria:**
- [ ] `qa-sdk motion apply --workspace <id> --command <json>`가 추가된다
- [ ] `qa-sdk motion preview [--workspace <id>]`가 추가된다
- [ ] CLI가 typed workspace client apply-command를 사용한다
- [ ] preview orchestration 테스트 또는 smoke verification이 추가된다

### US-018: 기존 localStorage demo 상태를 online workspace로 마이그레이션

**Description:** 사용자로서, 기존 demo localStorage 상태를 잃지 않고 online workspace로 옮길 수 있어야 한다.

**Acceptance Criteria:**
- [ ] 기존 `qa-sdk.motion-content-editor-demo/v1` 상태를 읽어 import 가능한 마이그레이션 경로를 제공한다
- [ ] 기존 `mce-layout/v1`, `mce-theme/v1`은 local prefs로 계속 동작한다
- [ ] online workspace 저장 이후 demo 앱 reload에서 원격 상태가 복원된다
- [ ] CLI import/export와 demo 브라우저 QA를 포함한 end-to-end 테스트가 추가된다

## Success Metrics

- 브라우저와 CLI가 같은 workspace id를 기준으로 동일한 document를 읽고 수정한다
- composition export가 기존 V1 문서와 호환된다
- demo 문서 저장 경로에서 document localStorage 의존이 사라진다
- preview 기반 브라우저 QA와 CLI 흐름이 모두 통과한다
[/PRD]
