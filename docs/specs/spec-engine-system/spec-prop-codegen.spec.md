---
def:
  id: spec-prop-codegen
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  tags: [tier-system]
  links:
    - target: spec-core-types
      type: depends_on
---

# Spec Propagation — 3단계: Codegen

## 목적 ^purpose

변경된 스펙에서 TypeScript 타입을 자동 생성하는 3단계.

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
