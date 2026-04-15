---
def:
  id: definition-authoring-guide
  type: knowledge
  knowledge_kind: guide
  scope: flow
  aspect: user_scenario
  depth: overview
  lifecycle: approved
  layer: experience
  tags: [entry-point]
  links:
    - target: definition-catalog-spec
      type: depends_on
    - target: guides-system
      type: refines
    - target: tag-management-spec
      type: depends_on
---
# 문서 작성 표준 가이드

## 목적 ^purpose

definition-catalog 문서를 일관되게 작성하고 모듈 단위로 쿼리할 수 있도록 표준을 정의한다.

## 핵심 원칙 ^overview

1개 문서 = 1개 좌표. 좌표 4축(scope × aspect × depth × seq)으로 주제 + 상세도를 표현하고, svc 필드로 소속 모듈을 지정한다. 작업 목적에 따라 필요한 문서만 빠르게 쿼리하는 것이 목표.

## 1. 좌표 구성 규칙

### scope × aspect — "이 문서가 다루는 주제"

| scope | 주 독자 | 사용 시점 |
|-------|--------|----------|
| interface | API 소비자 | API 계약, CLI 계약, 이벤트 스키마 |
| feature | 기능 개발자 | 기능 명세, 시나리오 |
| flow | 흐름 추적자 | 사용자 시나리오, 프로세스 흐름 |
| state | 상태 설계자 | 도메인 상태, 시스템 상태 |
| constraint | 규칙 확인자 | 기술/비즈니스/인프라 제약 |
| data | 데이터 파악자 | 도메인 데이터, 시스템 데이터 |
| ui | 화면 관찰자 | 레이아웃, 컴포넌트, 인터랙션 |

### depth — "얼마나 상세한가"

| depth | 역할 | 내용 |
|-------|------|------|
| overview | 전체 그림 | 시스템/영역/그룹 진입점. 하위 문서 요약 |
| specification | 상세 명세 | 개별 API, 데이터 모델, 기능 정의 |
| implementation | 구현 세부 | 코드 수준 설계, 알고리즘 |
| validation | 검증 계획 | 테스트 계획, 품질 게이트 |

### knowledge_kind — "어떤 지식 문서인가"

| knowledge_kind | 의미 |
|----------------|------|
| philosophy | 시스템 철학 |
| adr | 아키텍처 결정 기록 |
| guide | 사용법/판단 가이드 |
| narrative | 진화 과정/맥락 |
| convention | 합의된 규칙 |
| pattern | 반복 해법 |
| concept | 개념 정의 |

### svc — "어느 모듈에 속하는가"

```yaml
def:
  svc: ingest-server   # packages/ 디렉토리명과 일치
```

**필수 규칙**:
- depth=specification 이상 → svc **필수**
- depth=overview + level=unit/module → svc **필수**
- depth=overview + level=system/area → svc **불필요**
- 가이드/철학 문서 → svc **불필요**

## 2. 모듈 계층 패턴

모든 서비스/라이브러리는 이 패턴을 따른다:

```
{svc}-system (depth=overview, level=unit, svc={svc})
  ├── {svc}-api-spec     (scope=interface, depth=specification)  "API가 뭐야?"
  ├── {svc}-data-spec    (scope=data, depth=specification)       "데이터가 뭐야?"
  ├── {svc}-flow-spec    (scope=flow, depth=specification)       "흐름이 뭐야?"
  ├── {svc}-constraint   (scope=constraint, depth=specification) "제약이 뭐야?"
  └── {svc}-scenario     (scope=feature, depth=validation)       "검증은?"
```

모든 자식 문서의 `svc`는 부모와 동일.

**쿼리 예시**:
```bash
qa-sdk def list --svc=ingest-server                        # 전체
qa-sdk def list --svc=ingest-server --scope=interface       # API만
qa-sdk def list --svc=ingest-server --depth=specification   # 스펙만
qa-sdk def list --scope=interface --depth=specification      # 모든 서비스 API
```

## 3. frontmatter 필수 구조

