// @def.boundary sim-pm-api
// @def.doc domain-slice-architecture

import { describe, expect, it, vi } from "vitest";
import { ProjectUseCase } from "./project.use-case.js";
import { ProjectEntity, ProjectNotFoundException } from "../../domain/index.js";
import type { ProjectRepositoryPort } from "../ports/project-repository.port.js";
import type {
  ProjectOutboxPort,
  ProjectOutboxRecord,
} from "../ports/project-outbox.port.js";
import type {
  ProjectTransactionPort,
  ProjectTransactionScope,
} from "../ports/project-transaction.port.js";
import type { ProjectLoggerPort } from "../ports/project-logger.port.js";
import type {
  PolicyLifecyclePort,
  DelegationGraphPort,
} from "../ports/project-policy.port.js";

function makeMocks() {
  const calls: string[] = [];
  const scope: ProjectTransactionScope = { id: "tx-1", startedAt: new Date() };

  const transaction: ProjectTransactionPort = {
    async run<T>(_name: string, work: (s: ProjectTransactionScope) => Promise<T>): Promise<T> {
      calls.push(`transaction.run.${_name}`);
      const r = await work(scope);
      calls.push(`transaction.run.${_name}.commit`);
      return r;
    },
  };

  const repository: ProjectRepositoryPort = {
    save: vi.fn(async () => {
      calls.push("repository.save");
    }),
    findById: vi.fn(async () => null),
    listByDepartment: vi.fn(async () => []),
    listByOwner: vi.fn(async () => []),
    delete: vi.fn(async () => {
      calls.push("repository.delete");
    }),
  };

  const outboxRecords: ProjectOutboxRecord[] = [];
  const outbox: ProjectOutboxPort = {
    append: vi.fn(async (record: ProjectOutboxRecord) => {
      calls.push(`outbox.append:${record.eventName}`);
      outboxRecords.push(record);
    }),
  };

  const logged: Array<{ level: string; ctx: Record<string, unknown>; msg: string }> = [];
  const logger: ProjectLoggerPort = {
    info: (ctx, msg) => {
      calls.push(`logger.info:${(ctx as { outcome?: string }).outcome ?? "started"}`);
      logged.push({ level: "info", ctx: ctx as never, msg });
    },
    warn: (ctx, msg) => {
      logged.push({ level: "warn", ctx: ctx as never, msg });
    },
    error: (ctx, msg) => {
      calls.push(`logger.error:${(ctx as { outcome?: string }).outcome ?? "?"}`);
      logged.push({ level: "error", ctx: ctx as never, msg });
    },
  };

  const policies: PolicyLifecyclePort = {
    create: vi.fn(async () => undefined),
    remove: vi.fn(async () => undefined),
    resolve: vi.fn(async () => null),
    register: vi.fn(async () => undefined),
    delegate: vi.fn(async () => undefined),
  };

  const delegationGraph: DelegationGraphPort = {
    grant: vi.fn(async () => undefined),
    getLatest: vi.fn(async () => null),
  };

  return {
    transaction,
    repository,
    outbox,
    outboxRecords,
    logger,
    logged,
    calls,
    policies,
    delegationGraph,
  };
}

describe("ProjectUseCase.create", () => {
  const command = {
    id: "prj_1",
    name: "Demo",
    ownerId: "u_1",
    departmentId: "d_1",
    traceId: "trc_p",
    correlationId: "cor_p",
  };

  it("transaction.run wrapping repository.save + outbox.append", async () => {
    const m = makeMocks();
    const useCase = new ProjectUseCase(
      m.repository,
      m.outbox,
      m.transaction,
      m.logger,
      m.policies,
    );
    await useCase.create(command);

    expect(m.calls).toEqual([
      "logger.info:started",
      "transaction.run.project.create",
      "repository.save",
      "outbox.append:project.created",
      "transaction.run.project.create.commit",
      "logger.info:success",
    ]);
    expect(m.policies.create).toHaveBeenCalledWith({
      resourceId: "prj_1",
      resourceType: "project",
      ownerId: "u_1",
    });
  });

  it("policy registry 미등록 시 warn 로그 후 정상 종료", async () => {
    const m = makeMocks();
    const useCase = new ProjectUseCase(m.repository, m.outbox, m.transaction, m.logger);
    await useCase.create(command);
    const warn = m.logged.find((l) => l.msg === "project.create.policy_registry_missing");
    expect(warn).toBeDefined();
  });

  it("policy create 실패 시 project 롤백 + rethrow", async () => {
    const m = makeMocks();
    (m.policies.create as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("policy boom"),
    );
    const useCase = new ProjectUseCase(
      m.repository,
      m.outbox,
      m.transaction,
      m.logger,
      m.policies,
    );
    await expect(useCase.create(command)).rejects.toThrow("policy boom");
    expect(m.repository.delete).toHaveBeenCalled();
  });

  it("logger SliceLogContext 표준 필드 emit", async () => {
    const m = makeMocks();
    const useCase = new ProjectUseCase(
      m.repository,
      m.outbox,
      m.transaction,
      m.logger,
      m.policies,
    );
    await useCase.create(command);
    const startedLog = m.logged.find((l) => l.msg === "project.create.started")!;
    expect(startedLog.ctx).toMatchObject({
      domain: "project",
      useCase: "ProjectUseCase.create",
      commandName: "CreateProjectCommand",
    });
  });
});

