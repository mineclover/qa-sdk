---
def:
  id: scenario-authoring-guide
  type: knowledge
  knowledge_kind: guide
  scope: flow
  aspect: user_scenario
  depth: overview
  lifecycle: approved
  layer: experience
  tags: [entry-point, testing, structural]
  links:
    - target: definition-authoring-guide
      type: refines
    - target: guides-system
      type: refines
---
# 유저 시나리오 작성 가이드

## 목적 ^purpose

유저 시나리오 문서의 작성 표준을 정의한다. 시나리오 문서는 e2e 테스트 자동 생성의 입력이 되며, 사람이 읽을 수 있는 행동 명세이면서 동시에 기계가 파싱할 수 있는 구조화된 형식이다.

## 핵심 통찰 ^insight

시나리오 = "사용자가 시스템과 상호작용하는 하나의 완결된 흐름". 계약(contract)이 "무엇이 보장되어야 하는가"를 정의한다면, 시나리오는 "사용자가 어떻게 사용하는가"를 정의한다.

```
계약 (contract)  → ^inputs, ^outputs, ^precondition, ^postcondition
시나리오 (scenario) → ^actor, ^preconditions, ^steps, ^assertions, ^variants
```

둘 다 definition-catalog의 마커 시스템을 사용하지만 목적이 다르다.

## 6종 시나리오 마커

| 마커 | 필수 | e2e 변환 | 설명 |
|------|------|---------|------|
| `^actor` | 선택 | describe context | 누가 이 흐름을 실행하는가 |
| `^preconditions` | **필수** | beforeEach / setup | 시작 전 필요한 상태 |
| `^steps` | **필수** | test steps | 번호 매긴 행동 시퀀스 |
| `^assertions` | **필수** | expect() | 기대 결과 검증 |
| `^variants` | 선택 | additional test cases | 에러/엣지 케이스 |
| `^update-trigger` | 선택 | maintenance trigger | 재검토 조건 |

## 작성 규칙

### ^steps 형식

```markdown
## 스텝 ^steps

1. 사용자가 로그인 페이지에 접속 → GET /login
2. 이메일/비밀번호 입력 → fill("email", "test@example.com")
3. 로그인 버튼 클릭 → click("submit")
4. 대시보드 리다이렉트 확인 → waitForURL("/dashboard")
```

- 번호 매기기 (순서 보장)
- `→` 뒤에 구체적 행동 (API 호출, UI 조작)
- 모호한 표현 금지 ("적절히 처리" → "200 OK 반환")

### ^assertions 형식

```markdown
## 검증 ^assertions

- 로그인 후 JWT 토큰이 쿠키에 설정됨
- 대시보드에 사용자 이름이 표시됨
- /api/me 응답에 userId가 포함됨
```

- 검증 가능한 구체적 기대값
- UI 상태 + API 응답 모두 포함

### ^variants 형식

```markdown
## 변형 ^variants

### V1: 잘못된 비밀번호
- step 3에서 에러 메시지 "비밀번호가 올바르지 않습니다" 표시
- 로그인 시도 횟수 +1

### V2: 이미 로그인된 상태
- step 1에서 바로 대시보드로 리다이렉트
```

- `V{번호}: {변형 이름}` 형식
- 기본 시나리오와의 차이점만 기술

## e2e 연결

`/e2e-test` skill이 시나리오 문서를 읽어 테스트를 생성할 때:

```
^preconditions → test fixture / beforeEach
^steps         → page actions (goto, click, fill, waitFor)
^assertions    → expect() / assertion
^variants      → additional test cases
```

## frontmatter 템플릿

```yaml
def:
  id: {svc}-scenario-{번호}
  scope: feature
  aspect: scenario
  depth: specification
  lifecycle: draft
  svc: {svc}
  links:
    - target: {parent-system}
      type: refines
    - target: {관련-api-spec}
      type: depends_on
```

## 관련 소스

- `definition-catalog/src/taxonomy.ts` — SCENARIO_MARKERS
- `skills/e2e-test/` — e2e 테스트 생성 (시나리오 소비자)
