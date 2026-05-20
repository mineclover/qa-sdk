# Doctor — SSOT Drift 검출

> `src/doctor/` 모듈 spec. v0.3에서 추가. 자동 추출 함수는 [auto-extract.md](./auto-extract.md) 참조.

## 정의

**yaml IR ↔ 외부 SSOT의 drift를 검출**하는 순수 함수. "내 taxonomy yaml이 실제 코드/스펙과 일치하는가?"를 진단으로 답한다.

## API

```typescript
function doctor(ir: TaxonomyIR, expected: ExpectedTaxonomy): Diagnostic[]
```

**입력**
- `ir` — `parse(yamlText).ir` 결과
- `expected` — 외부 SSOT에서 추출한 기대값 (`ExpectedTaxonomy`)

**출력**: `Diagnostic[]` — drift가 없으면 빈 배열, drift 있으면 진단 목록

**fail-collect** — 한 번에 모든 drift를 수집해서 반환. validate와 동일한 정책.

## ExpectedTaxonomy 형식

```typescript
type ExpectedTaxonomy = {
  [axisName: string]: ExpectedAxis
}

type ExpectedAxis = {
  entries: Array<{
    id: string
    address?: number   // 명시 시 address 비교
    label?: string     // 명시 시 label 비교
  }>
}
```

**예시**:
```json
{
  "node-type": {
    "entries": [
      { "id": "service", "address": 0 },
      { "id": "edge-type", "address": 1 },
      { "id": "prefix", "address": 2 }
    ]
  },
  "edge-type": {
    "entries": [
      { "id": "depends-on" },
      { "id": "owns" }
    ]
  }
}
```

## 3 진단 코드

| code | severity | 발생 조건 | meta 키 |
|------|----------|----------|---------|
| `doctor-missing` | error | expected에 있는데 yaml에 없음 | `{ axis, missing: string[] }` 또는 `{ axis }` |
| `doctor-drift` | warning | yaml과 expected의 address 또는 label 불일치 | `{ axis, entry, yaml, expected, field? }` |
| `doctor-unexpected` | warning | yaml에 있는데 expected에 없음 | `{ axis, unexpected: string[] }` |

**진단 코드 상세**: [diagnostics-catalog.md](./diagnostics-catalog.md) §doctor-*

## 사용 예시

### 직접 기대값 사용

```typescript
import { parse, doctor } from 'taxonomy-engine'

const ir = parse(readFileSync('docs/taxonomies/dkg-schema.yaml', 'utf8')).ir
const expected: ExpectedTaxonomy = {
  'node-type': {
    entries: [
      { id: 'service' },
      { id: 'prefix' },
      { id: 'dkg-node' },
    ]
  }
}
const diags = doctor(ir, expected)
// diags.length === 0 이면 drift 없음
```

### 자동 추출 사용 (`--auto`)

```typescript
import { extractDkgExpected } from 'taxonomy-engine/doctor/extract'

const specText = readFileSync('docs/specs/dkg-system/dkg-node-types.spec.md', 'utf8')
const expected = extractDkgExpected(specText)
const diags = doctor(ir, expected)
```

자동 추출 상세: [auto-extract.md](./auto-extract.md)

## 도그푸딩 사례

qa-sdk 도그푸딩에서 doctor가 실제로 검출하는 drift:

| yaml 파일 | SSOT 출처 | 검출 대상 |
|-----------|----------|----------|
| `dkg-schema.yaml` | `dkg-node-types.spec.md`, `dkg-edge-types.spec.md` | DKG 15 노드종/18 엣지종 추가/변경/누락 |
| `ingest-coords.yaml` | `store-adapter-parity.spec.md` | store-driver/store-kind entries |
| `qa-sdk-def-catalog.yaml` | `vocabulary.ts` (DEF_LEVEL, DEF_ASPECT) | qa-sdk 좌표 entries |

이 세 사례가 `--auto` 매핑에 hardcoded됨 — [concepts/cli-commands.md](./cli-commands.md) §--auto 매핑 참조.

## doctor vs validate 차이

| | `validate` | `doctor` |
|---|---|---|
| 비교 대상 | yaml IR 내부 규칙 (capacity, ref, constraint) | yaml IR ↔ 외부 SSOT |
| expected 입력 | 없음 (yaml 자체가 기준) | `ExpectedTaxonomy` 필수 |
| 목적 | yaml 형식/의미 정합성 | 코드/스펙과의 동기화 확인 |
| CI 역할 | validate gate (errors=0 강제) | drift 점검 (warning 허용 가능) |

## 참조

- 코드 위치: `packages/taxonomy-engine/src/doctor/index.ts`
- 자동 추출 함수: [auto-extract.md](./auto-extract.md), `packages/taxonomy-engine/src/doctor/extract.ts`
- 진단 코드: [diagnostics-catalog.md](./diagnostics-catalog.md) §doctor-*
- CLI `tax doctor`: [cli-commands.md](./cli-commands.md)
- v0.3 계획: [plans/v0.3.md](../plans/v0.3.md) §T-E2
- v0.4 계획: [plans/v0.4.md](../plans/v0.4.md) §T-F2
- v0.5 계획: [plans/v0.5.md](../plans/v0.5.md) §T-H1~H3
- CI 스크립트: `scripts/tax-doctor.mjs`
