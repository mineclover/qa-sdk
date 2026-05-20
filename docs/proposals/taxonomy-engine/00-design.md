---
status: draft
date: 2026-05-20
part_of: taxonomy-engine
role: overview
supersedes: -
superseded_by: -
---

# Taxonomy Engine — 설계 개요

## 목적 ^purpose

임의의 텍소노미(좌표 체계, 계층 구조, 분류 도식)를 **선언적으로 표현·탐색·분석·시각화·편집**할 수 있는 메타 시스템.

OpenAPI가 HTTP API에 대해 했던 것을 텍소노미에 대해 한다 — YAML SSOT + 도구 생태계.

해결 대상:
1. 텍소노미의 **상위/하위 구조 정의**를 코드/문서 곳곳에 흩어두지 않고 한 곳에 선언.
2. 상위→하위로의 **데이터 흐름** (예: lesson-builder의 Clip → Asset.controlParams)을 1급 시민으로 표현.
3. **인덱싱 전략** (좌표 주소화, capacity, version) 일관 적용.
4. **다양한 텍소노미의 동시 관리** (qa-sdk 좌표계, lesson-builder, DKG 등을 같은 도구로).

## 1. 핵심 원칙 ^defines

1. **좌표계 1급** — Axis + Entry + Coordinate가 추상 모델의 기본. 계층/관계는 좌표 간 Relation으로 표현 (직교성 유지, qa-sdk 좌표계 컨벤션 계승).
2. **YAML SSOT + TS codegen** — yaml이 유일 입력. TS 타입/registry는 결정론적 codegen (qa-sdk 코드젠 패턴과 정합).
3. **address 불변 / id 가변** — qa-sdk의 (정수 address 불변 / kebab-case id 변경 가능) 패턴 그대로. ref 시스템 안정성의 근거.
4. **순수 라이브러리 + thin CLI** — taxonomy-engine은 파일 I/O/SQLite/fetch 없음. CLI 책임.
5. **fail-fast on validate, fail-open on query** — 검증 단계 errors=0 강제, 조회는 unknown coordinate에 undefined 반환.

## 2. 결정 사항 (브레인스토밍 결과)

| 항목 | 결정 | 근거 |
|------|------|------|
| Scope | 메타 시스템 우선, lesson-builder는 후속 사례 | 사용자 메시지: 일반 도구가 가치의 본질 |
| Position | qa-sdk 내 신규 패키지, def-catalog와 동계 | def-catalog는 "메타데이터/lifecycle", 텍소노미는 "구조 자체" → 관심사 분리 |
| Spec format | YAML SSOT + TS 코드제너레이터 | 외부 도구 생태계 + 타입 안전 동시 확보 |
| Abstract model | 좌표계 (Axis + Dimension) | qa-sdk 좌표계 메모리/컨벤션과 강한 정합 |
| MVP scope | 라이브러리 코어 + CLI (탐색/분석) | Web은 후속 spec. 검증 가능한 단위. |
| Reference case | qa-sdk 좌표계 (도그푸딩) | 가장 친숙, def-catalog와 즉시 비교 검증 |
| 패키지 구조 | 단일 라이브러리 + `@qa-sdk/cli` 명령 확장 | qa-sdk cli 컨벤션 정합 (`commands/<topic>.ts`) |

## 3. 아키텍처 개요

### 3.1 패키지 구조

```
packages/
  taxonomy-engine/                       ← 신규 (unscoped, tsup dual format)
    src/
      schema/        # YAML schema (zod) + IR 타입
      parser/        # yaml 텍스트 → IR (구조 검증)
      indexer/       # IR → coordinate index (address 할당, capacity, stride, version)
      query/         # 좌표 조회/순회/슬라이스
      ref/           # 참조 grammar parser + resolver (3-tier)
      codegen/       # IR → TS 타입/registry (결정론, contentHash)
      validate/      # 의미 검증 (axis 5Q, capacity ≥ entries*2, constraint)
      index.ts
  cli/                                   ← 기존 @qa-sdk/cli 확장
    src/commands/taxonomy.ts             # 명령 구현
    src/command-groups/taxonomy.commands.ts
```

### 3.2 책임 경계

