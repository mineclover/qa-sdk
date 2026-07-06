---
def:
  id: taxonomy-engine-doctor-concept
  type: knowledge
  knowledge_kind: proposal
  lifecycle: approved
  owner_system: taxonomy-engine
  projection_plane: intent
  scope: constraint
  aspect: ssot_drift
  tier: component
  depth: specification
status: implemented
date: 2026-07-05
part_of: taxonomy-engine
role: doctor
sources:
  - packages/taxonomy-engine/src/doctor/index.ts
  - packages/taxonomy-engine/src/doctor/extract/index.ts
  - packages/taxonomy-engine/src/index.ts
  - packages/taxonomy-engine/__tests__/unit/doctor.test.ts
  - packages/taxonomy-engine/__tests__/unit/doctor-extract.test.ts
  - packages/cli/src/commands/taxonomy/doctor.ts
---

# Doctor — SSOT Drift 검출

> `packages/taxonomy-engine/src/doctor/` 구현 표면. yaml IR과 외부 SSOT에서 추출한 expected vocabulary를 비교한다.

## 목적 ^purpose

- taxonomy yaml이 실제 코드/스펙 vocabulary와 어긋났는지 진단한다.
- validate가 보지 못하는 외부 drift를 `Diagnostic[]`로 수집한다.
- CLI `--auto`에서 repo 내 대표 SSOT 세트를 보수적으로 자동 연결한다.

## API

```typescript
function doctor(ir: TaxonomyIR, expected: ExpectedTaxonomy): Diagnostic[]
```

입력:
- `ir` — `parse(yamlText).ir` 결과
- `expected` — 외부 SSOT에서 추출한 기대값

출력:
- `Diagnostic[]` — drift가 없으면 빈 배열, drift가 있으면 fail-collect로 모두 반환

## ExpectedTaxonomy 형식

```typescript
type ExpectedTaxonomy = {
  taxonomy: string
  axes: Record<string, {
    entries: Array<{
      id: string
      address?: number
      label?: string
    }>
  }>
}
```

예시:
```json
{
  "taxonomy": "dkg-schema",
  "axes": {
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
}
```

`taxonomy` 이름이 다르면 `doctor-missing` error 하나를 반환하고 축 비교를 진행하지 않는다.

## 3 진단 코드

| code | severity | 발생 조건 | meta 키 |
|------|----------|-----------|---------|
| `doctor-missing` | error | expected taxonomy/axis/entry가 yaml에 없음 | `{ yaml, expected }`, `{ axis }`, `{ axis, missing }` |
| `doctor-drift` | warning | yaml과 expected의 address 또는 label 불일치 | `{ axis, entry, field, yaml, expected }` |
| `doctor-unexpected` | warning | yaml entry가 expected에 없음 | `{ axis, unexpected }` |

**진단 코드 상세**: [diagnostics-catalog.md](./diagnostics-catalog.md) §doctor-*

## 사용 예시

### 직접 기대값 사용

```typescript
import { parse, doctor, type ExpectedTaxonomy } from "taxonomy-engine"

const parsed = parse(yamlText)
if ("error" in parsed) throw parsed.error

const expected: ExpectedTaxonomy = {
  taxonomy: "dkg-schema",
  axes: {
    "node-type": {
      entries: [
        { id: "service" },
        { id: "prefix" },
        { id: "dkg-node" },
      ],
    },
  },
}

const diags = doctor(parsed.ir, expected)
```

### 자동 추출 사용

```typescript
import { extractDkgExpected } from "taxonomy-engine"

const expected = extractDkgExpected(nodeSpecMarkdown, edgeSpecMarkdown)
const diags = doctor(parsed.ir, expected)
```

자동 추출 함수는 패키지 루트에서 export된다. 구현 파일은 `packages/taxonomy-engine/src/doctor/extract/index.ts` 아래에 있다.

## 도그푸딩 사례

qa-sdk CLI `--auto`가 현재 연결하는 매핑:

| yaml 파일 | SSOT 출처 | 검출 대상 |
|-----------|-----------|-----------|
| `dkg-schema.yaml` | `dkg-node-types.spec.md`, `dkg-edge-types.spec.md` | DKG node/edge vocabulary |
| `ingest-coords.yaml` | `store-adapter-parity.spec.md` | ingest store-driver/store-kind vocabulary |
| `qa-sdk-def-catalog.yaml` | `packages/definition-catalog/src/vocabulary.ts` | definition-catalog vocabulary |

매핑 구현은 `packages/cli/src/commands/taxonomy/doctor.ts`의 `AUTO_EXTRACT_MAP`이 소유한다.

## doctor vs validate 차이

| | `validate` | `doctor` |
|---|---|---|
| 비교 대상 | yaml IR 내부 규칙 | yaml IR과 외부 SSOT |
| expected 입력 | 없음 | `ExpectedTaxonomy` 필수 |
| 목적 | 형식/의미 정합성 | 코드/스펙과의 동기화 확인 |
| CI 역할 | error=0 gate | drift 점검. error는 실패, warning은 정책 선택 |

## 참조

- 코드 위치: `packages/taxonomy-engine/src/doctor/index.ts`
- 자동 추출 함수: `packages/taxonomy-engine/src/doctor/extract/index.ts`
- public export: `packages/taxonomy-engine/src/index.ts`
- CLI `tax doctor`: `packages/cli/src/commands/taxonomy/doctor.ts`
- 자동 추출 상세: [auto-extract.md](./auto-extract.md)

## 검증 명령 ^validation

```bash
pnpm --filter taxonomy-engine exec vitest run __tests__/unit/doctor.test.ts __tests__/unit/doctor-extract.test.ts
node packages/cli/dist/index.js def validate
pnpm arch:feedback
```
