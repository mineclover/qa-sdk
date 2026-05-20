# API Surface

> 00-design.md §6 분리. v0.7 모듈화 (T-L1).

CLI 표면을 미리 박지 않는다. 라이브러리 API가 1급이고 CLI는 그 위의 최소 진입점. 사용 경험으로 명령이 자라난다.

## 6.1 라이브러리 public API (taxonomy-engine)

```typescript
// schema — IR 타입 + Diagnostic
export type {
  TaxonomyIR, AxisIR, EntryIR, RelationIR, ConstraintIR,
  TaxonomyRef, Diagnostic, ValidateOptions, RefResult,
  DiffEntry, ExpectedTaxonomy, CodegenResult, CodegenOptions,
}
export { TaxonomyDocSchema }

// parse — yaml 텍스트 → IR (구조 검증 only, I/O 없음)
export function parse(yamlText: string): { ir: TaxonomyIR } | { error: ParseError }

// validate — 의미 검증 (capacity, constraint, ref, axis 5Q)
export function validate(
  ir: TaxonomyIR,
  registry?: TaxonomyRegistry,
  opts?: ValidateOptions,
): Diagnostic[]

// query — 단위 조회 + 순회 (concepts/query.md 참조)
export function show(ref: string, registry: TaxonomyRegistry): RefResult | undefined
export function slice(ir: TaxonomyIR, axisName: string, range?: SliceRange): EntryIR[]
export function walkRelation(ir: TaxonomyIR, relName: string, startId: string): IterableIterator<string>
export function walkByCoordinate(ir: TaxonomyIR, relName: string, startCoord: Coordinate): IterableIterator<Coordinate>

// ref grammar (concepts/reference-grammar.md 참조)
export function parseRef(ref: string): TaxonomyRef
export function resolveRef(ref: TaxonomyRef, registry: TaxonomyRegistry): RefResult | undefined

// indexing
export function indexAxis(axis: AxisIR): IndexedAxis
export function packCoordinate(coord: Coordinate, axes: AxisIR[]): number
export function unpackCoordinate(packed: number, axes: AxisIR[]): Coordinate

// codegen (concepts/codegen-output.md 참조)
export function codegen(ir: TaxonomyIR, opts: CodegenOptions): CodegenResult
export function checkContentHashDrift(previous: string, current: string): Diagnostic | undefined

// doctor (concepts/doctor.md 참조)
export function doctor(ir: TaxonomyIR, expected: ExpectedTaxonomy): Diagnostic[]

// diff (concepts/diff.md 참조)
export function diff(a: TaxonomyIR, b: TaxonomyIR): { same: boolean; changes: DiffEntry[] }

// multi-taxonomy registry
export class TaxonomyRegistry {
  add(ir: TaxonomyIR): void
  get(taxonomy: string): TaxonomyIR | undefined
  list(): string[]
  loadDir(dirPath: string): void   // CLI 전용 helper (I/O 포함)
}
```

**원칙**
- 모두 순수 함수 (TaxonomyRegistry 외)
- 파일 I/O 없음 — 모든 입력은 yaml 텍스트 또는 IR
- 사용자가 라이브러리만으로 ad-hoc 스크립트 작성 가능

## 6.2 CLI 명령 (v0.2~v0.6 누적)

라이브러리 위의 thin wrapper. 상세: [concepts/cli-commands.md](./concepts/cli-commands.md).

| 명령 | 추가 버전 | 핵심 라이브러리 함수 |
|------|----------|-------------------|
| `tax validate <file>` | v0.2 | `parse` + `validate` |
| `tax show <file> <ref>` | v0.2 | `parse` + `show` |
| `tax codegen <file> --out <dir>` | v0.4 | `parse` + `validate` + `codegen` |
| `tax diff <a> <b>` | v0.4 | `parse(a)` + `parse(b)` + `diff` |
| `tax doctor <file>` | v0.6 | `parse` + `doctor` (auto면 `extract-*`) |
| `tax git-diff [base]` | v0.6 | git diff + `parse` + `diff` |
| `tax help` | v0.2 | - |

## 6.3 명령 승격 기준

1. **2주 이상 같은 호출 패턴 반복**
2. **외부 도구/CI에서 정형 출력이 필요**

기준 미달이면 라이브러리 직접 호출이 적정 추상화 깊이.

## 참조

- 라이브러리 소스 진입: `packages/taxonomy-engine/src/index.ts`
- CLI 명령 상세: [concepts/cli-commands.md](./concepts/cli-commands.md)
- query 함수 상세: [concepts/query.md](./concepts/query.md)
- codegen 상세: [concepts/codegen-output.md](./concepts/codegen-output.md)
- doctor 상세: [concepts/doctor.md](./concepts/doctor.md)
- diff 상세: [concepts/diff.md](./concepts/diff.md)
