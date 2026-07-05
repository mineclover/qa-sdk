# Auto Extract — 외부 SSOT에서 expected fixture 자동 추출

> `src/doctor/extract/` (T-M3에서 분리 예정). v0.4~v0.5에서 추가. doctor의 `--auto` 옵션 뒷받침.

## 정의

**spec/code SSOT 문서에서 ExpectedTaxonomy를 자동으로 추출**하는 함수 집합. doctor가 `--auto` 플래그로 호출될 때 yaml 파일명에 따라 올바른 extractor를 선택한다.

## 목적 ^purpose

외부 SSOT 문서와 taxonomy yaml 사이의 drift를 사람이 fixture를 수동 갱신하지 않아도 검출할 수 있게 한다.

기대 효과: expected fixture를 손으로 유지하는 대신, 원본 SSOT 문서가 바뀌면 CI가 drift를 즉시 감지.

## 3 Extractor

### `extractDkgExpected`

```typescript
function extractDkgExpected(specText: string): ExpectedTaxonomy
```

**SSOT source**: `dkg-node-types.spec.md` + `dkg-edge-types.spec.md`
**추출 범위**: DKG 노드 종류 15종 + 엣지 종류 18종 (markdown 표 첫 번째 열)
**대상 yaml**: `dkg-schema.yaml`

추출 예:
```
docs/specs/dkg-system/dkg-node-types.spec.md
  | 노드 종류 | 설명 | ...
  | service | ... |
  | prefix | ... |
  → { 'node-type': { entries: [{ id: 'service' }, { id: 'prefix' }, ...] } }
```

**추가 버전**: v0.4 (T-F2)

---

### `extractIngestExpected`

```typescript
function extractIngestExpected(specText: string): ExpectedTaxonomy
```

**SSOT source**: `docs/specs/ingest/ingest-infra-system/store-adapter-parity.spec.md`
**추출 범위**: store-driver / store-kind / store-coverage entries (markdown 표)
**대상 yaml**: `ingest-coords.yaml`

markdown 표 구조 (spec마다 다름):
```
| store-driver | store-kind | ... |
| memory | in-memory | ... |
| pg | persistent | ... |
→ { 'store-driver': { entries: [{ id: 'memory' }, { id: 'pg' }, ...] } }
```

**추가 버전**: v0.5 (T-H1)

---

### `extractVocabExpected`

```typescript
function extractVocabExpected(vocabTs: string): ExpectedTaxonomy
```

**SSOT source**: `packages/definition-catalog/src/vocabulary.ts`
**추출 범위**: `DEF_LEVEL.entries`, `DEF_ASPECT.entries` 등 vocabulary const의 entries 배열
**대상 yaml**: `qa-sdk-def-catalog.yaml`

추출 방식: 정규식 또는 ts-morph로 TS const 배열에서 string literal 추출:
```typescript
export const DEF_LEVEL = {
  entries: ['group', 'module', 'leaf']
  // → { 'level': { entries: [{ id: 'group' }, { id: 'module' }, { id: 'leaf' }] } }
}
```

**추가 버전**: v0.5 (T-H3)

## Markdown 표 추출 Helper

두 extractor(DKG, ingest)가 공유하는 markdown 표 파싱 유틸리티:

### `extractIdsFromMarkdownTable`

```typescript
function extractIdsFromMarkdownTable(
  markdownText: string,
  columnIndex?: number  // 기본 0 (첫 번째 열)
): string[]
```

GFM 테이블에서 지정 열의 셀 값 추출. 헤더 행, 구분 행 제외.

```
| id | 설명 |
|---|---|
| service | ... |
| prefix | ... |
→ ['service', 'prefix']
```

### `extractTextsFromMarkdownTable`

```typescript
function extractTextsFromMarkdownTable(
  markdownText: string,
  columnIndex: number
): string[]
```

`extractIdsFromMarkdownTable`와 동일하지만 결과를 trim 없이 그대로 반환 (label 추출 등 공백 중요한 경우).

## --auto 매핑 (CLI doctor)

CLI `tax doctor --auto`에서 yaml basename → extractor 매핑:

| yaml basename | extractor | SSOT source |
|---------------|----------|-------------|
| `dkg-schema.yaml` | `extractDkgExpected` | `dkg-{node,edge}-types.spec.md` |
| `ingest-coords.yaml` | `extractIngestExpected` | `store-adapter-parity.spec.md` |
| `qa-sdk-def-catalog.yaml` | `extractVocabExpected` | `vocabulary.ts` |
| 기타 | — | `--expected <file>` 명시 필요 |

매핑 코드: `packages/cli/src/commands/taxonomy/doctor.ts`

## 한계

- **lesson-builder**: 외부 repo (`/Users/junwoobang/workflow/pipe-builder/...`) 경로 의존. CI 환경에서 path 달라질 수 있어 auto 매핑에서 제외.
- **DEF_ASPECT 46개**: TS 파일에서 46 entries 파싱은 복잡. ts-morph 도입이 필요할 수 있음 (v0.5 T-H3에서 판단 유보).
- **표 구조 의존성**: spec 문서 표 형식이 바뀌면 extractor도 갱신 필요.

## 후속 자동화 가능성

- lesson-builder가 qa-sdk repo 내부로 이동 시 `extractLessonBuilderExpected` 추가
- qa-sdk-coords 자동 추출: ts-morph 기반 TS enum/union 파서로 완전 자동화 가능
- CI에서 `pnpm tax:ci` → auto extract → doctor → drift=0 보장 흐름 확립

## 참조

- 코드 위치: `packages/taxonomy-engine/src/doctor/extract.ts` (T-M3에서 `doctor/extract/` 분리 예정)
- doctor 함수: [doctor.md](./doctor.md)
- CLI --auto 옵션: [cli-commands.md](./cli-commands.md) §--auto 매핑
- v0.4 계획: [plans/v0.4.md](../plans/v0.4.md) §T-F2
- v0.5 계획: [plans/v0.5.md](../plans/v0.5.md) §T-H1, T-H2, T-H3
- T-M3 (추후): [plans/v0.7.md](../plans/v0.7.md)