| 컴포넌트 | 책임 | 비책임 |
|----------|------|--------|
| `schema` | YAML/IR 타입 정의 (zod), version stamp | 파일 I/O, CLI 출력 |
| `parser` | yaml 텍스트 → IR (구조 검증 only) | 의미 검증, 좌표 할당 |
| `indexer` | IR에 address 할당, capacity/stride/version 결정 | 영속화 |
| `query` | (axis, coordinate) → entries, traversal | 변경/편집 |
| `ref` | 참조 grammar parse + resolve (taxonomy 간 포함) | I/O |
| `codegen` | IR → TS 결정론적 출력 | 런타임 실행 |
| `validate` | 의미 검증 (axis 5Q, capacity, constraint) | 자동 수정 |
| `cli/commands/taxonomy.ts` | CLI thin wrapper, exit code | 비즈니스 로직 |

**의존 방향**: `cli → taxonomy-engine (public index.ts only) → zod, js-yaml`. qa-sdk 내부 다른 패키지 의존 없음 (peer-zero).

## 4. 데이터 모델

### 4.1 YAML 구조 (qa-sdk 좌표계 도그푸딩)

```yaml
taxonomy: qa-sdk-coordinate-system
version: 1
description: qa-sdk definition-catalog의 좌표/level/layer 시스템

axes:
  scope:
    description: 시스템 경계
    entries: [apm, ingest, registry, gate, query, decode, definition, decision]
    capacity: 16            # nextPowerOf2(entries * 2) 이상 권장
    version: 1
  aspect:
    description: 측면
    entries: [model, protocol, runtime, policy, ops, io]
    capacity: 16
  depth:
    entries: [overview, system, layer, component, entry]
    capacity: 8
  level:
    entries: [group, module, leaf]
  layer:
    entries: [domain, operation, mediation, experience]

relations:
  depth-contains:
    from: depth
    to: depth
    kind: contains
    rules:
      - { upper: overview, lower: system }
      - { upper: system, lower: layer }
      - { upper: layer, lower: component }
      - { upper: component, lower: entry }
  aspect-parents:
    from: aspect
    to: aspect
    kind: parent-of
    rules:
      - { child: protocol, parent: model }
      - { child: runtime, parent: protocol }

constraints:
  - id: capacity-headroom
    kind: capacity
    rule: "entries.length * 2 <= capacity"
    severity: warning
  - id: level-leaf-no-children
    kind: structural
    rule: "axis=level entry=leaf must not appear as upper in any contains relation"
    severity: error
```

### 4.2 IR (정규화 표현)

```typescript
TaxonomyIR {
  taxonomy: string
  version: number
  contentHash: string                    // 결정론 검증
  axes: Map<AxisName, AxisIR>
  relations: Map<RelationName, RelationIR>
  constraints: ConstraintIR[]
}

AxisIR {
  name, description?
  entries: EntryIR[]                     // address 할당된 상태
  capacity: number                       // 명시 또는 nextPowerOf2(entries*2)
  version: number
}

EntryIR {
  id: string                             // kebab-case, 변경 가능
  address: number                        // 정수, 불변, missing 시 indexer가 sequential 할당
  label?: string
  meta?: Record<string, unknown>
}

RelationIR { from: AxisRef[], to: AxisRef[], kind, rules: Rule[] }
ConstraintIR { id, kind, severity, rule }
```

### 4.3 추상 모델의 목적

| 개념 | 책임 | 사용자 강조 요구사항 매핑 |
|------|------|--------------------------|
| **Axis** | 차원 선언 (entries, capacity, version) | "상위/하위 구조 정의" — entries가 한 축의 모든 좌표값 |
| **Entry** | 한 축의 좌표값 | id/address 이중화로 rename 안전 |
| **Coordinate** | 다축 좌표 튜플 = 좌표점 | "인덱싱 전략" — cross-product 주소화 |
| **Relation** | 좌표/Entry 간 관계 (contains, parent-of, depends-on, binds, projects-to) | "데이터 흐름" — 1급 시민 |
| **Constraint** | 의미 제약 (선언적, 검증 시 적용) | 텍소노미 무결성 |

**왜 계층 대신 좌표 + Relation인가**: 단순 트리는 cross-cutting 관계(예: Clip이 Asset.controlParams를 구동)를 표현 못 한다. 좌표계는 직교성을 유지하면서도 Relation으로 임의의 관계를 1급으로 표현한다. lesson-builder/qa-sdk/DKG가 모두 같은 추상 모델 위에 표현 가능.

