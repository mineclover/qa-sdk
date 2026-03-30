---
def:
  id: skill-gform-parser
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: experience
  tags: [automation]
  links:
    - target: automation-skill-group
      type: refines
    - target: skill-spec-lifecycle
      type: refines
---


## 탐색 ^navigation

skill-catalog-system > automation-skill-group > **skill-gform-parser**

형제: `skill-e2e-test` · `skill-spec-lifecycle`

## 목적 ^purpose

Google Form URL에서 필드 메타데이터를 추출해 config나 HTML 생성까지 이어 줌으로써, 폼 역설계를 수작업 대신 재현 가능한 파이프라인으로 바꾼다.

## 사용 맥락 ^context

외부 Google Form을 서비스에 붙여야 하거나,
폼 필드 구조를 빠르게 config 파일로 옮겨야 할 때 이 스킬을 사용한다.

## 설계 의도 ^intent

폼 메타데이터를 `FB_PUBLIC_LOAD_DATA_`에서 직접 파싱하게 해 사람 눈으로 entry ID를 복사하는 오류를 줄인다.
출력 형식을 JS config와 HTML 생성으로 나눠, 분석과 적용 단계를 분리한다.

## 피드백 규칙 ^feedback

- 같은 폼에 대해 `--json`과 `--config`가 반복되면 템플릿 preset 후보로 본다.
- 필드 타입 매핑 오류가 나오면 parser의 타입 분류 규칙과 예외 케이스 문서를 함께 보강한다.

## 주의사항 ^caveat

Google Form DOM 구조 변경에 취약하므로 파싱 실패 시 즉시 HTML/fixture를 갱신해야 한다.
민감한 설문 데이터는 실제 응답이 아니라 구조 메타데이터만 다뤄야 한다.

## 관련 소스

- `skills/gform-parser/SKILL.md`
