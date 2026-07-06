---
def:
  id: taxonomy-engine-plan-v0-8-phase-b
  type: knowledge
  knowledge_kind: proposal
  lifecycle: approved
  owner_system: taxonomy-engine
  projection_plane: intent
  scope: meta
  aspect: implementation_plan
  tier: component
  depth: implementation
  sources:
    - packages/taxonomy-engine/src/validate/lifecycle.ts
    - packages/taxonomy-engine/src/validate/index.ts
    - packages/taxonomy-engine/__tests__/unit/lifecycle-validate.test.ts
status: implemented
date: 2026-07-05
part_of: taxonomy-engine
role: plan-v0-8-phase-b-validate
---

# Taxonomy Engine v0.8 — Phase B — Validate (4 신규 diagnostic)

## 목적 ^purpose

v0.8 Phase B lifecycle validator 계획 원문을 보존한다.

## Phase B — Validate (4 신규 diagnostic)

### Task B1: lifecycle validator 모듈

**Files:**
- Create: `packages/taxonomy-engine/src/validate/lifecycle.ts`
- Modify: `packages/taxonomy-engine/src/validate/index.ts`
- Create: `packages/taxonomy-engine/test/validate-lifecycle.test.ts`

- [ ] **Step 1: 실패 테스트 작성** — 4 diagnostic 각각 trigger 케이스

```typescript
import { describe, expect, it } from "vitest";
import { parse } from "../src/parser/index.js";
import { validate } from "../src/validate/index.js";

function ir(yaml: string) {
  const r = parse(yaml);
  if (!("ir" in r)) throw new Error("parse failed");
  return r.ir;
}

describe("lifecycle validate", () => {
  it("lifecycle 누락 → warning (기본 모드)", () => {
    const diags = validate(ir(`taxonomy: t
version: 1
axes:
  a:
    entries: [{ id: x, address: 0 }]`));
    const missing = diags.filter((d) => d.code === "lifecycle-missing");
    expect(missing).toHaveLength(1);
    expect(missing[0].severity).toBe("warning");
  });

  it("lifecycle 누락 → error (strict 모드)", () => {
    const diags = validate(
      ir(`taxonomy: t
version: 1
axes:
  a:
    entries: [{ id: x, address: 0 }]`),
      { lifecycleStrict: true }
    );
    expect(diags.find((d) => d.code === "lifecycle-missing")?.severity).toBe("error");
  });

  it("lifecycle: tbd → info 보고", () => {
    const diags = validate(ir(`taxonomy: t
version: 1
axes:
  a:
    entries:
      - { id: x, address: 0, lifecycle: tbd, placeholderReason: "미정" }`));
    expect(diags.find((d) => d.code === "lifecycle-tbd")).toBeDefined();
  });

  it("tbd인데 reason/link 둘 다 없음 → orphan info", () => {
    const diags = validate(ir(`taxonomy: t
version: 1
axes:
  a:
    entries: [{ id: x, address: 0, lifecycle: tbd }]`));
    expect(diags.find((d) => d.code === "lifecycle-tbd-orphan")).toBeDefined();
  });

  it("decisionLink 깨진 path → warning", () => {
    const diags = validate(ir(`taxonomy: t
version: 1
axes:
  a:
    entries: [{ id: x, address: 0, lifecycle: approved, decisionLink: "./does-not-exist.md" }]`),
      { decisionLinkBaseDir: process.cwd() }
    );
    expect(diags.find((d) => d.code === "decision-link-broken")).toBeDefined();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인** — 예상: 4종 코드 인식 안 됨.

- [ ] **Step 3: validate/lifecycle.ts 구현**

```typescript
import { existsSync } from "node:fs";
import { resolve, isAbsolute } from "node:path";
import type { TaxonomyIR } from "../schema/ir.js";
import type { Diagnostic } from "../schema/diagnostic.js";

export type LifecycleValidateOptions = {
  lifecycleStrict?: boolean;
  decisionLinkBaseDir?: string;  // 누락 시 path 검증 skip
};