## 5. 참조 시스템 (Reference Grammar)

OpenAPI의 `$ref: '#/components/schemas/Foo'`에 대응하는 메커니즘. 좌표계에선 **id rename에 강건**해야 하므로 3-tier로 설계.

### 5.1 3-tier 참조

**Tier 1 — Path-based (JSON Pointer 스타일)**
정확/verbose. 도구·codegen·진단 메시지의 입력.

```
qa-sdk-coordinate-system                                            # 전체 taxonomy
qa-sdk-coordinate-system#/axes/scope                                # 차원 전체
qa-sdk-coordinate-system#/axes/scope/entries/apm                    # 한 entry
qa-sdk-coordinate-system#/axes/scope/entries/apm/meta/owner         # 내부 깊숙한 필드
qa-sdk-coordinate-system#/relations/depth-contains/rules/0          # 특정 rule
qa-sdk-coordinate-system#/constraints/capacity-headroom             # constraint
```

**Tier 2 — Dotted shorthand**
사람·CLI 친화, lossy. `tax query qa-sdk-coordinate-system:scope.apm` 같은 사용.

```
qa-sdk-coordinate-system:scope.apm
qa-sdk-coordinate-system:scope
qa-sdk-coordinate-system:relations/depth-contains
qa-sdk-coordinate-system:coord{scope=apm,aspect=model,depth=layer}
```

**Tier 3 — Address-based**
id rename에 강건. 정수 hash로 빠른 lookup. 깊은 binding이 자주 일어나는 곳(lesson-builder의 Clip 호출)에서 안전.

```
qa-sdk-coordinate-system::scope#1                  # scope axis의 address=1
qa-sdk-coordinate-system::coord:0x010203           # packed integer 좌표
```

### 5.2 참조 가능한 단위 7종

| 단위 | 예시 | 용도 |
|------|------|------|
| Taxonomy | `qa-sdk-coordinate-system` | 다른 yaml에서 통째 의존 |
| Axis | `:scope` | "이 축의 entries를 가져와" (codegen) |
| Entry | `:scope.apm` | 가장 흔한 참조 |
| Coordinate | `:coord{scope=apm,aspect=model}` | 좌표점 = 노드 자체 |
| Relation | `:relations/depth-contains` | 다른 taxonomy가 같은 관계 재사용 |
| Rule | `:relations/depth-contains/rules/0` | constraint 진단 메시지 |
| Meta field | `:scope.apm#/meta/owner` | "내부 깊숙히" |

### 5.3 Cross-taxonomy 참조

```yaml
# lesson-builder-taxonomy.yaml
imports:
  - taxonomy: qa-sdk-coordinate-system
    version: 1
    as: qac

axes:
  asset-layer:
    entries: [type-schema, asset, clip, cue, stage, branch, scenario]
    projects-to: qac:layer       # cross-taxonomy projection
```

### 5.4 Resolver 동작

1. **Parse**: `parseTaxonomyRef("qa-sdk-coordinate-system:scope.apm#/meta/owner")` → `{taxonomy, axis, entry, jsonPointer}`
2. **Resolve**: Taxonomy registry에서 taxonomy 찾고 IR 따라 값 추출
3. **Strict mode**: 모든 ref가 해소되어야 validate 통과 (broken-ref = error, qa-sdk LinkType broken-link 정책 답습)
4. **Address fallback**: id 변경 시에도 address-based ref는 유효. Indexer가 (id↔address) 양방향 인덱스 보유

### 5.5 버전 정책

- ref에 `@v<n>` 미명시 → latest
- `qa-sdk-coordinate-system@v1:scope.apm` → v1 entries 기준
- IR의 `axes.<name>.version` stamp로 cross-version 참조 가능

### 5.6 왜 3-tier인가 (설계 의도)

- **Tier 1 (JSON pointer)**: 도구/codegen의 정확한 입력. 정규 형식. 자동화 친화.
- **Tier 2 (dotted)**: 사람이 CLI에 타이핑하는 단축형. 일상 사용.
- **Tier 3 (address)**: 영속 링크. id rename 안전. lesson-builder처럼 깊은 binding이 자주 일어나는 곳에서 안전망.