describe("ProjectUseCase.update", () => {
  it("미존재 시 ProjectNotFoundException", async () => {
    const m = makeMocks();
    const useCase = new ProjectUseCase(m.repository, m.outbox, m.transaction, m.logger);
    await expect(
      useCase.update({ id: "missing", patch: { name: "X" } }),
    ).rejects.toThrow(ProjectNotFoundException);
  });

  it("기존 project 의 name 패치 후 outbox 발행", async () => {
    const m = makeMocks();
    const existing = ProjectEntity.create({
      id: "prj_2",
      name: "Old",
      ownerId: "u_1",
      departmentId: "d_1",
    });
    (m.repository.findById as ReturnType<typeof vi.fn>).mockResolvedValueOnce(existing);
    const useCase = new ProjectUseCase(m.repository, m.outbox, m.transaction, m.logger);
    const result = await useCase.update({ id: "prj_2", patch: { name: "New" } });
    expect(result.name).toBe("New");
    expect(m.outboxRecords[0].eventName).toBe("project.updated");
  });
});

describe("ProjectUseCase.delete", () => {
  it("repository.delete + outbox + policy.remove", async () => {
    const m = makeMocks();
    const useCase = new ProjectUseCase(
      m.repository,
      m.outbox,
      m.transaction,
      m.logger,
      m.policies,
    );
    await useCase.delete({ id: "prj_3" });
    expect(m.repository.delete).toHaveBeenCalled();
    expect(m.policies.remove).toHaveBeenCalledWith("prj_3");
    expect(m.outboxRecords[0].eventName).toBe("project.deleted");
  });
});

describe("ProjectUseCase.delegate", () => {
  it("policies 미등록 시 throw", async () => {
    const m = makeMocks();
    const useCase = new ProjectUseCase(m.repository, m.outbox, m.transaction, m.logger);
    await expect(
      useCase.delegate({
        id: "prj_d",
        graphRootId: "g1",
        delegateUserId: "u_d",
      }),
    ).rejects.toThrow();
  });

  it("UNREGISTERED → REGISTERED → DELEGATED + grant", async () => {
    const m = makeMocks();
    (m.policies.resolve as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      state: "UNREGISTERED",
    });
    const useCase = new ProjectUseCase(
      m.repository,
      m.outbox,
      m.transaction,
      m.logger,
      m.policies,
      m.delegationGraph,
    );
    const result = await useCase.delegate({
      id: "prj_d",
      graphRootId: "g1",
      delegateUserId: "u_d",
    });
    expect(result.state).toBe("DELEGATED");
    expect(m.policies.register).toHaveBeenCalled();
    expect(m.policies.delegate).toHaveBeenCalledWith("prj_d", { graphRootId: "g1" });
    expect(m.delegationGraph.grant).toHaveBeenCalledWith("g1", "u_d");
    expect(m.outboxRecords.find((r) => r.eventName === "project.delegated")).toBeDefined();
  });
});

describe("ProjectUseCase.addDelegate", () => {
  it("DELEGATED 상태 아니면 throw", async () => {
    const m = makeMocks();
    (m.policies.resolve as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      state: "REGISTERED",
    });
    const useCase = new ProjectUseCase(
      m.repository,
      m.outbox,
      m.transaction,
      m.logger,
      m.policies,
      m.delegationGraph,
    );
    await expect(
      useCase.addDelegate({ id: "prj_d", delegateUserId: "u_e" }),
    ).rejects.toThrow();
  });

  it("DELEGATED 상태에서 grant", async () => {
    const m = makeMocks();
    (m.policies.resolve as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      state: "DELEGATED",
      graphRootId: "g1",
    });
    const useCase = new ProjectUseCase(
      m.repository,
      m.outbox,
      m.transaction,
      m.logger,
      m.policies,
      m.delegationGraph,
    );
    const result = await useCase.addDelegate({ id: "prj_d", delegateUserId: "u_e" });
    expect(result.graphRootId).toBe("g1");
    expect(m.delegationGraph.grant).toHaveBeenCalledWith("g1", "u_e");
  });
});
