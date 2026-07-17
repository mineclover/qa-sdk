---
def:
  id: taxonomy-engine-codegen-output-concept
  type: knowledge
  knowledge_kind: proposal
  lifecycle: approved
  owner_system: taxonomy-engine
  projection_plane: intent
  scope: interface
  aspect: api_contract
  tier: component
  depth: specification
status: implemented
date: 2026-07-05
part_of: taxonomy-engine
role: codegen-output
sources:
  - packages/taxonomy-engine/src/codegen/index.ts
  - packages/taxonomy-engine/src/codegen/render.ts
  - packages/taxonomy-engine/src/drift/index.ts
  - packages/taxonomy-engine/src/index.ts
  - packages/taxonomy-engine/__tests__/unit/codegen.test.ts
  - packages/taxonomy-engine/__tests__/unit/drift.test.ts
  - packages/cli/src/commands/taxonomy/codegen.ts
---

# Codegen Output — IR -> TS 파일 생성

> `packages/taxonomy-engine/src/codegen/` 구현 표면. 라이브러리는 in-memory 파일 맵을 반환하고, 실제 디렉터리 쓰기는 CLI `tax codegen`이 수행한다.

## 목적 ^purpose

- `TaxonomyIR`을 결정론적인 TypeScript 산출물로 변환한다.
- 생성 파일의 content hash로 코드 산출물 drift를 감지한다.
- codegen 전에 validate error를 차단해 깨진 taxonomy가 타입 파일로 승격되지 않게 한다.

## API

```typescript
function codegen(ir: TaxonomyIR, opts?: CodegenOptions): CodegenResult

type CodegenOptions = {
  taxonomyName?: string
  generatedAt?: string
  skipValidate?: boolean
}

type CodegenResult = {
  files: Record<string, string>
  contentHash: string
}
```

`out` 경로는 라이브러리 옵션이 아니다. CLI 구현인 `packages/cli/src/commands/taxonomy/codegen.ts`가 `--out <dir>`을 해석하고 `CodegenResult.files`를 디스크에 쓴다.

## 5 출력 파일

| 파일 | 내용 | 대표 export |
|------|------|-------------|
| `axes.ts` | axis id들의 string union 타입 | `export type ScopeId = "apm" \| "ingest"` |
| `addresses.ts` | entry id -> 정수 address 매핑 | `export const SCOPE_ADDR = { ... } as const` |
| `registry.ts` | axis별 IR 메타데이터 | `export const SCOPE_ENTRIES = { ... } as const` |
| `relations.ts` | relation별 IR 메타데이터 | `export const DEPTH_CONTAINS = { ... } as const` |
| `meta.ts` | taxonomy/version/contentHash/generatedAt | `export const TAXONOMY_META = { ... } as const` |

### 파일 예시

`axes.ts`:
```typescript
// 자동 생성 파일. 수동 편집 금지. taxonomy-engine codegen 산출물.

export type ScopeId = "apm" | "ingest" | "definition";
```

`addresses.ts`:
```typescript
// 자동 생성 파일. 수동 편집 금지. taxonomy-engine codegen 산출물.

export const SCOPE_ADDR = {
  apm: 0,
  ingest: 1,
  definition: 2,
} as const;
```

`meta.ts`:
```typescript
// 자동 생성 파일. 수동 편집 금지. taxonomy-engine codegen 산출물.

export const TAXONOMY_META = {
  taxonomy: "qa-sdk-coordinate-system",
  version: 1,
  contentHash: "4c5bbd6a7a8b6a2f",
  generatedAt: "derived-from-1d9a0a2b7f2e8c4d",
} as const;
```

## contentHash 정책

taxonomy-engine codegen에는 두 hash가 관여한다.

| 이름 | 대상 | 위치 | 용도 |
|------|------|------|------|
| IR contentHash | yaml 파싱 결과 IR | `TaxonomyIR.contentHash` | taxonomy 입력 동일성 비교 |
| Codegen contentHash | `meta.ts`를 제외한 생성 파일 텍스트 | `CodegenResult.contentHash` | 생성 파일 drift 감지 |

`CodegenResult.contentHash`는 `axes.ts`, `addresses.ts`, `registry.ts`, `relations.ts`의 파일명/내용을 정렬해 sha256으로 해시한 뒤 앞 16자를 사용한다. `meta.ts`는 그 hash를 담는 파일이므로 hash 입력에서 제외된다.

`generatedAt` 기본값은 현재 시간이 아니라 `derived-from-${ir.contentHash}`다. 호출 시간이 결과에 섞이지 않아 같은 IR은 같은 산출물을 만든다. 명시적 `opts.generatedAt`이 있으면 그 값을 사용한다.

## Validate gate

codegen은 기본적으로 `validate(ir)`를 실행하고 error가 있으면 `CodegenValidationError`를 던진다.

```typescript
const errors = validate(ir).filter((d) => d.severity === "error")
if (errors.length > 0) {
  throw new CodegenValidationError(errors)
}
```

`skipValidate: true`는 이 gate만 우회한다. CLI에서 `--registry <dir>`가 있으면 cross-tax import 해소를 위해 registry 기반 validate error도 먼저 차단한다.

## Drift 감지

```typescript
function checkContentHashDrift(previous: string, current: string): Diagnostic | undefined
```

이전 실행의 codegen hash와 현재 hash가 다르면 `codegen-content-hash-mismatch` warning을 반환한다.

```typescript
const result = codegen(ir)
const drift = checkContentHashDrift(previousHash, result.contentHash)
if (drift) {
  console.warn(drift.message)
}
```

## 사용 예시

### 라이브러리 직접 호출

```typescript
import { parse, codegen } from "taxonomy-engine"

const parsed = parse(yamlText)
if ("error" in parsed) throw parsed.error

const result = codegen(parsed.ir)
console.log(result.files["axes.ts"])
console.log(result.contentHash)
```

### CLI `tax codegen`

```bash
qa-sdk tax codegen docs/taxonomies/qa-sdk-coordinate-system.yaml --out src/generated/
qa-sdk tax codegen docs/taxonomies/qa-sdk-coordinate-system.yaml --out src/generated/ --skip-validate
```

## 다른 개념과의 관계

- [data-model.md](../data-model.md) — codegen 입력 IR의 형태
- [axis.md](./axis.md) — `axes.ts` / `addresses.ts` 생성의 기반
- [taxonomy.md](./taxonomy.md) — `registry.ts` / `meta.ts` 생성의 기반
- [relation.md](./relation.md) — `relations.ts` 생성의 기반
- [cli-commands.md](./cli-commands.md) — `--out` 디스크 쓰기 소유자

## 참조

- 코드 위치: `packages/taxonomy-engine/src/codegen/`
- drift helper: `packages/taxonomy-engine/src/drift/index.ts`
- CLI `tax codegen`: `packages/cli/src/commands/taxonomy/codegen.ts`
- 테스트: `packages/taxonomy-engine/__tests__/unit/codegen.test.ts`
- drift 테스트: `packages/taxonomy-engine/__tests__/unit/drift.test.ts`

## 검증 명령 ^validation

```bash
pnpm --filter taxonomy-engine exec vitest run __tests__/unit/codegen.test.ts __tests__/unit/drift.test.ts
node packages/cli/dist/index.js def validate
pnpm arch:feedback
```
