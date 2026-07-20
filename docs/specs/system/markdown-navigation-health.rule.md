---
def:
  id: markdown-navigation-health
  type: design
  tier: system
  owner_system: definition-catalog
  scope: constraint
  aspect: tech_constraint
  depth: specification
  lifecycle: approved
  layer: operation
  tags: [structural, convention, link-graph]
  links:
    - target: definition-catalog-spec
      type: constrains
    - target: link-type-usage
      type: refs
sources:
  - .hyalo.toml
  - packages/definition-catalog/src/validate.ts
  - packages/definition-data-source/src/scan-data-source.ts
---

# Markdown Navigation Health

## 목적 ^purpose

Markdown 파일 사이의 물리적 navigation link health를 점검하되, qa-sdk definition graph의 semantic ownership과 link type을 다른 도구가 재해석하지 않도록 책임 경계를 고정한다.

## 책임 경계 ^constraint

문서에는 서로 다른 링크 층이 공존한다.

| 링크 층 | 예시 | SSOT | 검증 도구 |
|---|---|---|---|
| Definition graph | `def.links[].target`, `link type`, `owner_system` | 문서 `def:` frontmatter | `def sync`, `def validate` |
| Markdown navigation | `[문서](./path.md)`, `[[문서]]` | Markdown 본문 | Hyalo `links`, `backlinks` |
| Source evidence | `sources: packages/...`, `@def.boundary` | 코드와 문서의 explicit mapping | `def find-by-file`, `def validate` |

Hyalo는 Markdown navigation 층만 담당한다. `def.links`를 `depends_on`, `refines`, `refs` 등으로 변환하거나 `owner_system`, `domain_root`, `sources`를 자동 수정하지 않는다.

## 경로 기준 ^constraint

문서 본문의 내부 Markdown 링크는 링크를 작성한 source 파일을 기준으로 한 상대경로를 사용한다. 문서 이동 시 링크도 함께 갱신하며 `/Users/...`, `/docs/...`, `/packages/...` 같은 환경·vault 기준 absolute link는 새로 만들지 않는다.

- `docs/**` 안의 문서 링크: source 기준 상대경로
- `packages/**`, `simulations/**`, `tasks/**`, `.agents/**`의 source/evidence 링크: repo 기준 상대경로를 유지하되 Hyalo docs navigation 대상에서 제외
- `def.links[].target`와 `sources` 배열: Markdown 본문 경로 규칙이 아니라 qa-sdk semantic/source contract로 검증

## 문서군별 운영 ^overview

물리적 링크 탐색은 공통으로 적용할 수 있지만, frontmatter와 본문 lint 규칙은 문서군별로 다르다.

| 문서군 | 경로 | Hyalo 운영 | 별도 규칙 |
|---|---|---|---|
| 정규 정의 | `docs/specs/**` | `links fix` dry-run, `backlinks` | `def validate` 필수 |
| 계획/가이드 | `docs/plan/**`, `docs/guides/**`, `docs/decisions/**` | navigation health 보조 | 각 문서 lifecycle/작성 규칙 |
| 제안 | `docs/proposals/**` | dry-run 보고만 허용 | proposal 규칙, template/legacy 별도 |
| 역사 기록 | `docs/archive/**`, `docs/superpowers/**` | 신규 gate에 포함하지 않음 | 보존 문서 정책 |

문서군을 섞은 전체 `hyalo lint --strict`는 운영 gate로 사용하지 않는다. 현재 proposal template과 역사 문서는 정규 spec과 다른 frontmatter 규칙을 사용하므로, 먼저 해당 문서군의 parser baseline을 정리해야 한다.

## 허용 명령 ^method

```bash
# 전체 navigation 상태 조회
hyalo summary

# 정규 spec의 broken-link 후보만 미리 확인
hyalo links fix --glob 'specs/**/*.md' --ignore-target 'packages/' --ignore-target 'simulations/' --ignore-target 'tasks/' --ignore-target '.agents/' --dry-run

# 특정 문서의 역방향 탐색
hyalo backlinks --file specs/system/link-type-usage.rule.md

# 변경 파일의 semantic graph 검증
node packages/cli/dist/index.js def sync
node packages/cli/dist/index.js def validate
```

`links fix --apply`는 exact/extension/unique-stem 후보를 사람이 확인한 뒤에만 사용한다. `--apply-fuzzy`, `links auto`, 대량 `mv`는 이 저장소의 정규 spec에 기본 허용하지 않는다. 파일을 이동한 경우에는 Hyalo 결과를 적용한 뒤 반드시 `def sync`와 `def validate`를 다시 실행한다.

## 금지 ^constraint

- Hyalo 자동 수정 결과를 `def.links`의 semantic relation으로 승격하지 않는다.
- `[[wikilink]]` 자동 생성으로 정규 spec의 기존 상대경로 prose link 규칙을 혼합하지 않는다.
- `supersedes: -` 같은 parser 차이를 Hyalo lint 결과만으로 문서 규칙 위반으로 판정하지 않는다.
- Hyalo의 orphan/dead-end 수치를 definition graph의 orphan/multi-parent 판정과 같은 지표로 합산하지 않는다.

## 검증 ^validation

```bash
node packages/cli/dist/index.js def sync
node packages/cli/dist/index.js def validate
corepack pnpm format:check:changed
```
