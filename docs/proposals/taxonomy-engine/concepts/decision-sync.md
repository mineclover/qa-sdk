---
def:
  id: taxonomy-engine-decision-sync
  type: knowledge
  knowledge_kind: proposal
  lifecycle: approved
  owner_system: taxonomy-engine
  projection_plane: intent
  scope: flow
  aspect: decision_sync
  tier: component
  depth: specification
  sources:
    - packages/taxonomy-decision-bridge/src/decision-file.ts
    - packages/taxonomy-decision-bridge/src/resolve-link.ts
    - packages/taxonomy-decision-bridge/src/sync.ts
    - packages/taxonomy-decision-bridge/__tests__/resolve-link.test.ts
    - packages/taxonomy-decision-bridge/__tests__/sync.test.ts
    - packages/cli/src/commands/decision/index.ts
    - packages/cli/src/commands/decision/sync.ts
    - packages/cli/src/commands/decision.test.ts
status: implemented
date: 2026-07-05
part_of: taxonomy-engine
role: decision-sync
---

# Decision Sync — taxonomy entry와 decision markdown 동기화

> `qa-sdk decision sync`는 taxonomy yaml entry의 `lifecycle`과 decision markdown frontmatter의 `lifecycle`을 로컬 파일 시스템에서 맞춘다. decision markdown이 사람용 결정 기록이고, yaml은 taxonomy 소비자가 읽는 현재 상태다.

## 목적 ^purpose

- `lifecycle: tbd` entry가 실제 결정 파일로 이어지게 한다.
- decision이 진행되면 taxonomy yaml의 lifecycle을 따라오게 한다.
- yaml이 먼저 확정되면 decision markdown lifecycle을 따라오게 한다.
- 양쪽이 동시에 바뀐 경우에는 자동 판단하지 않고 명시 옵션으로만 해소한다.

## 파일 모델

taxonomy entry는 `decisionLink`를 가진다.

```yaml
axes:
  layer:
    entries:
      - id: cue
        address: 3
        lifecycle: tbd
        placeholderReason: "interaction 정의 미정"
        decisionLink: "decision:lesson-builder.layer.cue"
```

decision 파일은 기본적으로 `docs/decisions/<id>.md`에 둔다.

```yaml
---
id: lesson-builder.layer.cue
subject: tax:lesson-builder-content:layer.cue
lifecycle: draft
created: 2026-05-21T00:00:00Z
updated: 2026-05-21T00:00:00Z
---
```

`createDecisionSkeletonText()`는 decision 파일이 없을 때 skeleton을 만든다. skeleton의 lifecycle은 `draft`이고 질문은 `placeholderReason`을 사용한다. `placeholderReason`이 없으면 `(질문 미정)`을 사용한다.

## decisionLink 해소

`resolveDecisionLink()`가 지원하는 형식:

| 형식 | 동작 |
|------|------|
| `decision:<id>` | `docs/decisions/<id>.md`로 해소 |
| relative path | yaml 파일 디렉토리 기준 path로 해소 |
| absolute path | 그대로 path로 해소 |
| `http://...`, `https://...` | external로 분류, fetch하지 않음 |
| `decision-flow://...` | unsupported |
| `tax:...` | unsupported |

CLI `sync`, `analyze`, `render`는 external 또는 unsupported link를 건너뛴다.

## Sync 액션

`computeSyncAction()`은 yaml entry, decision file, 변경 상태, 충돌 옵션으로 액션을 결정한다.

| 조건 | 액션 |
|------|------|
| `decisionLink` 없음 | noop `no-decision-link` |
| yaml lifecycle 없음 | noop `lifecycle-missing` |
| decision 파일 없음 | `push-create` |
| yaml `tbd` + decision `draft` | noop `in-sync-tbd-draft` |
| lifecycle 동일 | noop `in-sync` |
| lifecycle 동일 + marker 변경 감지 | noop `markers-only` |
| yaml만 변경 | `pull-decision-lifecycle` |
| decision만 변경 또는 변경 상태 모름 | `pull-yaml-lifecycle` |
| yaml과 decision 모두 변경 | `conflict` |

