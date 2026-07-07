---
def:
  tier: component
  id: spec-prop-codegen
  address: def_document:v2:68809
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: operation
  svc: spec-core
  tags: [runtime, contract, structural]
  links:
    - target: spec-core-types-group
      type: depends_on
sources:
  - packages/spec-core/src/codegen/index.ts
  - packages/spec-core/src/codegen/ir-builder.ts
  - packages/spec-core/src/codegen/ts-generator.ts
  - packages/spec-core/src/codegen/codegen.test.ts
  - packages/cli/src/commands/spec.ts
---

# Spec Propagation — 3단계: Codegen

## 목적 ^purpose

변경된 스펙에서 TypeScript 타입을 자동 생성하는 3단계.

## 구성 ^overview

- **연결 경로**: registry-service → resolveManifest() → buildIR() → generateFromIR() (TS/Proto/JSON Schema 출력)
- **입력**: GenerateFromRegistryInput — registryService 인스턴스, 출력 포맷 배열, outDir, 선택적 prefix 필터
- **출력**: GenerateFromRegistryResult — 생성된 파일 경로 목록 + manifest(versions, generatedAt)
- **실행 5단계**: manifest 조회 → prefix별 registryToPrefixSpec 역변환 → buildIR → 포맷별 코드 생성 → 파일 기록

---

## 문제

spec-core의 codegen은 PrefixSpec을 입력으로 받는다. registry-service에서 활성화된 버전의 정보를 codegen에 공급하는 경로가 없다.

---

## 연결 방식

```
registry-service -> resolveManifest()
  -> { versions: { permission: { versionId: "v5", shape, stride } } }
    -> spec-core의 buildIR()에 공급
      -> generateFromIR() (TS/Proto/JSON Schema)
```

---

## API

```typescript
interface GenerateFromRegistryInput {
  /** registry-service 인스턴스 */
  registryService: RegistryService;

  /** 생성할 출력 포맷 */
  formats: ("typescript" | "javascript" | "protobuf" | "json-schema")[];

  /** 출력 디렉토리 */
  outDir: string;

  /** 특정 prefix만 (없으면 전체 active) */
  prefixes?: string[];
}

interface GenerateFromRegistryResult {
  /** 생성된 파일 경로 */
  files: Array<{
    path: string;
    format: string;
    prefix: string;
  }>;

  /** 생성 기준 manifest */
  manifest: {
    versions: Record<string, any>;
    generatedAt: string;
  };
}

async function generateFromRegistry(
  input: GenerateFromRegistryInput,
): Promise<GenerateFromRegistryResult>;
```

---

## 실행 경로

```
generateFromRegistry({ registryService, formats: ["typescript"], outDir: "generated/" }):

  1. manifest = registryService.resolveManifest()

  2. for each prefix in manifest.versions:
     prefixSpec = registryToPrefixSpec(prefix, manifest)  // 역변환

  3. ir = buildIR({ axes, prefixSpecs })

  4. for each format:
     if "typescript": generateFromIR(ir) -> write to outDir
     if "protobuf":   generateProtoFromIR(ir) -> write to outDir
     ...

  5. return { files, manifest }
```

---

## 종단 시나리오

```
generateFromRegistry({ registry, formats: ["typescript"], outDir: "generated/" })
-> generated/tracking.ts

generateFromRegistry(...)
-> generated/permission.ts (v5 shape 반영)
```
