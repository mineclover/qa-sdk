---
def:
  id: taxonomy-engine-cli-commands-concept
  type: knowledge
  knowledge_kind: proposal
  lifecycle: approved
  owner_system: taxonomy-engine
  projection_plane: intent
  scope: interface
  aspect: cli_contract
  tier: component
  depth: specification
status: implemented
date: 2026-07-05
part_of: taxonomy-engine
role: cli-commands
sources:
  - packages/cli/src/commands/taxonomy/index.ts
  - packages/cli/src/commands/taxonomy/help.ts
  - packages/cli/src/commands/taxonomy/validate.ts
  - packages/cli/src/commands/taxonomy/show.ts
  - packages/cli/src/commands/taxonomy/codegen.ts
  - packages/cli/src/commands/taxonomy/diff.ts
  - packages/cli/src/commands/taxonomy/git-diff.ts
  - packages/cli/src/commands/taxonomy/migration.ts
  - packages/cli/src/commands/taxonomy/doctor.ts
  - packages/cli/src/commands/taxonomy.test.ts
---

# CLI Commands Reference

> 8개 `tax` 하위 명령의 현재 구현 표면. 라이브러리 API 위의 thin wrapper이며, 파일 시스템과 git I/O는 CLI 레이어가 소유한다.
> 라이브러리 API 전체 목록: [api-surface.md](../api-surface.md).

## 목적 ^purpose

- taxonomy yaml 검증, 조회, 생성, drift 점검을 운영자가 같은 진입점으로 실행한다.
- 라이브러리의 순수 함수 경계를 유지하면서 파일/registry/git 작업은 CLI에서만 처리한다.
- CI와 리뷰 도구가 `--json` 출력으로 동일한 진단과 diff 구조를 소비하게 한다.

## 명령 표

| 명령 | 입력 | 옵션 | 구현 함수 | 핵심 라이브러리 함수 | 실패 조건 |
|------|------|------|-----------|---------------------|-----------|
| `tax validate <file>` | yaml 경로 | `--registry <dir> --strict --lifecycle-strict --json` | `validateCmd` | `parse` + `validate` | parse 실패 또는 error 진단 |
| `tax show <file> <ref>` | yaml + 3-tier ref | `--json` | `showCmd` | `parse` + `show` | ref 미해소 |
| `tax show <ref>` | registry ref | `--registry <dir> --json` | `showCmd` | `loadRegistryDir` + `show` | ref 미해소 |
| `tax codegen <file> --out <dir>` | yaml + 출력 dir | `--registry <dir> --skip-validate --json` | `codegenCmd` | `parse` + `validate` + `codegen` | parse 실패, `--out` 누락, validate error |
| `tax diff <a> <b>` | 두 yaml 경로 | `--registry <dir> --semver --json` | `diffCmd` | `parse(a)` + `parse(b)` + `diff` | parse 실패, `--semver` major |
| `tax git-diff [base]` | git base ref | `--json` | `gitDiffCmd` | git diff + `parse` + `diff` | base 조회 실패 |
| `tax migration --base <ref> <file>` | base ref + yaml 경로 | `--json` | `migrationCmd` | `parse` + `diff` + `migrationPlan` | base/current 조회 또는 parse 실패 |
| `tax doctor <file>` | yaml 경로 | `--expected <file> \| --auto --json` | `doctorCmd` | `parse` + `doctor` + `extract-*` | expected 누락, auto 매핑 실패, error 진단 |
| `tax help` | - | - | `printHelp` | - | - |

## 옵션 매트릭스

| 옵션 | validate | show | codegen | diff | git-diff | migration | doctor |
|------|:--------:|:----:|:-------:|:----:|:--------:|:---------:|:------:|
| `--json` | yes | yes | yes | yes | yes | yes | yes |
| `--registry <dir>` | yes | yes | yes | yes | no | no | no |
| `--strict` | yes | no | no | no | no | no | no |
| `--lifecycle-strict` | yes | no | no | no | no | no | no |
| `--skip-validate` | no | no | yes | no | no | no | no |
| `--semver` | no | no | no | yes | no | no | no |
| `--base <ref>` | no | no | no | no | no | yes | no |
| `--expected <file>` | no | no | no | no | no | no | yes |
| `--auto` | no | no | no | no | no | no | yes |
| `--out <dir>` | no | no | required | no | no | no | no |

## --auto 매핑 (doctor)

yaml basename -> extract source 자동 매핑. 구현 위치는 `packages/cli/src/commands/taxonomy/doctor.ts`.

