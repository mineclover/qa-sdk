# CLI Commands Reference

> 7 명령 + 옵션 매트릭스. 라이브러리 API 위의 thin wrapper.
> 라이브러리 API 전체 목록: [api-surface.md](../api-surface.md).

## 명령 표

| 명령 | 입력 | 옵션 | 라이브러리 함수 | 진단 |
|------|------|------|---------------|------|
| `tax help` | — | — | — | — |
| `tax validate <file>` | yaml 경로 | `--strict --json --registry <dir>` | `parse` + `validate` | exit 1 if errors > 0 |
| `tax show <file> <ref>` | yaml + 3-tier ref | `--json` | `parse` + `show` | exit 1 if unresolved |
| `tax show <ref>` | 3-tier ref (registry 참조) | `--registry <dir> --json` | `loadRegistryDir` + `show` | 동상 |
| `tax codegen <file> --out <dir>` | yaml + 출력 dir | `--skip-validate --registry <dir> --json` | `parse` + `(validate)` + `codegen` | exit 1 if errors > 0 |
| `tax diff <a> <b>` | 두 yaml 경로 | `--registry <dir> --json` | `parse(a)` + `parse(b)` + `diff` | exit 0 |
| `tax doctor <file>` | yaml 경로 | `--expected <file> \| --auto --json` | `parse` + `doctor` (auto면 `extract-*`) | exit 1 if errors > 0 |
| `tax git-diff [base]` | git base ref (기본 `main`) | `--json` | git diff + `parse(base/current)` + `diff` | exit 1 if base 누락 |

## 옵션 매트릭스

| 옵션 | validate | show | codegen | diff | doctor | git-diff |
|------|:--------:|:----:|:-------:|:----:|:------:|:--------:|
| `--json` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `--registry <dir>` | ✓ | ✓ | ✓ | ✓ | — | — |
| `--strict` | ✓ | — | — | — | — | — |
| `--skip-validate` | — | — | ✓ | — | — | — |
| `--expected <file>` | — | — | — | — | ✓ | — |
| `--auto` | — | — | — | — | ✓ | — |
| `--out <dir>` | — | — | ✓ (필수) | — | — | — |

## --auto 매핑 (doctor)

yaml basename → extract source 자동 매핑. 코드: `packages/cli/src/commands/taxonomy.ts`.

| yaml basename | SSOT source | extractor |
|---------------|-------------|-----------|
| `dkg-schema.yaml` | `docs/specs/dkg-system/dkg-{node,edge}-types.spec.md` | `extractDkgExpected` |
| `ingest-coords.yaml` | `docs/specs/ingest/ingest-infra-system/store-adapter-parity.spec.md` | `extractIngestExpected` |
| `qa-sdk-def-catalog.yaml` | `packages/definition-catalog/src/vocabulary.ts` | `extractVocabExpected` |
| 기타 | — | `--expected <file>` 명시 필요 |

자동 추출 함수 상세: [auto-extract.md](./auto-extract.md)

## 출력 형식

### 텍스트 (기본)

```
✔ qa-sdk-coordinate-system v1: 0 errors, 0 warnings

  WARN capacity-headroom
       qa-sdk-coordinate-system#/axes/scope
       entries=8, capacity=8 (need ≥ 16)
       hint: capacity를 16 이상으로 올리거나 entries를 분할하세요

  ERR  ref-broken
       qa-sdk-coordinate-system#/relations/depth-contains/rules/3
       lower="missing-entry" — axes/depth/entries에 없음
```

규칙:
- ✔ 통과: `✔ <메시지>`
- WARN: `WARN <code>\n  <ref>\n  <message>\n  hint: <hint>`
- ERR: `ERR  <code>\n  <ref>\n  <message>\n  hint: <hint>`

### JSON (`--json`)

각 명령별 JSON 출력 형식:

**validate**:
```json
[
  {
    "severity": "error",
    "code": "ref-broken",
    "message": "lower=\"missing-entry\" — axes/depth/entries에 없음",
    "ref": "qa-sdk-coordinate-system#/relations/depth-contains/rules/3"
  }
]
```
타입: `Diagnostic[]`

**show**:
```json
{
  "kind": "entry",
  "taxonomy": "qa-sdk-coordinate-system",
  "axis": "scope",
  "value": { "id": "apm", "address": 0 }
}
```
타입: `RefResult`