`markers-only`는 lifecycle이 같고 `purpose`, `context`, `outcome`, `option`, `evidence`만 바뀐 경우다. 이 경우 yaml에는 반영할 값이 없으므로 CLI는 보고만 하고 commit하지 않는다.

## 충돌 해소

양쪽 모두 변경됐고 lifecycle이 다르면 기본 액션은 `conflict`다. CLI는 interactive prompt를 띄우지 않고 선택 가능한 옵션을 출력한다.

```bash
qa-sdk decision sync --accept-yaml
qa-sdk decision sync --accept-decision
qa-sdk decision sync --merge
```

| 옵션 | 동작 |
|------|------|
| `--accept-yaml` | yaml lifecycle을 decision frontmatter에 반영 |
| `--accept-decision` | decision lifecycle을 yaml entry에 반영 |
| `--merge` | yaml lifecycle 우선, decision evidence는 commit 메시지에 보존 |

## CLI

```bash
qa-sdk decision sync
qa-sdk decision sync tax:lesson-builder-content:layer.cue
qa-sdk decision sync --dry-run
qa-sdk decision sync --no-commit
qa-sdk decision sync --json
qa-sdk decision sync --accept-yaml
qa-sdk decision sync --accept-decision
qa-sdk decision sync --merge
```

동작 범위:

- `docs/taxonomies/*.yaml`을 scan한다.
- `<tax:ref>` 인자가 있으면 해당 entry만 처리한다.
- `--dry-run`은 report만 출력하고 파일을 바꾸지 않는다.
- `--no-commit`은 파일 변경은 적용하지만 git commit은 만들지 않는다.
- `--json`은 `{ dryRun, reports }`를 출력한다.

## 파일 변경과 commit

`sync`는 `--dry-run`이 아니고 액션이 적용 대상이면 파일을 수정한다.

| 액션 | 파일 변경 | commit 메시지 |
|------|-----------|---------------|
| `push-create` | decision skeleton 생성 | `chore(decision): create skeleton for <tax:ref>` |
| `pull-yaml-lifecycle` | yaml entry lifecycle 갱신 | `sync(taxonomy): <tax:ref> lifecycle → <newLifecycle>` |
| `pull-decision-lifecycle` | decision frontmatter lifecycle 갱신 | `sync(decision): <tax:ref> lifecycle → <newLifecycle>` |

기본적으로 CLI가 변경 파일을 stage하고 commit한다. commit 실패는 stderr에 출력하지만 sync report 출력은 계속된다.

`pull-yaml-lifecycle`은 decision evidence가 있으면 commit message 본문에 evidence 목록을 포함한다.

## 변경 감지

CLI는 git과 filesystem 정보로 변경 상태를 추정한다.

- working tree에 변경이 있는 파일은 changed로 본다.
- 둘 다 clean이면 마지막 commit timestamp가 더 늦은 쪽을 changed로 본다.
- 이전 decision 파일은 `git show HEAD:<path>`로 읽어서 marker 변경 여부를 비교한다.
- git 정보 읽기에 실패하면 빈 state로 fail-open하고 lifecycle 비교로 폴백한다.

이 방식은 로컬 개발용 heuristic이다. 원격 DB나 중앙 lock을 사용하지 않는다.

## 지원하지 않는 것

- external URL decisionLink fetch
- `decision-flow://` URI 해소
- `tax:` ref registry 해소
- interactive conflict prompt
- GitHub Actions cron/webhook 자동화
- DB indexing 또는 def-catalog scope 확장
- Web UI에서 직접 sync commit 생성

## 검증

대표 회귀 범위:

```bash
pnpm --filter taxonomy-decision-bridge test
pnpm --filter @qa-sdk/cli test decision.test
```

현재 문서화된 표면은 `resolve-link`, `sync`, CLI `decision sync` 테스트로 증명한다.

## 관련 문서

- [[lifecycle]] — taxonomy lifecycle과 `decisionLink`
- [[decision-flow-bridge]] — decision markdown과 `FlowSchema` 변환
- [[semver-migration]] — lifecycle/decisionLink 변경의 diff 영향
