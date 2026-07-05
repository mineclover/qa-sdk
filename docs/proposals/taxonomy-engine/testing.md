# Testing — 테스트 전략

> 00-design.md §8 분리. v0.7 모듈화 (T-L1).

라이브러리 코어가 순수 함수 + 결정론 + 좌표 round-trip이라 테스트 패턴이 잘 결정됨. `feedback_testing-philosophy`의 "라운드트립 증명 + demo-tests 분리 + 변환 경로 맵" 적용.

## 목적 ^purpose

taxonomy-engine의 순수 함수, fixture, dogfooding, CLI integration 검증 계층과 회귀 패턴을 고정한다.

## 8.1 테스트 분류 (4계층)

| 계층 | 위치 | 대상 | 카운트 (목표) |
|------|------|------|--------------|
| **Unit** | `packages/taxonomy-engine/__tests__/unit/` | 순수 함수 (parse/validate/parseRef/indexAxis/packCoordinate/codegen/doctor/diff) | ~60 |
| **Fixture** | `packages/taxonomy-engine/__tests__/fixtures/*.yaml` + `.golden.json` | 입력 yaml ↔ 진단 골든 / codegen 골든 | ~20 |
| **Dogfooding** | `docs/taxonomies/qa-sdk-coordinate-system.yaml` | 실제 qa-sdk 좌표계 yaml이 errors=0 통과 + codegen 결과가 기존 def-catalog 좌표와 동치 | ~8 |
| **CLI integration** | `packages/cli/src/commands/taxonomy.test.ts` | `tax validate/show/codegen/diff/doctor/git-diff` exit code, text/json 출력 | ~12 |

## 8.2 핵심 테스트 패턴 (round-trip 증명)

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

// (6) diff 대칭성
const fwd = diff(a, b)
const rev = diff(b, a)
expect(fwd.same).toBe(rev.same)
// rev는 fwd의 added↔removed 대칭

// (7) doctor: no drift on fresh extract
const expected = extractDkgExpected(specText)
const diags = doctor(ir, expected)
expect(diags.filter(d => d.severity === 'error')).toEqual([])
```

## 8.3 Fixture-based golden

```
__tests__/fixtures/
  capacity-headroom-violation.yaml          → .golden.json (진단)
  ref-broken.yaml                           → .golden.json
  cross-taxonomy-import.yaml + lib.yaml    → .golden.json
  codegen-basic.yaml                        → .golden.ts (5 files)
  duplicate-address.yaml                    → .golden.json
```

골든 갱신: `UPDATE_GOLDEN=1 vitest` (qa-sdk 표준 패턴).

## 8.4 도그푸딩 테스트

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

test('dkg-schema.yaml doctor drift=0 (auto extract)', () => {
  const specText = readFileSync('docs/specs/dkg-system/dkg-node-types.spec.md', 'utf8')
  const expected = extractDkgExpected(specText)
  const yamlText = readFileSync('docs/taxonomies/dkg-schema.yaml', 'utf8')
  const { ir } = parse(yamlText)
  const diags = doctor(ir, expected)
  expect(diags.filter(d => d.severity === 'error')).toEqual([])
})
```

## 8.5 SSOT 파생 원칙 (CLAUDE.md 컨벤션)

- entries 카운트/이름 **하드코딩 금지** — fixture yaml에서 파생
- address 값은 **fixture가 명시한 것만** 골든에 둠
- 허용 하드코딩: DiagnosticCode 문자열, exit code, HTTP status

## 8.6 변환 경로 맵 (테스트 매트릭스)

| 입력 → 출력 | 라운드트립 | 결정론 | 골든 |
|-------------|----------|--------|------|
| yaml → IR | ✓ | ✓ | — |
| IR → Diagnostic[] | — | ✓ | ✓ (fixture) |
| (axis, id) → address | ✓ (양방향) | ✓ | — |
| Coordinate → packed int | ✓ (양방향) | ✓ | — |
| ref string → RefResult | — | ✓ | ✓ (3-tier 등가) |
| IR → codegen files | — | ✓ (contentHash) | ✓ |
| (IR, expected) → Diagnostic[] | — | ✓ | — |
| (IR_a, IR_b) → DiffEntry[] | — | ✓ | — |

## 8.7 로컬 CI 게이트 (`pnpm tax:ci`)

```bash
pnpm --filter taxonomy-engine build
pnpm --filter taxonomy-engine typecheck
pnpm --filter taxonomy-engine test
pnpm --filter @qa-sdk/cli test taxonomy.test
node scripts/tax-validate-fixtures.mjs      # docs/taxonomies/*.yaml errors=0
node scripts/tax-doctor.mjs                 # 외부 SSOT drift 점검
node scripts/tax-codegen-drift.mjs          # contentHash 변경 여부
```

lockfile: `docs/taxonomies/.codegen-hashes.json` (git 추적 대상).

## 8.8 왜 이 구성인가

- **순수 함수 + round-trip** — 좌표계 수학적 정합성을 라이브러리 차원에서 증명. lesson-builder/외부 사용자가 신뢰할 수 있는 기반.
- **Fixture golden** — 진단 메시지 변경/회귀를 한눈에. code가 안정이라 골든은 code+meta 위주.
- **도그푸딩 1순위** — 메타 시스템이 자기 자신의 좌표계를 표현할 수 있어야 일반화 능력 증명.
- **CLI 통합 최소** — 라이브러리 함수 1:1 단순 wrapper라 minimal.

## 참조

- 테스트 파일: `packages/taxonomy-engine/__tests__/`
- CLI 통합 테스트: `packages/cli/src/commands/taxonomy.test.ts`
- 도그푸딩 yaml: `docs/taxonomies/`
- CI 스크립트: `scripts/tax-*.mjs`
- 테스트 컨벤션: `docs/specs/system/testing-patterns.spec.md`
