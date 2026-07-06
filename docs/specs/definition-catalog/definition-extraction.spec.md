---
def:
  id: definition-extraction
  type: design
  tier: component
  owner_system: definition-service
  projection_plane: intent
  intent_hierarchy: core
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: mediation
  svc: definition-service
  tags: [structural]
  links:
    - target: definition-catalog-spec
      type: refines
sources:
  - packages/definition-catalog/src/extract.ts
  - packages/definition-catalog/src/extract.test.ts
  - packages/definition-catalog/src/assemble.ts
  - packages/definition-catalog/src/contract.ts
---
# Definition Extraction — 마커 기반 요약 추출

## 목적 ^purpose

헤더에 `^marker`를 붙이면 해당 섹션 전체가 추출 대상이 된다. 작성자가 요약에 포함할 내용을 섹션으로 명시적으로 통제한다.

## 정의 ^defines

- ^marker 문법 (헤더 접미사)
- 3수준 추출 (purpose / overview / full)
- findMarkedSections(), extractByLevel(), summarizeDocument()
- extractByMarker() 자유 마커 추출
- fenced code block 내부 예시 마커 무시

## 소비 ^consumes

- (없음 — 순수 텍스트 파싱, 외부 의존 없음)

## 추출 수준 ^constraint

| 수준 | 추출 대상 | 용도 |
|------|----------|------|
| purpose | `## ... ^purpose` 섹션 본문 | 이 문서가 무엇인가 |
| overview | `^purpose` + `^overview` 섹션 본문 | 핵심 사실 포함 |
| full | 전체 (마커 표기만 제거) | 상세 내용 |

## 마커 문법

```markdown
## 목적 ^purpose       ← 필수 마커
## 방법 ^method        ← 방법 마커 (module/group용)
## 구성 ^overview      ← 보조 마커
## 정의 ^defines       ← 구조 마커
## 소비 ^consumes      ← 구조 마커
## 위임 ^delegates     ← 구조 마커
## 해석 관점 ^interpretation  ← 복수 독해 렌즈 기록
## 제약 ^constraint    ← 커스텀 마커
```

마커 없는 섹션은 full 추출에서만 노출된다.

### 마커 체계

| 마커 | 역할 | 필수 여부 |
|------|------|----------|
| `^purpose` | 왜 존재하는가 | 필수 |
| `^method` | 하위 구성요소로 목적을 어떻게 달성하는가 | module/group 권장 |
| `^defines` | 이 문서가 정의하는 것 | 권장 |
| `^consumes` | 외부에서 가져다 쓰는 것 | 권장 |
| `^delegates` | 자식에게 위임하는 것 | module/group 권장 |
| `^overview` | 핵심 사실 나열 | 선택 |
| `^interpretation` | 같은 대상을 여러 해석 관점으로 병렬 기록 | 선택 |

## 해석 관점 포맷

`^interpretation`는 문서의 공통 사실(`^purpose`, `^defines`)과,
그 사실을 읽는 렌즈를 분리해서 기록할 때 사용한다.
정답 선언이 아니라 병렬 독해를 남기는 용도다.

```markdown
## 해석 관점 ^interpretation

이 문서는 여러 해석 관점을 함께 기록할 수 있다.

### 관점 1 — <이름>
- 질문: 이 관점이 답하려는 질문
- 읽기: 핵심 해석 2~5문장
- 연결: 어떤 축/개념/문서를 함께 읽는가
- 한계: 이 관점만으로 설명되지 않는 것

### 관점 2 — <이름>
- 질문: ...
- 읽기: ...
- 연결: ...
- 한계: ...
```

## 관련 소스

- `packages/definition-catalog/src/extract.ts` — findMarkedSections, extractByLevel, extractByMarker, summarizeDocument
- `packages/definition-catalog/src/extract.test.ts` — 표준 마커, 자유 마커, fenced block 회귀 검증
