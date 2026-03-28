---
def:
  id: inspector-engine
  address: def_document:v2:1157
  scope: ui
  aspect: component
  depth: specification
  lifecycle: draft
  layer: mediation
  tags: [tier-frontend]
  links:
    - target: motion-editor-component
      type: depends_on
---
# Inspector Engine

## 목적 ^purpose

MotionCompositionDefV2를 트리 구조로 변환하고, 선택/펼침/디테일 추출/타임라인 계산을 순수 함수로 제공한다. DOM/브라우저 의존이 없으므로 어떤 렌더러(브라우저, CLI, 테스트)에서도 소비 가능하다.

## 구성 ^overview

| 계층 | 역할 | 순수 여부 |
|------|------|----------|
| TreeNode 모델 | composition → 재귀 트리 변환 | 순수 |
| NodeDetail 추출 | TreeNode → 섹션/행 구조화 데이터 | 순수 |
| Timeline 추출 | scenes → 수평 블록 좌표 계산 | 순수 |
| InspectorState | 선택/펼침 상태 관리 | 상태 변이 |

## 노드 ID 규약

`nodeId(kind, sourceId, sceneId?)` 함수로만 생성. 문자열 템플릿 직접 사용 금지.

### 글로벌 노드 (kind만으로 유일)

| 패턴 | 예시 |
|------|------|
| `composition` | `composition` (루트, 항상 1개) |
| `scene:{scene.id}` | `scene:scene-a` |
| `target:{target.id}` | `target:hero-img` |
| `parameter:{param.id}` | `parameter:headline` |
| `asset:{asset.id}` | `asset:bg-style` |
| `cue:{cue.id}` | `cue:fade-in` |

### 씬 내부 노드 (sceneId 포함으로 경합 방지)

같은 target/sequence/caption이 여러 씬에 배치될 수 있으므로 sceneId를 포함한다.
placement는 같은 씬 내에서도 같은 targetId가 중복 배치될 수 있으므로 배열 인덱스(`#N`)를 추가한다.

| 패턴 | 예시 |
|------|------|
| `placement:{sceneId}/{targetId}#N` | `placement:scene-a/hero-img#0` |
| `sequence:{sceneId}/{seq.id}` | `sequence:scene-a/seq-intro` |
| `caption:{sceneId}/{cap.id}` | `caption:scene-a/cap-title` |

### 트리 구조

```
composition
├── scene:scene-a
│   ├── placement:scene-a/hero-img
│   ├── placement:scene-a/sub-text
│   ├── sequence:scene-a/seq-intro
│   └── caption:scene-a/cap-title
├── scene:scene-b
│   └── placement:scene-b/hero-img     ← 같은 target, 다른 ID
├── target:hero-img
├── target:sub-text
├── parameter:headline
└── cue:fade-in
```

### 불변식

- 트리 내 모든 노드 ID는 유일해야 한다 (테스트 검증: 49건)
- `nodeId()` 이외의 경로로 ID를 생성하면 안 된다

## 에러 방어 (테스트 검증 완료)

| 카테고리 | 위험 | 방어 |
|----------|------|------|
| E1 빈 데이터 | `totalMs=0 → 0/0=NaN` | totalMs 최솟값 1 클램프 |
| E2 참조 무결성 위반 | targetId 미존재 | `(missing)` 라벨, 크래시 없음 |
| E3 타이밍 경계값 | 음수 startMs | 허용, NaN 없음 |
| E4 ID 경계값 | 빈 문자열, 슬래시 포함 | nodeId 규칙으로 유일성 보장 |
| E5 상태 조작 순서 | null tree에서 select | 크래시 없음, 이전 상태 완전 대체 |
| E6 대규모 데이터 | 1111 노드 | 정확한 카운트 + ID 유일성 |
| E7 씬 내부 중복 placement | 같은 씬에 같은 targetId 2회 | `#index` suffix로 구분 |
| E8 cuePresets undefined | 필드 미정의 | `?? []` fallback |
| E9 Math.max 빈 배열 | `Math.max(0)` = 0 | 클램프 1 |
| E10 rawJson 직렬화 | 순환 참조 | 구조체 기반, 순환 없음 확인 |
| E11 sceneId 누락 | 글로벌 ID 생성됨 | 빌드 함수가 항상 sceneId 전달 |
| E12 extractor 누락 | 9종 kind 전체 | 레지스트리 전수 검증 |

## TreeNode 타입 계약

```typescript
interface TreeNode<K extends TreeNodeKind = TreeNodeKind> {
  readonly id: string;           // nodeId() 생성
  readonly kind: K;
  readonly label: string;        // 사람이 읽는 이름
  readonly meta?: string;        // 요약 (타이밍, 카운트 등)
  readonly data: TreeNodeDataMap[K];  // kind별 정확한 타입
  readonly children: readonly TreeNode[];
}
```

`data`는 kind에 따라 정확한 타입 보장:

| kind | data 타입 |
|------|-----------|
| composition | MotionCompositionDefV2 |
| target | MotionTargetDef |
| scene | MotionSceneDef |
| placement | SceneLayerPlacement |
| sequence | MotionSceneSequenceDef |
| caption | MotionCaptionCue |
| parameter | MotionParameterDef |
| asset | MotionAssetDef |
| cue | MotionCuePreset |

## 퍼블릭 API

### 트리 빌드

```typescript
buildCompositionTree(comp: MotionCompositionDefV2): TreeNode<"composition">
```

### 노드 조회

```typescript
findNode(root: TreeNode, id: string): TreeNode | null
countNodes(root: TreeNode): number
```

### 디테일 추출

```typescript
extractNodeDetail(node: TreeNode): NodeDetail
```

kind별 디테일 추출은 `DetailExtractor` 레지스트리로 분리. 새 kind 추가 시 switch 수정 없이 extractor 등록.

```typescript
type DetailExtractor<K extends TreeNodeKind> =
  (data: TreeNodeDataMap[K]) => readonly DetailSection[];
```

### 타임라인 추출

```typescript
extractTimeline(comp: MotionCompositionDefV2): TimelineData
```

### 상태 관리

```typescript
createInspectorState(): InspectorState
loadComposition(state, composition, workspaceId, status): void
selectNode(state, nodeId): void
toggleExpand(state, nodeId): void
```

## 렌더링 관심사 분리

엔진이 소유하지 않는 것:

- 아이콘 라벨 (`C`, `T`, `S` ...) — 렌더러 책임
- 씬 색상 팔레트 — 렌더러 책임
- HTML escape — 렌더러 책임
- DOM 이벤트 — 렌더러 책임

엔진이 소유하는 것:

- `formatMs()` — 밀리초 포맷 (렌더러도 사용)
- `describeCue()` — 큐 요약 문자열
- `nodeId()` — ID 생성 규칙