OpenAPI는 Tier 1만 있어서 ref가 rename 따라 깨지는 약점이 있다. qa-sdk의 (address 불변 / id 가변) 컨벤션을 답습해 그 약점을 메운다.

## 6. 라이브러리 API + 최소 CLI

CLI 표면을 미리 박지 않는다. 라이브러리 API가 1급이고 CLI는 그 위의 최소 진입점. 사용 경험으로 명령이 자라난다.

### 6.1 라이브러리 public API (taxonomy-engine)

```typescript
// schema
export type TaxonomyIR, AxisIR, EntryIR, RelationIR, ConstraintIR
export type TaxonomyRef, Diagnostic, ValidateOptions, RefResult

// parse — yaml 텍스트 → IR (구조 검증 only, I/O 없음)
export function parse(yamlText: string): { ir: TaxonomyIR } | { error: ParseError }

// validate — 의미 검증 (capacity, constraint, ref, axis 5Q)
export function validate(
  ir: TaxonomyIR,
  registry?: TaxonomyRegistry,
  opts?: ValidateOptions,
): Diagnostic[]

// query — 단위 조회
export function show(ref: string, registry: TaxonomyRegistry): RefResult | undefined

// ref grammar
export function parseRef(ref: string): TaxonomyRef
export function resolveRef(ref: TaxonomyRef, registry: TaxonomyRegistry): RefResult | undefined

// indexing
export function indexAxis(axis: AxisIR): IndexedAxis
export function packCoordinate(coord: Coordinate, axes: AxisIR[]): number

// codegen
export function codegen(ir: TaxonomyIR, opts: CodegenOptions): CodegenResult

// multi-taxonomy registry
export class TaxonomyRegistry {
  add(ir: TaxonomyIR): void
  get(taxonomy: string): TaxonomyIR | undefined
  list(): string[]
}
```

**원칙**
- 모두 순수 함수 (TaxonomyRegistry 외)
- 파일 I/O 없음 — 모든 입력은 yaml 텍스트 또는 IR
- 사용자가 라이브러리만으로 ad-hoc 스크립트 작성 가능

### 6.2 최소 CLI (단 1개로 시작)

```bash
qa-sdk tax validate <file>   # parse + validate 통합. CI/일상 사용의 90%.
```

`show`/`codegen`/`diff`는 명령으로 박지 않는다. 라이브러리로 한 줄 스크립트 → 패턴이 굳으면 CLI 승격.

### 6.3 명령 승격 기준

1. **2주 이상 같은 호출 패턴 반복**
2. **외부 도구/CI에서 정형 출력이 필요**

기준 미달이면 라이브러리 직접 호출이 적정 추상화 깊이.

## 7. 에러 처리 + 진단 형식

라이브러리 API의 반환값이라 CLI 미정과 무관하게 정함. 향후 Web/IDE/CI 도구가 모두 같은 형식 소비.

### 7.1 Diagnostic 구조

```typescript
type Diagnostic = {
  severity: 'error' | 'warning' | 'info'
  code: DiagnosticCode               // 안정 식별자 (CI에서 grep 가능)
  message: string                    // 한국어 사람용
  ref?: string                       // Tier 1 path. 진단 위치
  location?: { file?: string; line?: number; column?: number }
  hint?: string                      // 수정 제안
  meta?: Record<string, unknown>     // code별 추가 정보
}
```

### 7.2 DiagnosticCode 카테고리

| code prefix | 단계 | 예시 | severity 기본 |
|-------------|------|------|--------------|
| `parse-*` | parse | `parse-yaml-syntax`, `parse-missing-axes` | error |
| `structural-*` | parse | `structural-duplicate-axis`, `structural-empty-entries` | error |
| `capacity-*` | validate | `capacity-headroom`, `capacity-overflow` | warning / error |
| `ref-*` | validate | `ref-broken`, `ref-unresolved-import`, `ref-version-missing` | error |
| `constraint-*` | validate | `constraint-violated`, `constraint-unknown-kind` | error |
| `axis-5q-*` | validate | `axis-5q-finite`, `axis-5q-decisional`, `axis-5q-stable` | warning |
| `version-*` | validate | `version-drift`, `version-incompatible-rename` | error |
| `codegen-*` | codegen | `codegen-content-hash-mismatch` | warning |