| yaml basename | SSOT source | extractor |
|---------------|-------------|-----------|
| `dkg-schema.yaml` | `docs/specs/dkg-system/dkg-node-types.spec.md`, `docs/specs/dkg-system/dkg-edge-types.spec.md` | `extractDkgExpected` |
| `ingest-coords.yaml` | `docs/specs/ingest/ingest-infra-system/store-adapter-parity.spec.md` | `extractIngestExpected` |
| `qa-sdk-def-catalog.yaml` | `packages/definition-catalog/src/vocabulary.ts` | `extractVocabExpected` |
| 기타 | - | `--expected <file>` 명시 필요 |

자동 추출 함수 상세: [auto-extract.md](./auto-extract.md)

## JSON 출력 형식

**validate, doctor**: `Diagnostic[]`

**show**: `RefResult | undefined`

**codegen**:
```json
{
  "contentHash": "4c5bbd6a7a8b6a2f",
  "files": ["src/generated/axes.ts", "src/generated/addresses.ts", "src/generated/registry.ts", "src/generated/relations.ts", "src/generated/meta.ts"]
}
```

**diff**:
```json
{
  "same": false,
  "changes": [
    { "kind": "entry-added", "axis": "scope", "id": "new-service", "address": 8 }
  ],
  "breakingLevel": "minor",
  "validate": {
    "a": [],
    "b": []
  }
}
```
`validate` 값은 `--registry <dir>`가 있을 때 수집된다.

**git-diff**:
```json
{
  "base": "main",
  "changes": [
    {
      "file": "docs/taxonomies/dkg-schema.yaml",
      "status": "modified",
      "changes": [
        { "kind": "entry-added", "axis": "node-type", "id": "workflow-engine", "address": 15 }
      ]
    }
  ]
}
```

**migration**:
```json
{
  "base": "main",
  "file": "docs/taxonomies/my.yaml",
  "diff": { "same": false, "breakingLevel": "major", "changeCount": 2 },
  "plan": {
    "idRenames": [],
    "addressConflicts": [],
    "manualReview": [],
    "decisionImpact": []
  }
}
```

## 사용 시나리오

### 일상 검증

```bash
qa-sdk tax validate docs/taxonomies/my.yaml
```

### lifecycle 필수 게이트

```bash
qa-sdk tax validate docs/taxonomies/my.yaml --lifecycle-strict
```

### cross-tax 검증

```bash
qa-sdk tax validate docs/taxonomies/derived.yaml --registry docs/taxonomies/
```

### codegen + 출력

```bash
qa-sdk tax codegen docs/taxonomies/qa-sdk-coordinate-system.yaml --out src/generated/
```

### entry 조회

```bash
qa-sdk tax show docs/taxonomies/qa-sdk-coordinate-system.yaml scope.apm
qa-sdk tax show qa-sdk-coordinate-system:scope.apm --registry docs/taxonomies/
```

### SSOT drift 자동 점검

```bash
qa-sdk tax doctor docs/taxonomies/dkg-schema.yaml --auto
qa-sdk tax doctor docs/taxonomies/my.yaml --expected expected.json
```

### 리뷰/마이그레이션

```bash
qa-sdk tax git-diff main
qa-sdk tax diff docs/taxonomies/v1.yaml docs/taxonomies/v2.yaml --semver
qa-sdk tax migration --base main docs/taxonomies/my.yaml
```

## exit code 정책

| exit code | 의미 | 명령 |
|-----------|------|------|
| 0 | 성공 / 정상 | 모든 명령 |
| 1 | parse 실패 또는 error 진단 | validate, show, codegen, doctor |
| 1 | major 변경 감지 | diff `--semver` |
| 1 | base ref 또는 파일 조회 실패 | git-diff, migration |
| 0 | diff만 있고 error 없음 | diff |

## 참조

- 명령 코드: `packages/cli/src/commands/taxonomy/*.ts`
- 명령 라우터: `packages/cli/src/commands/taxonomy/index.ts`
- 도움말: `packages/cli/src/commands/taxonomy/help.ts`
- 라이브러리 API: [api-surface.md](../api-surface.md)
- 진단 코드 전체: [diagnostics-catalog.md](./diagnostics-catalog.md)
- query 함수: [query.md](./query.md)
- doctor 상세: [doctor.md](./doctor.md)
- diff 상세: [diff.md](./diff.md)
- codegen 상세: [codegen-output.md](./codegen-output.md)
- auto-extract 상세: [auto-extract.md](./auto-extract.md)

## 검증 명령 ^validation

```bash
pnpm --filter @qa-sdk/cli test taxonomy.test
node packages/cli/dist/index.js def validate
pnpm arch:feedback
```
