---
def:
  id: programming-artifact-ontology-development-guide
  type: knowledge
  knowledge_kind: guide
  level: leaf
  scope: constraint
  aspect: tech_constraint
  depth: specification
  lifecycle: draft
  layer: operation
  tags: [structural, contract, testing]
sources:
  - docs/specs/operational-ontology/programming-artifact-ontology-system.spec.md
  - packages/operational-ontology/src/internal/programming-artifact-core.ts
  - packages/cli/src/commands/ontology.ts
---

# Programming Artifact Ontology Development Guide — 지속 개발 컨텍스트 확인

## 목적 ^purpose

`programming-artifact-ontology`를 지속 개발할 때 세션마다 같은 문서와 코드 경계를 확인하게 만드는 표준 개발 지침을 정의한다. 목표는 artifact vocabulary, registry provider, prompt extraction CLI, plan/todo가 서로 다른 속도로 drift되는 것을 막고, 다음 세션 handoff가 바로 실행 가능한 상태를 유지하는 것이다.

## 컨텍스트 확인 순서 ^defines

작업 시작 전에는 아래 순서로 읽는다.

1. `docs/specs/operational-ontology/programming-artifact-ontology-system.spec.md`
   module entry다. 현재 vocabulary, pack schema, provider contract를 먼저 확인한다.
2. `docs/specs/operational-ontology/programming-artifact-ontology-plan.plan.md`
   장기 단계와 이번 단계의 위치를 확인한다. 새 작업이 단계 밖이면 plan부터 갱신한다.
3. `docs/specs/operational-ontology/programming-artifact-ontology-todo.todo.md`
   이번 세션에서 완료할 체크박스를 고른다. 완료된 작업은 체크하고 남은 항목은 더 작게 쪼갠다.
4. `docs/specs/operational-ontology/programming-artifact-ontology-cli.spec.md`
   CLI surface와 registry JSON shape를 확인한다. command나 flag를 바꾸면 이 문서를 먼저 갱신한다.
5. `docs/specs/operational-ontology/operational-ontology-prompt-artifact-generation.spec.md`
   artifact extraction이 prompt artifact plane에 어떻게 들어가는지 확인한다.
6. `packages/operational-ontology/src/internal/programming-artifact-core.ts`
   vocabulary, pack, registry store, provider 구현의 SSOT다.
7. `packages/operational-ontology/src/programming-artifacts.test.ts`
   pack validation과 provider behavior의 살아있는 예시다.
8. `packages/cli/src/commands/ontology.ts`
   `extract-artifact` CLI routing과 fallback 순서의 SSOT다.

## 문서 구조 보강 방식

문서 역할을 아래처럼 나눈다.

| 문서 | 역할 | 갱신 조건 |
|------|------|-----------|
| `programming-artifact-ontology-system.spec.md` | module entry, pack/vocabulary/provider 핵심 정의 | 새 child 문서, 새 axis/relation, provider contract 변경 |
| `programming-artifact-ontology-development-guide.spec.md` | 세션 시작 컨텍스트 확인 순서와 개발 규칙 | 작업 순서, 검증 명령, handoff 규칙 변경 |
| `programming-artifact-ontology-cli.spec.md` | CLI surface와 registry 파일 계약 | command, flag, JSON shape, fallback 규칙 변경 |
| `programming-artifact-ontology-plan.plan.md` | 장기 단계와 다음 milestone | 단계 순서나 목표 변경 |
| `programming-artifact-ontology-todo.todo.md` | 실행 체크박스 | 세션 단위 작업 추가/완료 |

새 문서를 만들 때는 `programming-artifact-ontology-system`의 `contains`에 먼저 연결한다. leaf 문서가 150줄을 넘거나 두 개 이상의 개념을 다루면 module + leaf로 분할한다.

## 변경 유형별 필수 확인

| 변경 유형 | 필수 확인 |
|-----------|-----------|
| artifact kind 추가 | 5Q checklist, `PROGRAMMING_ARTIFACT_KINDS`, pack axis capacity, system spec vocabulary table, tests |
| artifact relation 추가 | 5Q checklist, `PROGRAMMING_ARTIFACT_RELATION_KINDS`, relation category, provider relation mapping, CLI spec |
| registry record field 추가 | `ProgrammingArtifactRegistryRecord`, CLI registry JSON contract, provider extraction, sample/test record |
| provider behavior 변경 | `ArtifactRegistryPromptArtifactContextProvider`, prompt artifact generation spec, provider tests |
| CLI flag 변경 | `programming-artifact-ontology-cli`, command descriptor, help text, CLI tests if command parsing changes |
| export command integration | source command spec, produced_by/derived_from/verifies/owned_by_definition/materializes_output mapping, registry write test |
| governance closure 변경 | production factory spec, quality status source, persisted governance evidence, release verification use case |

## Registry Record 표준

artifact registry record를 생성할 때는 가능한 한 아래 필드를 채운다.

- `artifactId` — stable kebab-case id. 파일명 변경과 독립되어야 한다.
- `artifactRef` — 사용자가 CLI에 넣을 수 있는 대표 ref.
- `kind` — `build`, `generated-source`, `quality-status`, `deployment-output`, `prompt-artifact` 중 하나.
- `producedByRef` — 명령, gate, governance run ref. `produced_by` relation으로 변환된다.
- `derivedFromRefs` — 입력 source/artifact refs. `derived_from` relation으로 변환된다.
- `verifiesRefs` — 검증 대상 definition/gate/artifact. `verifies` relation으로 변환된다.
- `ownerDefinitionId` — 변경 책임 definition. `owned_by_definition` relation으로 변환된다.
- `materializesOutputRefs` — 구체화한 blueprint/output/release target. `materializes_output` relation으로 변환된다.
- `sourceRefs`, `outputPath`, `verificationRefs` — prompt extraction 품질과 governance closure를 높이는 보조 surface다.

필드를 모르면 빈 문자열로 채우지 않는다. 모르는 값은 생략하고, todo에 relation 보강 항목을 남긴다.

현재 concrete write path는 `qa-sdk codegen --artifact-registry <file>`, `qa-sdk quality export ... --artifact-registry=<file>`, `infra deploy ... --artifact-registry <file>`, `qa-sdk ontology prompt extract* --output <file|dir> --artifact-registry <file>`, `qa-sdk ontology artifact registry append --kind build ...`이다.

## Handoff 규칙

다음 세션 prompt는 다음 구조로 남긴다.

```text
programming-artifact-ontology 기준으로 계속 진행해줘.

먼저 아래 순서로 context를 확인해:
1. programming-artifact-ontology-system.spec.md
2. programming-artifact-ontology-plan.plan.md
3. programming-artifact-ontology-todo.todo.md
4. programming-artifact-ontology-cli.spec.md
5. programming-artifact-ontology-development-guide.spec.md

이번 세션 목표:
- <todo 항목 1>
- <todo 항목 2>

검증:
- pnpm --filter operational-ontology typecheck
- pnpm --filter operational-ontology test
- pnpm --filter operational-ontology build
- CLI 영향은 `@qa-sdk/cli typecheck`와 관련 CLI 테스트를 함께 실행한다.
```

## 검증 명령

기능 변경 후 기본 검증은 아래 순서로 실행한다.

```bash
pnpm --filter operational-ontology typecheck
pnpm --filter operational-ontology test
pnpm --filter operational-ontology build
pnpm --filter @qa-sdk/cli typecheck
pnpm --filter @qa-sdk/cli test -- ontology codegen quality
node packages/cli/dist/index.js def validate
```
