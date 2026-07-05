# Taxonomy Engine v0.1 — Task 9: 도그푸딩 fixture (qa-sdk 좌표계)

## 목적 ^purpose

v0.1의 qa-sdk coordinate dogfooding fixture 작업 원문을 보존한다.

## Task 9: 도그푸딩 fixture (qa-sdk 좌표계)

**Files:**
- Create: `docs/taxonomies/qa-sdk-coordinate-system.yaml`
- Create: `packages/taxonomy-engine/__tests__/dogfooding.test.ts`

- [ ] **Step 1: yaml 작성**

`docs/taxonomies/qa-sdk-coordinate-system.yaml`:

```yaml
taxonomy: qa-sdk-coordinate-system
version: 1
description: qa-sdk definition-catalog의 좌표/level/layer 시스템 (도그푸딩)

axes:
  scope:
    description: 시스템 경계
    entries: [apm, ingest, registry, gate, query, decode, definition, decision]
    capacity: 16
    version: 1
  aspect:
    description: 측면
    entries: [model, protocol, runtime, policy, ops, io]
    capacity: 16
    version: 1
  depth:
    description: 추상 정도
    entries: [overview, system, layer, component, entry]
    capacity: 16
    version: 1
  level:
    description: 분해 레벨 (메타)
    entries: [group, module, leaf]
    capacity: 8
    version: 1
  layer:
    description: 4계층
    entries: [domain, operation, mediation, experience]
    capacity: 8
    version: 1

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
      - { child: policy, parent: runtime }
      - { child: ops, parent: runtime }
      - { child: io, parent: protocol }

constraints:
  - id: level-leaf-no-children
    kind: structural
    rule: "axis=level entry=leaf must not appear as upper in any contains relation"
    severity: error
```

- [ ] **Step 2: 도그푸딩 테스트 작성**

`__tests__/dogfooding.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse, validate, codegen } from "../src/index.js";

const YAML_PATH = join(__dirname, "../../../docs/taxonomies/qa-sdk-coordinate-system.yaml");

describe("qa-sdk-coordinate-system 도그푸딩", () => {
  const yamlText = readFileSync(YAML_PATH, "utf8");

  it("parse 성공", () => {
    const r = parse(yamlText);
    expect("ir" in r).toBe(true);
  });

  it("validate errors=0", () => {
    const r = parse(yamlText);
    if (!("ir" in r)) throw new Error("parse failed");
    const diags = validate(r.ir);
    const errors = diags.filter((d) => d.severity === "error");
    expect(errors).toEqual([]);
  });

  it("codegen 결정론 — 같은 yaml → 같은 contentHash", () => {
    const r = parse(yamlText);
    if (!("ir" in r)) throw new Error();
    const a = codegen(r.ir);
    const b = codegen(r.ir);
    expect(a.contentHash).toBe(b.contentHash);
  });

  it("SCOPE_ADDR.apm은 결정론적 0", () => {
    const r = parse(yamlText);
    if (!("ir" in r)) throw new Error();
    const { files } = codegen(r.ir);
    expect(files["addresses.ts"]).toContain("apm: 0");
  });
});
```

- [ ] **Step 3: 테스트 통과 확인**

Run: `pnpm --filter taxonomy-engine test dogfooding.test`
Expected: 4 passed

- [ ] **Step 4: 커밋**

```bash
git add docs/taxonomies packages/taxonomy-engine/__tests__/dogfooding.test.ts
git commit -m "feat(taxonomy-engine): qa-sdk coordinate system dogfooding fixture (Task 9)"
```

---
