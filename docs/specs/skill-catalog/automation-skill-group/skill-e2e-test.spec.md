---
def:
  tier: component
  id: skill-e2e-test
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: experience
  tags: [testing]
  links:
    - target: automation-skill-group
      type: refines
    - target: skill-cli-def-commands
      type: depends_on
    - target: skill-spec-lifecycle
      type: depends_on
  sources:
    - skills/e2e-test/SKILL.md

---


## 탐색 ^navigation

skill-catalog-system > automation-skill-group > **skill-e2e-test**

형제: `skill-gform-parser` · `skill-spec-lifecycle`

## 목적 ^purpose

시나리오 문서의 사용자 흐름을 Playwright E2E 테스트로 변환하고 실행까지 연결해, 브라우저 수준 검증을 반복 가능한 작업으로 만든다.

## 사용 맥락 ^context

사용자 여정이 바뀌었거나 `GateKind: e2e-test`를 통과해야 할 때,
시나리오 마커(`^preconditions`, `^steps`, `^assertions`)가 준비된 문서를 기준으로 이 스킬을 사용한다.

## 설계 의도 ^intent

시나리오 문서를 테스트의 입력으로 삼아 스펙과 테스트가 같은 구조를 보게 만든다.
임의로 Playwright 파일만 고치면 시나리오 문서와 테스트가 쉽게 분리되므로, 문서 마커를 먼저 읽는 흐름을 강제한다.

## 피드백 규칙 ^feedback

- 같은 시나리오에서 E2E 재실행이 반복되면 fixture/헬퍼 추출 후보로 본다.
- 브라우저 타임아웃이 잦으면 서버 기동 시간과 테스트 전제조건 설명을 보강한다.

## 주의사항 ^caveat

WebSocket 간섭 때문에 병렬 실행이 제한되어 있으므로 단일 테스트의 안정성을 먼저 확보해야 한다.
시나리오 문서에 핵심 마커가 없으면 테스트 자동화 품질도 바로 떨어진다.

## 관련 소스

- `skills/e2e-test/SKILL.md`