**code는 안정 식별자** — 한 번 정한 code는 message가 바뀌어도 유지. CI/diff/문서 grep 안전.

### 7.3 fail 정책 (단계별)

| 단계 | 정책 | 이유 |
|------|------|------|
| `parse` | fail-fast — 첫 syntax error에서 종료 | 깨진 yaml로 후속 진행 무의미 |
| `validate` | **fail-collect** — 모든 진단 수집 후 반환 | 한 번에 다 보여줘야 수정 1회로 끝남 |
| `show` / `resolveRef` | **fail-open** — 해소 실패 시 `undefined`, throw 안 함 | 조회 throw 비용 큼. 호출자 분기 |
| `codegen` | fail-fast — validate errors=0 아니면 거부 | drift 위험 차단 |

### 7.4 위치 정보

`parse`가 yaml line/column을 IR에 보존:
```typescript
EntryIR { id, address, label?, meta?, _loc?: { line, column } }
```
- `_loc`는 underscore prefix — IR 본질 아님 (codegen 출력에서 제거)
- 후속 IDE/LSP의 jump-to-definition 기반

### 7.5 ref 무결성 정책 정합

qa-sdk LinkType `broken-link = error` 답습:
- `ref-broken` → error (조회 못 하면 silent fail은 데이터 무결성 위협)
- `show` / `resolveRef`는 fail-open이지만 **validate가 게이트 책임**을 짊

### 7.6 진단 출력 예시

`tax validate` text 출력:
```
✖ qa-sdk-coordinate-system v1: 2 errors, 1 warning

  ERR  capacity-headroom
       qa-sdk-coordinate-system#/axes/scope
       entries=8, capacity=8 (need ≥ 16)
       hint: capacity를 16 이상으로 올리거나 entries를 분할하세요

  ERR  ref-broken
       qa-sdk-coordinate-system#/relations/depth-contains/rules/3
       lower="missing-entry" — axes/depth/entries에 없음

  WARN axis-5q-finite
       qa-sdk-coordinate-system#/axes/version
       entries unbounded — 5Q checklist '유한' 항목 미충족 가능
```

`tax validate --json` — `Diagnostic[]` JSON 직렬화 그대로.

## 8. 테스트 전략

라이브러리 코어가 순수 함수 + 결정론 + 좌표 round-trip이라 테스트 패턴이 잘 결정됨. 사용자 메모리 `feedback_testing-philosophy`의 "라운드트립 증명 + demo-tests 분리 + 변환 경로 맵" 적용.

### 8.1 테스트 분류 (4계층)

| 계층 | 위치 | 대상 | 카운트 (목표) |
|------|------|------|--------------|
| **Unit** | `packages/taxonomy-engine/__tests__/unit/` | 순수 함수 (parse/validate/parseRef/indexAxis/packCoordinate/codegen) | ~40 |
| **Fixture** | `packages/taxonomy-engine/__tests__/fixtures/*.yaml` + `.golden.json` | 입력 yaml ↔ 진단 골든 / codegen 골든 | ~15 |
| **Dogfooding** | `docs/taxonomies/qa-sdk-coordinate-system.yaml` | 실제 qa-sdk 좌표계 yaml이 errors=0 통과 + codegen 결과가 기존 def-catalog 좌표와 동치 | ~5 |
| **CLI integration** | `packages/cli/src/commands/taxonomy.test.ts` | `tax validate` exit code, text/json 출력 | ~3 |

### 8.2 핵심 테스트 패턴 (round-trip 증명)

```typescript
// (1) parse round-trip
const ir = parse(yamlText).ir
const re = parse(serialize(ir)).ir
expect(ir).toEqual(re)

// (2) ref 3-tier 등가성
const r1 = resolveRef(parseRef('tax:scope.apm'), reg)
const r2 = resolveRef(parseRef('tax#/axes/scope/entries/apm'), reg)
const r3 = resolveRef(parseRef('tax::scope#0'), reg)
expect(r1).toEqual(r2)
expect(r2).toEqual(r3)

// (3) address ↔ id 양방향
const idx = indexAxis(axisIR)
for (const e of axisIR.entries) {
  expect(idx.byAddress(idx.byId(e.id)!.address)?.id).toBe(e.id)
}

// (4) packCoordinate ↔ unpack
const packed = packCoordinate({ scope: 'apm', aspect: 'model' }, axes)
expect(unpackCoordinate(packed, axes)).toEqual({ scope: 'apm', aspect: 'model' })

// (5) codegen 결정론
const a = codegen(ir, opts)
const b = codegen(ir, opts)
expect(a.contentHash).toBe(b.contentHash)
expect(a.files).toEqual(b.files)
```

