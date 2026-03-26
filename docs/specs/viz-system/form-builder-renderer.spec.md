---
def:
  id: form-builder-renderer
  scope: ui
  aspect: component
  depth: specification
  lifecycle: approved
  layer: experience
  tags: [tier-frontend]
  links:
    - target: form-builder-spec
      type: refines
---

# Form Builder 렌더링

## 목적 ^purpose

form-builder의 auto-layout, 폼 렌더러, 전체 데이터 흐름을 분리해 편집 결과가 프리뷰와 동기화되는 경로를 설명한다.

## 구성 ^overview

motion-content의 `MotionParameterDef` 시스템이 폼 렌더링의 기반이다. 파라미터 정의(`text`, `color`, `number`, `select`)에 따라 입력 컴포넌트를 동적 생성하고, 변경 값이 `resolveMotionComposition` → `applyMotionTemplate` 경로로 프리뷰에 반영된다.

## 파라미터 타입별 렌더링

| type | 렌더링 | 속성 |
|------|--------|------|
| `text` | 텍스트 입력 필드 | `defaultValue: string` |
| `color` | 색상 피커 | `defaultValue: string` (hex) |
| `number` | 숫자 입력/슬라이더 | `min`, `max`, `step` |
| `select` | 드롭다운 | `options: { value, label }[]` |

각 타입은 `MotionParameterDef.type` 으로 분기하며, `defaultValue`가 초기값으로 사용된다.

## 데이터 흐름 — 편집에서 프리뷰까지

```
MotionParameterDef[]
  │
  ├── 폼 렌더러 → 입력 UI 생성
  │     │
  │     └── 사용자 변경 → MotionEditorCommand("set-parameter")
  │           │
  │           ├── applyMotionEditorCommand() → EditorState 갱신
  │           │     └── resolveMotionComposition(composition, newValues)
  │           │           └── MotionParameterValues 재계산
  │           │
  │           └── applyMotionTemplate("{{headline}}", values)
  │                 └── 텍스트/스타일 자산 실시간 갱신
  │
  └── 프리뷰 런타임 → MotionPlayer가 resolved composition 소비
```

## auto-layout 규칙

- 파라미터 배열 순서가 폼 렌더링 순서를 결정
- `select` 타입은 `options` 배열이 필수 — 없으면 IO 검증(`validateParameter`)에서 거부
- `number` 타입은 `min`/`max`/`step` 으로 범위 제약
- 검증 실패 시 `MotionCompositionParseError`로 상세 이슈 목록 제공

## Asset 연결

`MotionAssetDef`가 파라미터 값과 DOM 타겟을 연결한다.

- `text` 자산: `target.textContent = applyMotionTemplate(template, values)`
- `style` 자산: `target.style[property] = applyMotionTemplate(template, values)`
- 프로퍼티: `background`, `color`, `borderColor`
- 타겟 해석: `MotionStageTargetV1.nodeId` → `data-motion-id` 속성으로 DOM 요소 매칭

## 프리뷰 동기화

`MotionEditorState.values`가 변경되면:

1. `resolveMotionComposition()` 으로 전체 composition 재해석
2. `resolveMotionAssetSnapshots()` 로 asset 스냅샷 생성 (변경 여부 추적)
3. `MotionResolvedAssetSnapshot.changed` 플래그로 변경된 자산만 식별
4. 런타임 player가 resolved composition으로 GSAP 타임라인 갱신

## 검증 체계

`validateMotionComposition()` 이 전체 composition을 검증한다:

- 필수 필드 존재 + 타입 검증 (string/number/enum/array)
- CueRef 검증: preset 참조 또는 인라인 MotionCueDef
- 참조 무결성: layer → sequence, caption → sequence, transition → sequence, preset 참조
- IO 모듈이 JSON 직렬화/역직렬화 + 슬롯 정규화(`normalizeFromSlots`) 담당
