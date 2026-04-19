# ontology-pack-validate

Ontology pack 참조를 로드·검증하는 **라이브러리**. Known pack registry, schema 검증, component identity, runtime validation, file readiness, docs readiness를 조합해 `OntologyPackValidateResult`를 반환한다.

docs readiness는 **dependency injection**으로만 동작한다 — 환경에 독립적이기 위해 `createDefinitionMarkdownAdapter` 같은 adapter를 직접 호출하지 않는다. 소비자(`@qa-sdk/cli` 등)가 `OntologyPackDocsFamilyReader`를 주입해야 docs-backed readiness를 얻는다.

## 공개 API

### Entry point

- `validateOntologyPackFromRef({ packRef, rootDir?, readDocsFamily? })` — pack ref 해석 + 전체 검증
- `OntologyPackValidateResult` — 검증 결과 (valid, packId, resolution, identity, componentSchema, systemBindings, runtime, readiness, issues)

### Known pack registry

- `KNOWN_ONTOLOGY_PACK_IDS` — 등록된 pack ID 상수 배열
- `KnownOntologyPackId` — 유니언 타입
- `isKnownOntologyPackId(packId)` — 타입 가드
- `resolveKnownOntologyPack(packId)` — pack 메타데이터 해석

### Docs family 주입점

- `OntologyPackDocsFamilyReader` — `({ packId, rootDir }) => Promise<readonly DocumentEnvelope[]>`
- `filterMatchingDocsForPack(packId, docs)` — pack id에 매칭되는 문서 필터 (주입 구현에서 활용)

### 결과 타입

- `OntologyPackValidateIssue` (`level: "error" | "warning"`, `source`, `code`, `message`)
- `OntologyPackValidateReadiness` — file / docs / sourceMap 상태
- `OntologyPackValidateFileReadiness` / `OntologyPackValidateDocsReadiness` / `OntologyPackValidateSourceMapReadiness`
- `OntologyPackValidateResolution` — known-pack / file-path / unknown 해석 결과

## 사용 패턴

```typescript
import { validateOntologyPackFromRef } from "ontology-pack-validate";

// 기본: docs readiness 없음 (skipped)
const result = await validateOntologyPackFromRef({ packRef: "my-pack.json" });

// 소비자가 docs reader 주입
const result = await validateOntologyPackFromRef({
  packRef: "my-pack.json",
  readDocsFamily: async ({ packId, rootDir }) => {
    // 환경에 맞는 adapter로 docs 수집
    return myAdapter.listDocumentsForPack(packId, rootDir);
  },
});
```

`@qa-sdk/cli`는 `lib/ontology-pack-docs-reader.ts`에서 definition-markdown adapter 기반 reader를 제공한다.

## 의존

- `doc-envelope` — envelope 타입
- `definition-catalog` — 일부 internal 헬퍼
- `authorization-ontology`, `operational-ontology` — known pack schema
- node built-ins

## 비목표

- **쓰기 금지** — pack 생성/수정은 별도 tool
- **환경 바인딩 금지** — 문서 수집 방식은 adapter DI로만 주입