```yaml
---
def:
  id: {kebab-case 고유 ID}
  level: leaf                    # system/area/unit/module/leaf
  scope: interface               # 7종 중 택1
  aspect: api_contract           # scope별 유효 조합
  depth: specification           # overview/specification/implementation/validation
  lifecycle: draft               # draft/review/approved/deprecated/archived
  layer: operation               # domain/operation/mediation/experience (선택)
  svc: ingest-server             # 소속 모듈 (depth=spec 이상 필수)
  tags: [structural, security]   # 선택
  links:
    - target: parent-doc-id
      type: refines              # 부모→자식: contains, 자식→부모: refines
source: packages/<pkg>/src/<file>.ts[:symbol]   # 선택 — 코드 경계와 1:1로 연결할 때만
---
```

`source:`는 문서 frontmatter에서 코드와의 정적 연결을 선언하는 방식이다.
코드 파일 쪽에서는 아래 주석 컨벤션을 같이 쓸 수 있다.

```ts
// @def.boundary <group-or-module-doc-id>[#symbol]
// @def.doc <module-or-leaf-doc-id>[#symbol]
```

`qa-sdk def sync`는 `source:`와 `@def.boundary`/`@def.doc`를 함께 스캔해서
DB의 `code_references`를 갱신한다. `qa-sdk def find-by-file`와 review-feedback은
이 DB를 authoritative source로 사용한다. explicit mapping이 없으면 결과를 주지 않는다.

## 3.5 태그 선택 규칙

`tags`는 좌표(scope/aspect/depth)를 대체하지 않고, 횡단 관심사와 탐색 힌트를 보강하는 메타데이터다.

먼저 붙일 값:

- StructuralTag: `entry-point`, `cross-scope`, `decision`, `generated`
- ConcernTag: `security`, `performance`, `accessibility`, `observability`, `testing`, `migration`, `deprecation`

그 다음 필요할 때만 붙일 값:

- 운영 관례 태그: `runtime`, `persistence`, `contract`, `versioning`
- 제품/영역 태그: `frontend`, `registry`, `motion`
- 품질 하네스 태그: `quality-bundle`, `quality-gate`, `gate-kind:*`

권장 패턴:

- 진입 문서면 `entry-point`
- 통합 설계 문서면 `cross-scope`
- 검증/게이트 문서면 `testing`
- 공개 계약 문서면 `contract`
- 저장소/SQLite/DB 문서면 `persistence`

태그는 보통 2~5개면 충분하다. 자세한 분류 기준은 `tag-management-spec`를 따른다.

## 3.9 문서 유형 (확장자)

파일 확장자로 문서의 역할을 구분한다. 같은 좌표(scope×aspect×depth)에 여러 유형이 공존할 수 있다.

| 확장자 | 질문 | 독자 | 예시 |
|--------|------|------|------|
| `.spec.md` | "이것은 무엇인가" | 정의자/구현자 | gate-engine.spec.md |
| `.rule.md` | "이것을 사용할 때 무엇을 확인하는가" | 소비자 | meta-semantic-ir.rule.md |
| `.todo.md` | "다음에 무엇을 하는가" | 구현자 | meta-semantic-ir.todo.md |
| `.test.md` | "어떻게 검증하는가" | 검증자 | gate-scenario.test.md |
| `.cases.md` | "누가 어떤 흐름으로 사용하는가" | 구현자/검증자 | infra-auth-usecases.cases.md |
| `.memo.md` | "무엇을 발견했는가" | 탐색자 | performance-finding.memo.md |
| `.plan.md` | "어떻게 구현할 것인가" | 설계자 | drizzle-migration.plan.md |

**spec vs rule 구분**:
- spec = "이것은 무엇이고, 어떤 구조인가" (정의)
- rule = "이것을 소비할 때 어떤 조건을 확인하는가" (판별 기준 + 체크리스트)
- rule은 종속 spec과 같은 디렉토리에 배치. spec 변경 시 rule도 함께 갱신.

**cases vs test 구분**:
- cases = "사용자/시스템이 어떤 흐름으로 동작하는가" (시나리오, UC, 기대 결과)
- test = "코드 레벨에서 어떻게 검증하는가" (describe/it 식별자 매핑)
- cases는 test.ts의 원천 시나리오. cases에서 파생하여 test.ts로 구현.

## 4. 본문 필수 구조

