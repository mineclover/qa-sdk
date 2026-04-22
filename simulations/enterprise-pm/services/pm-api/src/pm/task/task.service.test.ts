import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { SqlitePmRepository } from "../sqlite/adapter.js";
import { SIM_PM_SQLITE_DDL } from "../sqlite/schema.js";
import { TaskService } from "./task.service.js";

function fixture() {
  const raw = new Database(":memory:");
  raw.exec(SIM_PM_SQLITE_DDL);
  const repo = new SqlitePmRepository(drizzle({ client: raw }));
  return { repo, svc: new TaskService(repo) };
}

describe("TaskService", () => {
  it("create + find", async () => {
    const { repo, svc } = fixture();
    const p = await repo.createProject({ name: "P", ownerId: "u", departmentId: "d" });
    const t = await svc.create({ projectId: p.id, title: "T" });
    expect((await svc.find(t.id))?.title).toBe("T");
  });
  it("listSubtasks", async () => {
    const { repo, svc } = fixture();
    const p = await repo.createProject({ name: "P", ownerId: "u", departmentId: "d" });
    const parent = await svc.create({ projectId: p.id, title: "Parent" });
    await svc.create({ projectId: p.id, title: "Child", parentTaskId: parent.id });
    expect((await svc.listSubtasks(parent.id)).length).toBe(1);
  });
});
