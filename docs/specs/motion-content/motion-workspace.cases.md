---
def:
  id: motion-workspace-spec-cases
  type: spec
  tier: component
  scope: flow
  aspect: user_scenario
  depth: validation
  lifecycle: approved
  layer: domain
  svc: motion-workspace
  tags: [scenario, motion-workspace]
  links:
    - target: motion-workspace-spec
      type: refines
    - target: motion-workspace-system
      type: depends_on
---

# Motion Workspace Spec — 소비자 기대 시나리오

## 목적 ^purpose

`motion-workspace-spec`(MotionWorkspaceController + Snapshot + Migration + IO)가 `motion-workspace-system`에 의존할 때 기대하는 계약. 도메인 라이브러리는 motion-workspace-system 이 제공하는 Repository 포트, Controller 패턴, WebSocket hub, Hono 서비스 런타임 위에서 세션 상태를 안전하게 영속한다.

## 시나리오 1: Snapshot 결정론적 직렬화 ^overview

**전제**: `motion-workspace-system`이 "Controller + Repository 패턴 — 영속 계층 교체 가능" 원칙을 규정.

**동작**: `createMotionWorkspaceSnapshot()` 에 JSON/문자열/객체 입력을 정규화.

**기대**:
- 입력 포맷(JSON string vs object) 차이가 같은 composition 에 대해 동일 snapshot 출력
- snapshot 버전(`MotionWorkspaceSnapshotV1`) 에는 composition + editor state + source metadata 포함
- 직렬화 순서 보존 (stable serialization, key order deterministic)

**실패 시 수정 대상**: `motion-workspace-system.md` §"서비스 런타임 구성" — Repository 포트 계약이 snapshot 직렬화 규칙을 포함하지 않으면 DB 저장값이 직렬화 타이밍에 따라 달라짐.

## 시나리오 2: Migration 버전 전이 안전성 ^overview

**전제**: `motion-workspace-system`이 "Controller + Repository 패턴" 으로 SQLite → PostgreSQL 전환이 가능하도록 설계.

**동작**: `migrateMotionWorkspaceSnapshot()` 호출, v0 → v1 snapshot 변환.

**기대**:
- 변환 후에도 `MotionWorkspaceSnapshotV1` 스키마 준수
- 변환 실패 → 원본 snapshot 보존 (partial write 금지)
- 여러 버전 chain 지원: v0 → v1 → v2 순차 실행

**실패 시 수정 대상**: `motion-workspace-system.md` — migration plan 이 chain 버전을 다루지 않으면 이후 v3 도입 시 v0 → v3 직접 변환을 만들어야 함.

## 시나리오 3: WebSocket hub 브로드캐스트 계약 ^overview

**전제**: `motion-workspace-system`이 "WorkspaceWsHub — WebSocket 연결 관리 + workspace 단위 브로드캐스트" 를 제공.

**동작**: Controller 가 save command 처리 후 WebSocket hub 에 변경 이벤트 발행.

**기대**:
- 같은 workspace 구독자에게만 broadcast (다른 workspace 오염 금지)
- hub 장애 시 save 성공 + broadcast 실패만 warning metric (save 는 성공 유지)
- 메시지 순서 workspace 별 보존 (FIFO)

**실패 시 수정 대상**: `motion-workspace-system.md` §"설계 결정" — "WebSocket hub 은 인메모리, 스케일아웃 시 Redis pub/sub 전환" 이라면 단일 인스턴스 계약이 분명해야 scale-out 시 broadcast 정책이 바뀌는 시점을 예측 가능.

## 시나리오 4: Controller undo/redo 명령 체인 ^overview

**전제**: `motion-workspace-system`이 "MotionWorkspaceController — 세션 관리 + 명령 적용 + snapshot 생성 + dirty 추적" 을 정의.

**동작**: 사용자가 명령 A, B, C 적용 → undo → redo.

**기대**:
- undo 후 state 는 B 적용 직후 state (결정론적)
- redo 는 C 복원
- dirty flag 가 명령 이력과 동기 (save 후 clean, 새 command 로 dirty)

**실패 시 수정 대상**: `motion-workspace-system.md` — Controller 가 pure controller 가 아니라 명령 store 까지 겸하면 책임 경계 흐려짐. 명령 history 소유권 명시 필요.
