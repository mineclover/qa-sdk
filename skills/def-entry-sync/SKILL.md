---
name: def-entry-sync
description: "기능 추가나 구조 변경 후 root entry 문서와 skill index를 함께 갱신한다. definition-catalog entry 문서, docs/skills/README, 관련 skill-catalog spec, 그리고 이를 뒷받침하는 code SSOT(frontmatter/validate/sync/def CLI)를 함께 확인하고 drift를 줄인다."
---

# Definition Entry Sync

기능 추가, 패싯 분리, 새로운 CLI surface, 새 skill 추가 뒤에
**root entry 문서와 skill index가 뒤처지지 않도록** 정리하는 절차다.

## 언제 쓰는가

- 새 기능을 넣고 나서 “어디를 entry point로 봐야 하는지” 다시 정리해야 할 때
- `skills/`에 새 skill을 추가했거나 기존 skill 의미가 바뀌었을 때
- `docs/specs/...-system`, `definition-catalog.spec`, `docs/skills/README`가 코드보다 늦게 따라오는 것을 막고 싶을 때
- `def validate`는 통과하지만 실제 탐색 동선이 낡았다고 느껴질 때

## 핵심 루프

```bash
pnpm --filter @qa-sdk/cli build
node packages/cli/dist/index.js def doctor       # onboarding 1차 진입점 — sync/validate/coverage/aspect/annotation 통합 헬스체크
node packages/cli/dist/index.js def sync
node packages/cli/dist/index.js def validate
node packages/cli/dist/index.js def scan-audit
node packages/cli/dist/index.js def audit-db
```

`def doctor`는 이 skill의 onboarding 1차 진입점이다. 신규 기여자는 `def sync` 전에 `def doctor`를 먼저 실행해 전체 상태를 본다.

## 최소 체크리스트

1. feature/code SSOT가 어디인지 먼저 고정한다.
2. 해당 기능의 root entry spec이 있는지 확인한다.
3. 상위 System/Layout/Pack entry 문서의 `^overview`와 `contains`/`refs`가 새 child를 반영하는지 본다.
4. `docs/skills/README.md`에 사람이 찾을 진입점이 생겼는지 본다.
5. skill을 추가했다면 `skills/<name>/SKILL.md`와 실행 환경 sync까지 확인한다.
6. command/CLI surface가 생겼다면 관련 skill-catalog spec 또는 CLI spec이 그 surface를 설명하는지 본다.

## 우선 확인할 entry 문서

- definition 전체 entry:
  `docs/specs/definition-catalog/definition-catalog.spec.md`
- definition 운영 루트:
  `docs/specs/definition-catalog/definition-management.spec.md`
- 검증 루프:
  `docs/specs/definition-catalog/definition-management/definition-mgmt-verification-loop.spec.md`
- skill index:
  `docs/skills/README.md`

기능별로는 해당 `<domain>-system`, E/C/I/S + L/P child spec, `docs/specs/skill-catalog/...`까지 같이 본다.

## code SSOT

root entry/skill index 갱신 전에 아래 코드를 먼저 본다.

- frontmatter / scan:
  `packages/definition-catalog/src/frontmatter.ts`
- graph 규칙:
  `packages/definition-catalog/src/validate.ts`
- docs → DB 적재:
  `packages/definition-data-source/src/sync-local-db.ts`
- synced view / code boundary:
  `packages/definition-data-source/src/local-data-source.ts`
- operator surface:
  `packages/cli/src/commands/def.ts`

## skill 추가/변경 시

1. `skills/<name>/SKILL.md` 수정 또는 생성
2. 필요한 경우 `docs/skills/README.md`에 진입점 추가
3. 관련 `docs/specs/skill-catalog/...` 문서 반영
4. 프로젝트 실행 환경 동기화 (전역에는 쓰지 않는다)

```bash
./scripts/sync-skills.sh
```

확인:

```bash
ls .agents/skills
ls .claude/skills
```

기본 노출 목록은 `scripts/project-skills.txt`다. 작업별 추가 스킬은 `--skill <name>`으로 선택하고, 작업 종료 후 기본 동기화로 해제한다. `skills/` 원본은 유지한다.

## 흔한 drift

- 새 child spec을 만들고 상위 System의 `contains` 또는 Layout/Pack의 `refs`를 안 건드림
- 새 skill을 만들고 `docs/skills/README.md`에는 안 적음
- CLI surface를 추가했는데 skill-catalog spec이나 command guide가 그대로임
- taxonomy 숫자, axis entry 수, lifecycle 표가 예전 값으로 남음
- 새 `*-system` stub spec을 추가하고 `docs/specs/system/system-root.md`의 카탈로그와 `docs/specs/system/system-packages.spec.md`의 패키지 매핑을 갱신하지 않음

> 참고: 사용자 지시에서 종종 "tier:layout 전환" 전제가 등장한다. 현 코드베이스에서는 새 layout 전환 사례를 고정해 인용하지 않으며, 실제 전환이 필요한 경우 `nest-service-kit` / `scaffold-system` 같은 기존 layout 패턴을 참조한다.

## 판정 기준

- root entry 문서가 현재 구조를 설명한다
- System/Interface/Component/Entry/Layout/Pack 책임이 같은 용어로 설명된다
- skill index가 새 skill/새 운영 surface를 찾게 해 준다
- `def validate`, `def scan-audit`, `def audit-db`가 모두 기대값대로 유지된다
- agent와 사람의 진입점이 서로 다른 정보를 말하지 않는다
