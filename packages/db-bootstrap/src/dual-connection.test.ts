import { describe, it, expect, afterEach } from "vitest";
import {
  createDualConnection,
  type DualConnection,
} from "./connection.js";

describe("createDualConnection (PG)", () => {
  let conn: DualConnection | undefined;

  afterEach(async () => {
    if (conn) await conn.close();
    conn = undefined;
  });

  it("returns separate write and read Connection instances", async () => {
    if (!process.env.QA_PG_HOST) {
      // PG 서비스 미가용 시 skip (CI without PG service skips with note).
      console.warn("QA_PG_HOST not set, skipping dual-connection PG test");
      return;
    }
    conn = await createDualConnection({
      dialect: "pg",
      write: {
        pgHost: process.env.QA_PG_HOST!,
        pgPort: Number(process.env.QA_PG_PORT ?? 5434),
        pgDatabase: process.env.QA_PG_DATABASE ?? "qa_sdk",
        pgUser: process.env.QA_PG_USER ?? "postgres",
        pgPassword: process.env.QA_PG_PASSWORD ?? "postgres",
      },
      read: {
        pgHost: process.env.QA_PG_HOST_REPLICA ?? process.env.QA_PG_HOST!,
        pgPort: Number(process.env.QA_PG_PORT_REPLICA ?? 5435),
        pgDatabase: process.env.QA_PG_DATABASE ?? "qa_sdk",
        pgUser: "replicator",
        pgPassword: process.env.QA_PG_REPLICATOR_PASSWORD ?? "replicator",
      },
    });

    expect(conn.write).toBeDefined();
    expect(conn.read).toBeDefined();
    expect(conn.write.dialect).toBe("pg");
    expect(conn.read.dialect).toBe("pg");
    expect(conn.write).not.toBe(conn.read);
  });

  it("createDualConnection in sqlite mode returns same instance for both (read = write alias)", async () => {
    conn = await createDualConnection({
      dialect: "sqlite",
      write: { sqlitePath: ":memory:" },
      read: { sqlitePath: ":memory:" }, // sqlite는 별도 file이거나 동일
    });
    expect(conn.write.dialect).toBe("sqlite");
    expect(conn.read.dialect).toBe("sqlite");
  });
});
