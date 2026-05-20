# Codegen Output — IR → TS 파일 생성

> `src/codegen/` 모듈 spec. v0.1부터 존재, v0.4에서 CLI로 노출.

## 정의

**TaxonomyIR을 입력 받아 결정론적으로 5개의 TypeScript 파일을 생성**하는 모듈. 같은 IR → 항상 같은 파일. contentHash로 drift 감지.

## API

```typescript
function codegen(ir: TaxonomyIR, opts: CodegenOptions): CodegenResult

type CodegenOptions = {
  out?: string           // 출력 디렉토리 경로 (없으면 in-memory)
  skipValidate?: boolean // validate gate 우회 (기본 false)
}

type CodegenResult = {
  contentHash: string              // IR 기반 hash (결정론)
  files: Record<string, string>    // 파일명 → TS 소스 텍스트
}
```

## 5 출력 파일

| 파일 | 내용 | 예시 |
|------|------|------|
| `axes.ts` | axis id들의 string union 타입 | `export type ScopeId = 'apm' \| 'ingest' \| ...` |
| `addresses.ts` | entry id → 정수 address 매핑 | `export const SCOPE_ADDR = { apm: 0, ingest: 1, ... }` |
| `registry.ts` | axis별 entries 메타데이터 배열 | `export const TAXONOMY_REGISTRY = { scope: [...], ... }` |
| `relations.ts` | relation rules 배열 | `export const RELATIONS = { 'depth-contains': [...] }` |
| `meta.ts` | contentHash + 생성 메타 | `export const META = { contentHash: '...', generatedAt: '...' }` |

### 파일 예시 (qa-sdk-coordinate-system 기준)

`axes.ts`:
```typescript
// 자동 생성 — 직접 수정 금지. 소스: docs/taxonomies/qa-sdk-coordinate-system.yaml
export type ScopeId = 'apm' | 'ingest' | 'registry' | 'gate' | 'query' | 'decode' | 'definition' | 'decision'
export type AspectId = 'model' | 'protocol' | 'runtime' | 'policy' | 'ops' | 'io'
export type DepthId = 'overview' | 'system' | 'layer' | 'component' | 'entry'
export type LevelId = 'group' | 'module' | 'leaf'
export type LayerId = 'domain' | 'operation' | 'mediation' | 'experience'
```

`addresses.ts`:
```typescript
export const SCOPE_ADDR: Record<ScopeId, number> = { apm: 0, ingest: 1, registry: 2, ... }
export const ASPECT_ADDR: Record<AspectId, number> = { model: 0, protocol: 1, ... }
```

`meta.ts`:
```typescript
export const META = {
  taxonomy: 'qa-sdk-coordinate-system',
  version: 1,
  contentHash: 'sha256:abc123...',   // IR contentHash
  generatedAt: '2026-05-21T00:00:00Z',
}
```

## 두 contentHash

taxonomy-engine의 codegen에는 두 종류의 contentHash가 관여:

| 이름 | 대상 | 위치 | 용도 |
|------|------|------|------|
| IR contentHash | IR 전체 (yaml 파싱 결과) | `TaxonomyIR.contentHash` | IR 동일성 비교 |
| Codegen contentHash | 생성된 5 파일 텍스트 | `CodegenResult.contentHash` | 파일 drift 감지 |

보통 두 hash는 같은 IR → 같은 값. 단 codegen 로직 변경 시 IR은 같아도 codegen hash가 다를 수 있음.

## Validate gate

codegen은 기본적으로 실행 전 `validate(ir)` 수행:

```typescript
// skipValidate=false (기본)
const diags = validate(ir)
if (diags.some(d => d.severity === 'error')) {
  throw new CodegenValidationError(diags)
}
```

`skipValidate: true`로 우회 가능하지만, 실제 drift 위험 차단을 위해 CI에서는 항상 validate gate 사용 권장.

## Drift 감지 (`checkContentHashDrift`)

```typescript
function checkContentHashDrift(previous: string, current: string): Diagnostic | undefined
```

이전 실행의 contentHash와 현재를 비교해 변경이 있으면 `codegen-content-hash-mismatch` warning 반환.

CI 스크립트 활용:
```typescript
// scripts/tax-codegen-drift.mjs
const lockfile = JSON.parse(readFileSync('.codegen-hashes.json'))
const result = codegen(ir, { out: 'mem' })
const drift = checkContentHashDrift(lockfile[taxonomy], result.contentHash)
if (drift) { console.warn(drift.message); process.exit(1) }
```

lockfile: `docs/taxonomies/.codegen-hashes.json` (git 추적 대상).

## 사용 예시

### 라이브러리 직접 호출

```typescript
import { parse, codegen } from 'taxonomy-engine'

const ir = parse(readFileSync('qa-sdk-coordinate-system.yaml', 'utf8')).ir
const result = codegen(ir, { out: 'src/generated/' })
// src/generated/ 아래 5 파일 생성
console.log(result.contentHash)
```

### CLI `tax codegen`

```bash
qa-sdk tax codegen docs/taxonomies/qa-sdk-coordinate-system.yaml --out src/generated/
# validate 통과 후 5 파일 생성
# 실패 시 exit 1
```

```bash
qa-sdk tax codegen my.yaml --out out/ --skip-validate
# validate 건너뜀 (non-CI 환경)
```

## 다른 개념과의 관계

- [data-model.md](../data-model.md) — codegen 입력 IR의 형태
- [axis.md](./axis.md) — `axes.ts` / `addresses.ts` 생성의 기반
- [taxonomy.md](./taxonomy.md) — `registry.ts` / `meta.ts` 생성의 기반
- [relation.md](./relation.md) — `relations.ts` 생성의 기반

## 참조

- 코드 위치: `packages/taxonomy-engine/src/codegen/`
- 테스트 (골든): `packages/taxonomy-engine/__tests__/fixtures/codegen-basic.yaml` + `.golden.ts`
- CLI `tax codegen`: [cli-commands.md](./cli-commands.md)
- CI drift 스크립트: `scripts/tax-codegen-drift.mjs`
- contentHash lockfile: `docs/taxonomies/.codegen-hashes.json`
- v0.1 계획: [plans/v0.1.md](../plans/v0.1.md) (codegen 기반 설계)
- v0.4 계획: [plans/v0.4.md](../plans/v0.4.md) §T-F3 (CLI 노출)
