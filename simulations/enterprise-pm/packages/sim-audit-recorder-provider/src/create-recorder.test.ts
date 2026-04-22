// @def.boundary sim-audit-recorder-provider
// @def.doc authorization-ontology-nested-audit-tracing

import { afterEach, describe, expect, it } from "vitest";
import { createSimAuditRecorder } from "./create-recorder.js";
import { createInMemorySqliteFixture } from "./memory-sqlite-fixture.js";

describe("createSimAuditRecorder — sqlite (in-memory)", () => {
  let fixture: ReturnType<typeof createInMemorySqliteFixture> | null = null;

  afterEach(() => {
    if (fixture) {
      fixture.close();
      fixture = null;
    }
  });

  it("dialect=sqlite + db 주입 → 실 SqliteAuditRecorder 반환 (not InMemory)", async () => {
    fixture = createInMemorySqliteFixture();
    const recorder = await createSimAuditRecorder({
      dialect: "sqlite",
      db: fixture.db,
    });
    expect(recorder).toBeDefined();
    expect(recorder.constructor.name).toBe("SqliteAuditRecorder");
  });

  it("dialect 미지원 → throw (no silent fallback)", async () => {
    await expect(
      createSimAuditRecorder({ dialect: "invalid" as never, db: {} as never }),
    ).rejects.toThrow(/dialect/);
  });

  it("db 미주입 → throw", async () => {
    await expect(
      createSimAuditRecorder({ dialect: "sqlite", db: null as never }),
    ).rejects.toThrow(/db/);
  });
});