```markdown
# 제목

## 목적 ^purpose
이 문서가 무엇인가 (1~3문장).

## 정의 ^defines
- 이 문서가 새로 정의하는 개념/함수/타입

## 소비 ^consumes
- 외부에서 가져다 쓰는 것

## 위임 ^delegates          ← module/unit만
- 자식에게 위임하는 것

## 구성 ^overview            ← 선택
핵심 사실 요약.

## 해석 관점 ^interpretation  ← 선택
같은 구조를 여러 독해 렌즈로 병렬 기록.

## 이하 상세 섹션
...
```

### 4.5 해석 관점 기록

`^interpretation`는 정의 자체와 해석을 분리하고 싶을 때 사용한다.

- `^purpose`, `^defines`, `^consumes`에는 공통 사실을 적는다.
- `^interpretation`에는 그 사실을 어떤 렌즈로 읽는지 적는다.
- 개념 문서, 철학 문서, 가이드, 시각화 문서처럼 하나의 구조를 여러 방식으로 읽을 수 있는 문서에 특히 유용하다.

권장 포맷:

```markdown
## 해석 관점 ^interpretation

### 관점 1 — <이름>
- 질문: 이 관점이 답하려는 질문
- 읽기: 핵심 해석
- 연결: 함께 묶어 읽는 개념/축/문서
- 한계: 이 렌즈가 설명하지 않는 것
```

## 5. 분할 기준

| 신호 | 조치 |
|------|------|
| 150줄 초과 | `/def-split` — module + leaf 분해 |
| 2개 이상 scope 혼재 | scope별 분리 → link 연결 |
| ^defines가 7개 초과 | 개념 단위로 분리 |
| svc가 다른 내용 혼재 | svc별 분리 |

## 6. 검증

```bash
qa-sdk def audit              # 전체 품질 리포트
qa-sdk def validate           # 깨진 링크/순환/고아
qa-sdk def list --depth=specification --svc=""  # svc 미지정 스펙 (위반 후보)
qa-sdk def find-by-file <관련 코드 경로>         # explicit source-map 검증
```

## 7. `qa-sdk def`와 `qa-sdk docs` 선택 기준

`qa-sdk def`는 definition-catalog primitive다. 단일 definition 문서의 좌표, level, contains/link 그래프, code reference, boundary, context, validation을 볼 때 사용한다. 입력은 definition markdown frontmatter와 sync된 local/server/scan datasource다.

`qa-sdk docs`는 cross-document control plane이다. definition markdown, PRD markdown, ralph PRD JSON, ralph session, artifact evidence를 read-only adapter로 모아 family status, drift, PRD authoring context, metadata transform preview를 계산한다. source file이 SSOT이고 adapter는 source-owned vocabulary를 plain string metadata로 보존한다.

### PRD authoring 흐름

| 필요 | 명령 | 비고 |
|------|------|------|
| 관련 specs/TODO/plans/evidence/session state를 모아 PRD 작성 전 맥락 확인 | `qa-sdk docs prd context <topic|doc-id>` | read-only |
| 수집된 context로 markdown PRD skeleton 작성 | `qa-sdk docs prd scaffold <topic|doc-id> --output <file.md>` | markdown만 작성 |
| markdown PRD를 ralph-tui 실행용 JSON으로 변환 | `qa-sdk docs prd to-ralph-json <prd.md> --output <prd.json>` | compatibility JSON 작성 전 target adapter validation |

PRD JSON은 ralph-tui compatibility adapter의 target format이다. Core document model은 definition markdown과 PRD markdown이며, JSON story의 `passes: true`는 completion candidate signal일 뿐 TODO 체크나 spec promotion 권한이 아니다.

### Dry-run-first 정책

- `docs status`, `docs collect`, `docs search`, `docs drift`, `docs prd context`는 read-only다.
- `docs transform metadata`는 dry-run이 기본이며 `--apply`는 지원하지 않는다.
- `docs prd sync-completion`은 dry-run only이며 source/test/evidence가 없는 TODO/spec promotion은 blocked로 보고한다.
- 실제 write는 `docs prd scaffold --output <file.md>`와 `docs prd to-ralph-json --output <file.json>`처럼 명시된 materialization command만 수행한다.

Metadata transform allowlist는 `select|match`, `set.lifecycle`, `set.level`, `set.svc`, `set.sources`, `tags.add/remove`, `links.add/remove`, `sources.set/add/remove`다. `def.id` 변경, PRD JSON frontmatter 변환, REST/remote document service, 자동 미검토 spec promotion은 범위 밖이다.