**codegen**:
```json
{
  "contentHash": "sha256:abc123...",
  "files": ["axes.ts", "addresses.ts", "registry.ts", "relations.ts", "meta.ts"]
}
```

**diff**:
```json
{
  "same": false,
  "changes": [
    { "kind": "entry-added", "axis": "scope", "entry": "new-service" }
  ],
  "validate": {
    "a": [],
    "b": [{ "severity": "warning", "code": "capacity-headroom", ... }]
  }
}
```
(`validate` 키는 `--registry <dir>` 있을 때만 포함)

**doctor**:
```json
[
  { "severity": "error", "code": "doctor-missing", "meta": { "axis": "node-type", "missing": ["new-node"] } }
]
```
타입: `Diagnostic[]`

**git-diff**:
```json
{
  "base": "main",
  "changes": [
    {
      "file": "docs/taxonomies/dkg-schema.yaml",
      "status": "modified",
      "changes": [
        { "kind": "entry-added", "axis": "node-type", "entry": "workflow-engine" }
      ]
    },
    {
      "file": "docs/taxonomies/ingest-coords.yaml",
      "status": "added"
    }
  ]
}
```

## 사용 시나리오

### 일상 검증

```bash
qa-sdk tax validate docs/taxonomies/my.yaml
```

### cross-tax 검증 (import 사용 yaml)

```bash
qa-sdk tax validate docs/taxonomies/derived.yaml --registry docs/taxonomies/
```

### codegen + 출력

```bash
qa-sdk tax codegen docs/taxonomies/qa-sdk-coordinate-system.yaml --out src/generated/
```

### entry 조회 (CLI에서 직접)

```bash
qa-sdk tax show docs/taxonomies/qa-sdk-coordinate-system.yaml scope.apm
qa-sdk tax show qa-sdk-coordinate-system:scope.apm --registry docs/taxonomies/
```

### SSOT drift 자동 점검

```bash
# dkg-schema.yaml의 DKG 노드/엣지 spec과 drift 검출
qa-sdk tax doctor docs/taxonomies/dkg-schema.yaml --auto

# 직접 expected JSON 지정
qa-sdk tax doctor docs/taxonomies/my.yaml --expected expected.json
```

### PR 리뷰 (변경 자동 표시)

```bash
# main 대비 변경된 yaml 모두 diff
qa-sdk tax git-diff main

# JSON으로 파싱 (CI 스크립트)
qa-sdk tax git-diff main --json | jq '.changes[].changes[].kind'
```

### 두 yaml 직접 비교

```bash
qa-sdk tax diff docs/taxonomies/v1.yaml docs/taxonomies/v2.yaml
qa-sdk tax diff docs/taxonomies/v1.yaml docs/taxonomies/v2.yaml --json
```

## exit code 정책

| exit code | 의미 | 명령 |
|-----------|------|------|
| 0 | 성공 / 정상 | 모든 명령 |
| 1 | errors > 0 | validate, show (unresolved), codegen, doctor |
| 1 | base ref 누락 | git-diff |
| 0 | diff만 있고 error 없음 | diff (변경 있어도 exit 0) |

## 참조

- 명령 코드: `packages/cli/src/commands/taxonomy.ts` (T-M1에서 분리 예정)
- 명령 등록: `packages/cli/src/command-groups/taxonomy.commands.ts`
- 라이브러리 API: [api-surface.md](../api-surface.md)
- 진단 코드 전체: [diagnostics-catalog.md](./diagnostics-catalog.md)
- query 함수 (show/slice/walk): [query.md](./query.md)
- doctor 상세: [doctor.md](./doctor.md)
- diff 상세: [diff.md](./diff.md)
- codegen 상세: [codegen-output.md](./codegen-output.md)
- auto-extract 상세: [auto-extract.md](./auto-extract.md)
- v0.2 계획 (validate/show): [plans/v0.2.md](../plans/v0.2.md) §T-C1, T-C2
- v0.4 계획 (codegen/diff): [plans/v0.4.md](../plans/v0.4.md) §T-F3, T-F4, T-F5
- v0.6 계획 (doctor/git-diff): [plans/v0.6.md](../plans/v0.6.md) §T-J1, T-J4
