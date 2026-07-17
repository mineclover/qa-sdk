---
def:
  id: taxonomy-engine-plan-v0-8-phase-d
  type: knowledge
  knowledge_kind: proposal
  lifecycle: approved
  owner_system: taxonomy-engine
  projection_plane: intent
  scope: meta
  aspect: proposal_design
  tier: component
  depth: implementation
status: implemented
date: 2026-07-05
part_of: taxonomy-engine
role: plan-v0-8-phase-d-cli
sources:
  - packages/cli/src/commands/taxonomy/validate.ts
  - packages/cli/src/commands/taxonomy/show.ts
  - packages/cli/src/commands/taxonomy/index.ts
  - packages/cli/src/command-groups/taxonomy.commands.ts
---

# Taxonomy Engine v0.8 — Phase D — CLI 확장

## 목적 ^purpose

v0.8 Phase D CLI 확장 계획 원문을 보존한다.

## Phase D — CLI 확장

### Task D1: `tax validate --lifecycle-strict` + `tax show` lifecycle 표시

**Files:**
- Modify: `packages/cli/src/commands/taxonomy/validate.ts`
- Modify: `packages/cli/src/commands/taxonomy/show.ts`
- Create: `packages/cli/test/taxonomy-lifecycle.test.ts`

- [ ] **Step 1: 실패 테스트 작성** — CLI smoke

```typescript
import { describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("tax lifecycle CLI", () => {
  it("--lifecycle-strict 시 lifecycle 누락 → exit code 1", () => {
    const dir = mkdtempSync(join(tmpdir(), "tax-lc-"));
    const file = join(dir, "t.yaml");
    writeFileSync(file, `taxonomy: t
version: 1
axes:
  a:
    entries: [x]
`);
    expect(() =>
      execSync(`pnpm --silent --filter @qa-sdk/cli exec tax validate ${file} --lifecycle-strict`, { stdio: "pipe" })
    ).toThrow();
  });

  it("show 출력에 lifecycle 포함", () => {
    const dir = mkdtempSync(join(tmpdir(), "tax-lc-"));
    const file = join(dir, "t.yaml");
    writeFileSync(file, `taxonomy: t
version: 1
axes:
  a:
    entries: [{ id: x, address: 0, lifecycle: tbd, placeholderReason: "미정" }]
`);
    const out = execSync(
      `pnpm --silent --filter @qa-sdk/cli exec tax show ${file} t:a.x`,
      { encoding: "utf8" }
    );
    expect(out).toMatch(/tbd/);
    expect(out).toMatch(/미정/);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**.

- [ ] **Step 3: validate.ts에 `--lifecycle-strict` flag**

```typescript
const lifecycleStrict = args.includes("--lifecycle-strict");
const decisionLinkBaseDir = dirname(filePath);
const diags = validate(ir, { lifecycleStrict, decisionLinkBaseDir });
```

- [ ] **Step 4: show.ts entry 출력에 lifecycle/placeholderReason/decisionLink 표시**

```typescript
if (entry.lifecycle) lines.push(`  lifecycle: ${entry.lifecycle}`);
if (entry.placeholderReason) lines.push(`  reason:    ${entry.placeholderReason}`);
if (entry.decisionLink) lines.push(`  decision:  ${entry.decisionLink}`);
```

- [ ] **Step 5: 테스트 통과 + commit**

```bash
pnpm --filter @qa-sdk/cli test
git add packages/cli/src/commands/taxonomy/ packages/cli/test/taxonomy-lifecycle.test.ts
git commit -m "feat(cli): tax validate --lifecycle-strict + show lifecycle fields"
```

---
