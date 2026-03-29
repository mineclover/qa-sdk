---
def:
  id: definition-extraction
  level: leaf
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
---
# Definition Extraction — 마커 기반 요약 추출

## 목적 ^purpose

헤더에 `^marker`를 붙이면 해당 섹션 전체가 추출 대상이 된다. 작성자가 요약에 포함할 내용을 섹션으로 명시적으로 통제한다.

## 정의 ^defines

- ^marker 문법 (헤더 접미사)
- 3수준 추출 (purpose / overview / full)
- findMarkedSections(), extractByLevel(), summarizeDocument()

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
## 목적 ^purpose       ← 표준 마커
## 구성 ^overview      ← 표준 마커
## 제약 ^constraint    ← 커스텀 마커
```

마커 없는 섹션은 full 추출에서만 노출된다.

## 관련 소스

- `definition-catalog/src/extract.ts` — findMarkedSections, extractByLevel, extractByMarker, summarizeDocument
