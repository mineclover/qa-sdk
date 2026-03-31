---
name: def-new
description: "definition-catalog 새 문서 생성. frontmatter + ^purpose + ^overview 형식으로 새 스펙 문서를 만든다."
---

# Definition Catalog — 새 문서 생성

## 문서 템플릿

```markdown
---
def:
  id: <고유 ID, kebab-case>
  type: <spec|knowledge>             # 선택, 기본 spec
  knowledge_kind: <philosophy|adr|guide|narrative|convention|pattern|concept>  # knowledge만
  level: <group|module|leaf>  # 선택, 기본 leaf
  scope: <ui|feature|flow|state|constraint|data|interface>
  aspect: <세부 유형>
  depth: <overview|specification|implementation|validation>
  lifecycle: approved
  layer: <domain|operation|mediation|experience>  # 선택
  svc: <serviceId>           # 선택
  tags: [<태그들>]           # 선택 — 예: entry-point, testing, contract, runtime
  links:                     # 선택
    - target: <대상 ID>
      type: <depends_on|implements|refines|constrains|traces_to|contains>
---
# <제목>

## 목적 ^purpose

<이 문서가 무엇인가>

## 구성 ^overview

<핵심 사실 — 선택>
```

## level 판단 기준

원칙: "모든 문서는 하나의 개념과 그 개념의 구성을 참조하는 완결된 정의여야 한다."

| 질문 | level | 의미 |
|------|-------|------|
| "왜 이것들이 함께 있는가?" | `group` | 묶임의 이유 설명 |
| "이 개념은 무엇인가?" | `module` | 단일 개념 + 구성 참조 |
| "이 구성 요소는 어떻게 동작하는가?" | `leaf` (생략 가능) | 최종 명세, 자식 없음 |

group → group | module (재귀 가능), module → module | leaf (재귀 가능).

검증: group/module은 contains 자식 1건 이상 필수. leaf는 contains 자식 금지.

## scope-aspect 유효 조합 (22개)

ui: layout, component, interaction
feature: func_def, scenario
flow: user_scenario, process_flow, relation
state: app_state, domain_state, system_state
constraint: tech_constraint, biz_constraint, infra_constraint
data: domain_data, system_data, external_data, prefix_schema, axis_catalog
interface: api_contract, cli_contract, event_contract

## 주소 관리

- `address` 필드는 생략 가능 — 등록(scan/sync) 시 자동 계산
- v2 주소 체계에서는 같은 scope×aspect×depth 내에서 seq가 자동 부여
- `id`는 표시 라벨 (사람이 읽는 이름), `address`는 불변 식별자
- config: `.qa-sdk/def-config.json`에 동기화 시각 + 문서 해시 기록

## 생성 후 검증

```bash
qa-sdk def sync
qa-sdk def validate    # 깨진 링크 확인
qa-sdk def audit       # purpose + level 분포 확인
qa-sdk def boundary-context <문서ID> --mode direct
qa-sdk def find-by-file <관련 코드 경로[:symbol]>
```

## 작성 규칙

- `group` 또는 `module`이면 `## 구성 ^overview`를 실제로 채우고 `contains` 자식을 가져야 한다.
- `leaf`면 `contains` 자식을 만들지 않는다.
- 개념 자체를 정의하는 지식 문서는 `type: knowledge` + `knowledge_kind: concept`를 사용한다.
- 새 문서를 생성한 뒤 실행 환경의 `~/.codex/skills/`나 DB를 직접 고치지 않는다. repo 문서와 `def sync`가 기준이다.
- 코드 경계와 실제로 맞추려면 top-level frontmatter에 `source: packages/.../file.ts[:symbol]`를 추가한다.
- 코드 파일 안에는 `@def.boundary <group-or-module-doc-id>[#symbol]` 또는 `@def.doc <module-or-leaf-doc-id>[#symbol]` 주석을 붙일 수 있다.
- 그런 뒤 `qa-sdk def sync`로 DB의 `code_references`를 갱신하고 `def find-by-file <관련 코드 경로[:symbol]>`로 확인한다.

## tags 선택 규칙

먼저 붙일 태그:

- StructuralTag: `entry-point`, `cross-scope`, `decision`
- ConcernTag: `security`, `performance`, `accessibility`, `observability`, `testing`, `migration`, `deprecation`

그 다음 필요할 때만 붙일 태그:

- 운영 관례 태그: `runtime`, `persistence`, `contract`, `versioning`
- 제품/영역 태그: `frontend`, `registry`, `motion`
- 품질 하네스 태그: `quality-bundle`, `quality-gate`, `gate-kind:*`

규칙:

- 태그는 보통 2~5개면 충분하다.
- `cross-scope`는 다중 소속이나 통합 설계 문서일 때만 쓴다.
- `entry-point`는 해당 주제의 시작 문서에만 준다.
- 자세한 taxonomy는 `docs/specs/system/tag-management.spec.md`를 따른다.