export function validateLifecycle(
  ir: TaxonomyIR,
  opts: LifecycleValidateOptions = {},
): Diagnostic[] {
  const diags: Diagnostic[] = [];
  const sev = opts.lifecycleStrict ? "error" : "warning";

  for (const [axisName, axis] of ir.axes) {
    if (axis.lifecycle === undefined) {
      diags.push({
        severity: sev,
        code: "lifecycle-missing",
        message: `axis "${axisName}"에 lifecycle 없음`,
        ref: `${ir.taxonomy}:${axisName}`,
        hint: "lifecycle: <draft|review|approved|deprecated|archived|tbd> 추가",
      });
    }
    for (const entry of axis.entries) {
      if (entry.lifecycle === undefined) {
        diags.push({
          severity: sev,
          code: "lifecycle-missing",
          message: `entry "${axisName}.${entry.id}"에 lifecycle 없음`,
          ref: `${ir.taxonomy}:${axisName}.${entry.id}`,
          hint: "lifecycle: <value> 추가",
        });
        continue;
      }
      if (entry.lifecycle === "tbd") {
        if (!entry.placeholderReason && !entry.decisionLink) {
          diags.push({
            severity: "info",
            code: "lifecycle-tbd-orphan",
            message: `tbd entry "${axisName}.${entry.id}"에 placeholderReason 또는 decisionLink 없음`,
            ref: `${ir.taxonomy}:${axisName}.${entry.id}`,
            hint: "placeholderReason 한 줄 또는 decisionLink 추가",
          });
        }
      }
      if (entry.decisionLink) {
        const broken = checkDecisionLink(entry.decisionLink, opts.decisionLinkBaseDir);
        if (broken) {
          diags.push({
            severity: "warning",
            code: "decision-link-broken",
            message: `decisionLink 해소 실패: ${entry.decisionLink} (${broken})`,
            ref: `${ir.taxonomy}:${axisName}.${entry.id}`,
            hint: "파일/URI 확인",
          });
        }
      }
    }
  }

  // tbd 집계 info
  const tbdCount = Array.from(ir.axes.values()).flatMap((a) => a.entries).filter((e) => e.lifecycle === "tbd").length;
  if (tbdCount > 0) {
    diags.push({
      severity: "info",
      code: "lifecycle-tbd",
      message: `placeholder(tbd) entry ${tbdCount}건`,
      meta: { count: tbdCount },
    });
  }

  return diags;
}

function checkDecisionLink(link: string, baseDir?: string): string | null {
  if (link.startsWith("decision-flow://")) return "Stage 3 미지원";
  if (link.startsWith("http://") || link.startsWith("https://")) return null;  // 형식만 OK
  if (link.startsWith("tax:")) return null;  // registry 검증은 별도 (resolveRef)
  // path
  if (!baseDir) return null;
  const abs = isAbsolute(link) ? link : resolve(baseDir, link);
  return existsSync(abs) ? null : "파일 없음";
}
```

- [ ] **Step 4: validate/index.ts에 통합**

```typescript
import { validateLifecycle, type LifecycleValidateOptions } from "./lifecycle.js";

export type ValidateOptions = LifecycleValidateOptions & {
  // 기존 옵션 유지
};

export function validate(ir: TaxonomyIR, opts: ValidateOptions = {}): Diagnostic[] {
  return [
    ...validateCapacity(ir),
    ...validateRef(ir),
    ...validateConstraint(ir),
    ...validateAxis5q(ir),
    ...validateStructure(ir),
    ...validateLifecycle(ir, opts),
  ];
}
```

- [ ] **Step 5: DiagnosticCode union 확장** — `schema/diagnostic.ts`에 4 신규 prefix 추가.

```typescript
export type DiagnosticCode =
  | `parse-${string}`
  | `structural-${string}`
  | `capacity-${string}`
  | `ref-${string}`
  | `constraint-${string}`
  | `axis-5q-${string}`
  | `version-${string}`
  | `codegen-${string}`
  | `doctor-${string}`
  | `lifecycle-${string}`     // 신규
  | `decision-link-${string}`; // 신규
```

- [ ] **Step 6: 테스트 통과 + commit**

```bash
pnpm --filter taxonomy-engine test
git add packages/taxonomy-engine/src/validate/lifecycle.ts \
        packages/taxonomy-engine/src/validate/index.ts \
        packages/taxonomy-engine/src/schema/diagnostic.ts \
        packages/taxonomy-engine/test/validate-lifecycle.test.ts
git commit -m "feat(taxonomy-engine): add lifecycle validators (4 diagnostics)"
```

---
