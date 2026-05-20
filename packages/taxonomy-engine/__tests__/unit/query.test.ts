import { describe, it, expect } from "vitest";
import { show } from "../../src/query/index.js";
import { TaxonomyRegistry } from "../../src/registry/index.js";
import { parse } from "../../src/parser/index.js";

const yaml = `
taxonomy: t
version: 1
axes:
  scope:
    entries: [apm, ingest]
`;

const reg = new TaxonomyRegistry();
const r = parse(yaml);
if ("ir" in r) reg.add(r.ir);

describe("show", () => {
  it("3-tier 모두 같은 단위 반환 — entry", () => {
    const a = show("t:scope.apm", reg);
    const b = show("t#/axes/scope/entries/apm", reg);
    const c = show("t::scope#0", reg);
    expect(a?.kind).toBe("entry");
    expect(b?.kind).toBe("entry");
    expect(c?.kind).toBe("entry");
    if (a?.kind === "entry" && b?.kind === "entry" && c?.kind === "entry") {
      expect((a.entry as { id: string }).id).toBe("apm");
      expect((b.entry as { id: string }).id).toBe("apm");
      expect((c.entry as { id: string }).id).toBe("apm");
    }
  });

  it("fail-open — unknown → undefined", () => {
    expect(show("t:scope.unknown", reg)).toBeUndefined();
    expect(show("unknown-tax:scope.apm", reg)).toBeUndefined();
  });
});