### 8.3 Fixture-based golden

```
__tests__/fixtures/
  capacity-headroom-violation.yaml          → .golden.json (진단)
  ref-broken.yaml                            → .golden.json
  cross-taxonomy-import.yaml + lib.yaml     → .golden.json
  codegen-basic.yaml                         → .golden.ts (5 files)
```

골든 갱신: `UPDATE_GOLDEN=1 vitest` (qa-sdk 표준 패턴).

### 8.4 도그푸딩 테스트

```typescript
test('qa-sdk-coordinate-system.yaml passes validate', () => {
  const yaml = readFileSync('docs/taxonomies/qa-sdk-coordinate-system.yaml', 'utf8')
  const { ir } = parse(yaml)
  const diags = validate(ir)
  expect(diags.filter(d => d.severity === 'error')).toEqual([])
})

test('codegen SCOPE_ADDR가 기존 def-catalog와 일치', () => {
  const { files } = codegen(ir, { out: 'mem' })
  const generated = evalSnippet(files['addresses.ts'])
  expect(generated.SCOPE_ADDR.apm).toBe(KNOWN_APM_ADDRESS)
})
```

### 8.5 SSOT 파생 원칙 (CLAUDE.md 컨벤션)

- entries 카운트/이름 **하드코딩 금지** — fixture yaml에서 파생
- address 값은 **fixture가 명시한 것만** 골든에 둠
- 허용 하드코딩: DiagnosticCode 문자열, exit code

### 8.6 변환 경로 맵 (테스트 매트릭스)

| 입력 → 출력 | 라운드트립 | 결정론 | 골든 |
|-------------|----------|--------|------|
| yaml → IR | ✓ | ✓ | — |
| IR → Diagnostic[] | — | ✓ | ✓ (fixture) |
| (axis, id) → address | ✓ (양방향) | ✓ | — |
| Coordinate → packed int | ✓ (양방향) | ✓ | — |
| ref string → RefResult | — | ✓ | ✓ (3-tier 등가) |
| IR → codegen files | — | ✓ (contentHash) | ✓ |

### 8.7 왜 이 구성인가

- **순수 함수 + round-trip** — 좌표계 수학적 정합성을 라이브러리 차원에서 증명. lesson-builder/외부 사용자가 신뢰할 수 있는 기반.
- **Fixture golden** — 진단 메시지 변경/회귀를 한눈에. message 텍스트가 바뀌어도 code는 안정이라 골든은 code+meta 위주.
- **도그푸딩 1순위** — 메타 시스템이 자기 자신의 좌표계를 표현할 수 있어야 일반화 능력 증명. drift 시 즉시 깨짐.
- **CLI 통합 3개만** — 라이브러리 함수 1:1 단순 wrapper라 minimal.

## 9. 미결 사항 (Open Issues)

- [ ] CLI 명령 표면 — `validate` 외에는 사용 경험으로 결정 (§6.3 승격 기준)
- [ ] lesson-builder를 후속 사례로 적용하는 시점/spec (별도 proposal)
- [ ] Web UI spec (별도 proposal — 라이브러리 + 진단 형식 공유)
- [ ] Taxonomy registry 영속/검색 (메모리 registry로 시작, 서비스화는 별도 결정)
- [ ] DKG 연관 — 15노드/18엣지를 taxonomy로 표현 가능한지 PoC
- [ ] frontmatter 컨벤션 — 이 proposal 승격 시 def-catalog frontmatter 부여 (`docs/specs/taxonomy-engine/`)

## 10. 참고

- `docs/specs/definition-catalog/definition-catalog.spec.md` — def-catalog (자매 시스템)
- `docs/definition-system-philosophy.md` — 좌표 기반 문서화 원리
- `packages/cli/src/commands/def.ts` — qa-sdk CLI 컨벤션 참고
- `/Users/junwoobang/workflow/pipe-builder/packages/mono-story/packages/lesson-builder/TAXONOMY.md` — 후속 사례 후보 (lesson-builder 6-layer)
