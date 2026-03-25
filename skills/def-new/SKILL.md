---
name: def-new
description: "definition-catalog 새 문서 생성. frontmatter + ^purpose + ^overview 형식으로 새 스펙 문서를 만든다."
---

# Definition Catalog — 새 문서 생성

frontmatter + ^purpose + ^overview 형식의 스펙 문서를 생성한다.

## 사용법

```
/def-new
```

## 문서 템플릿

```markdown
---
def:
  id: <고유 ID, kebab-case>
  scope: <ui|feature|flow|state|constraint|data|interface>
  aspect: <세부 유형>
  depth: <overview|specification|implementation|validation>
  lifecycle: approved
  svc: <serviceId>           # 선택
  tags: [<태그들>]           # 선택
  links:                     # 선택
    - target: <대상 ID>
      type: <depends_on|implements|refines|constrains|traces_to|contains>
---
# <제목>

## 목적 ^purpose

<이 문서가 무엇인가>

## 구성 ^overview

<핵심 사실 나열 — 선택>
```

## scope-aspect 유효 조합 (20개)

| scope | aspects |
|-------|---------|
| ui | layout, component, interaction |
| feature | func_def, scenario |
| flow | user_scenario, process_flow, relation |
| state | app_state, domain_state, system_state |
| constraint | tech_constraint, biz_constraint, infra_constraint |
| data | domain_data, system_data, external_data |
| interface | api_contract, cli_contract, event_contract |

## 그룹 문서

depth: overview + contains 링크. `assembleFeature()`로 조립 가능.

## 서비스 연결 (svc)

| svc | 시스템 |
|-----|--------|
| ingest-server | ingest-system |
| gate-service | gate-system |
| registry-service | registry-system |
| decode-service | decode-system |
| query-service | query-system |
| dkg-engine | dkg-system |
| qa-sdk-cli | apm-system |
| shopping-web | browser-system |
| auth | permission-system |
| platform-demo | viz-system |

## 자유 마커

`^constraint`, `^state-def`, `^update-trigger` 등 scope별 핵심 섹션용 자유 마커 사용 가능.
