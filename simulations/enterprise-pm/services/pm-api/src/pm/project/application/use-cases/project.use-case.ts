// @def.boundary sim-pm-api
// @def.doc domain-slice-architecture

import { ProjectEntity, ProjectNotFoundException } from "../../domain/index.js";
import type {
  CreateProjectCommand,
  DeleteProjectCommand,
  UpdateProjectCommand,
  DelegateProjectCommand,
  AddProjectDelegateCommand,
} from "../commands/create-project.command.js";
import type { ProjectLoggerPort } from "../ports/project-logger.port.js";
import type {
  ProjectOutboxPort,
  ProjectCreatedEventPayload,
  ProjectUpdatedEventPayload,
  ProjectDeletedEventPayload,
  ProjectDelegatedEventPayload,
} from "../ports/project-outbox.port.js";
import type { ProjectRepositoryPort } from "../ports/project-repository.port.js";
import type { ProjectTransactionPort } from "../ports/project-transaction.port.js";
import type {
  PolicyLifecyclePort,
  DelegationGraphPort,
} from "../ports/project-policy.port.js";

/**
 * Project 슬라이스의 use-case.
 *
 * - 라이프사이클 (Domain): draft → active → archived
 * - 권한 라이프사이클 (Policy via Optional ports): UNREGISTERED → REGISTERED → DELEGATED
 * - 기존 ProjectService 의 동작을 보존:
 *   - create: project INSERT + UNREGISTERED policy (best-effort, fail-open warn)
 *     실패 시 project 롤백
 *   - delete: project DELETE + policy remove (best-effort)
 *   - delegate: REGISTER + DELEGATE + delegationGraph.grant
 */
export class ProjectUseCase {
  constructor(
    private readonly repository: ProjectRepositoryPort,
    private readonly outbox: ProjectOutboxPort,
    private readonly transaction: ProjectTransactionPort,
    private readonly logger: ProjectLoggerPort,
    private readonly policies?: PolicyLifecyclePort,
    private readonly delegationGraph?: DelegationGraphPort,
  ) {}

  async create(command: CreateProjectCommand): Promise<{
    readonly id: string;
    readonly name: string;
    readonly ownerId: string;
    readonly departmentId: string;
    readonly status: string;
    readonly createdAt: string;
    readonly updatedAt: string;
  }> {
    const traceId = command.traceId ?? `trace-${command.id}`;
    const correlationId = command.correlationId ?? traceId;
    const ctxBase = {
      traceId,
      correlationId,
      domain: "project",
      useCase: "ProjectUseCase.create",
      aggregateId: command.id,
      commandName: "CreateProjectCommand",
    } as const;

    this.logger.info({ ...ctxBase }, "project.create.started");

    try {
      let snapshotResult: ReturnType<ProjectEntity["toSnapshot"]>;
      await this.transaction.run("project.create", async (scope) => {
        const project = ProjectEntity.create({
          id: command.id,
          name: command.name,
          ownerId: command.ownerId,
          departmentId: command.departmentId,
          status: command.status,
        });
        await this.repository.save(project, scope);
        snapshotResult = project.toSnapshot();
        const payload: ProjectCreatedEventPayload = {
          id: command.id,
          name: command.name,
          ownerId: command.ownerId,
          departmentId: command.departmentId,
          status: snapshotResult.status,
          occurredAt: new Date().toISOString(),
        };
        await this.outbox.append(
          {
            aggregateId: command.id,
            eventName: "project.created",
            eventVersion: 1,
            payload,
            occurredAt: new Date(),
          },
          scope,
        );
      });

      // policy lifecycle: UNREGISTERED 등록 (best-effort, fail-open).
      if (this.policies) {
        try {
          await this.policies.create({
            resourceId: command.id,
            resourceType: "project",
            ownerId: command.ownerId,
          });
        } catch (err) {
          // 등록 실패 — project 롤백.
          this.logger.error(
            {
              ...ctxBase,
              outcome: "failure",
              errorCode: "POLICY_CREATE_FAILURE",
              err,
            },
            "project.create.policy_failure_rollback",
          );
          // best-effort 롤백 (policy create 실패 시 project 도 제거).
          await this.transaction.run("project.create.rollback", async (scope) => {
            await this.repository.delete(command.id, scope);
          });
          throw err;
        }
      } else {
        this.logger.warn(
          { ...ctxBase },
          "project.create.policy_registry_missing",
        );
      }

      this.logger.info(
        { ...ctxBase, eventName: "project.created", eventVersion: 1, outcome: "success" },
        "project.create.success",
      );
      return snapshotResult!;
    } catch (error) {
      this.logger.error(
        {
          ...ctxBase,
          outcome: "failure",
          errorCode: error instanceof Error ? error.name : "UNKNOWN_ERROR",
          err: error,
        },
        "project.create.failure",
      );
      throw error;
    }
  }

  async update(command: UpdateProjectCommand): Promise<{
    readonly id: string;
    readonly name: string;
    readonly ownerId: string;
    readonly departmentId: string;
    readonly status: string;
    readonly createdAt: string;
    readonly updatedAt: string;
  }> {
    const traceId = command.traceId ?? `trace-${command.id}`;
    const correlationId = command.correlationId ?? traceId;
    const ctxBase = {
      traceId,
      correlationId,
      domain: "project",
      useCase: "ProjectUseCase.update",
      aggregateId: command.id,
      commandName: "UpdateProjectCommand",
    } as const;

    this.logger.info({ ...ctxBase }, "project.update.started");

    try {
      let snapshotResult: ReturnType<ProjectEntity["toSnapshot"]>;
      await this.transaction.run("project.update", async (scope) => {
        const cur = await this.repository.findById(command.id);
        if (!cur) throw new ProjectNotFoundException(command.id);
        const next = cur.applyPatch(command.patch);
        await this.repository.save(next, scope);
        snapshotResult = next.toSnapshot();
        const payload: ProjectUpdatedEventPayload = {
          id: command.id,
          status: snapshotResult.status,
          occurredAt: new Date().toISOString(),
        };
        await this.outbox.append(
          {
            aggregateId: command.id,
            eventName: "project.updated",
            eventVersion: 1,
            payload,
            occurredAt: new Date(),
          },
          scope,
        );
      });

      this.logger.info(
        { ...ctxBase, eventName: "project.updated", eventVersion: 1, outcome: "success" },
        "project.update.success",
      );
      return snapshotResult!;
    } catch (error) {
      this.logger.error(
        {
          ...ctxBase,
          outcome: "failure",
          errorCode: error instanceof Error ? error.name : "UNKNOWN_ERROR",
          err: error,
        },
        "project.update.failure",
      );
      throw error;
    }
  }

  async delete(command: DeleteProjectCommand): Promise<void> {
    const traceId = command.traceId ?? `trace-${command.id}`;
    const correlationId = command.correlationId ?? traceId;
    const ctxBase = {
      traceId,
      correlationId,
      domain: "project",
      useCase: "ProjectUseCase.delete",
      aggregateId: command.id,
      commandName: "DeleteProjectCommand",
    } as const;

    this.logger.info({ ...ctxBase }, "project.delete.started");

    try {
      await this.transaction.run("project.delete", async (scope) => {
        await this.repository.delete(command.id, scope);
        const payload: ProjectDeletedEventPayload = {
          id: command.id,
          occurredAt: new Date().toISOString(),
        };
        await this.outbox.append(
          {
            aggregateId: command.id,
            eventName: "project.deleted",
            eventVersion: 1,
            payload,
            occurredAt: new Date(),
          },
          scope,
        );
      });

      // policy 도 함께 제거 — best-effort.
      if (this.policies) {
        try {
          await this.policies.remove(command.id);
        } catch (err) {
          this.logger.warn(
            { ...ctxBase },
            `project.delete.policy_remove_failure: ${(err as Error).message}`,
          );
        }
      }

      this.logger.info(
        { ...ctxBase, eventName: "project.deleted", eventVersion: 1, outcome: "success" },
        "project.delete.success",
      );
    } catch (error) {
      this.logger.error(
        {
          ...ctxBase,
          outcome: "failure",
          errorCode: error instanceof Error ? error.name : "UNKNOWN_ERROR",
          err: error,
        },
        "project.delete.failure",
      );
      throw error;
    }
  }

  /**
   * Project delegation — Plan 13c 시나리오 6.
   *
   * Lifecycle:
   *   - UNREGISTERED → REGISTERED (cerbosPolicyRef)
   *   - → DELEGATED (graphRootId)
   *   - delegationGraph.grant(graphRootId, delegateUserId)
   */
  async delegate(command: DelegateProjectCommand): Promise<{
    readonly state: string;
    readonly graphRootId: string;
  }> {
    const traceId = command.traceId ?? `trace-${command.id}`;
    const correlationId = command.correlationId ?? traceId;
    const ctxBase = {
      traceId,
      correlationId,
      domain: "project",
      useCase: "ProjectUseCase.delegate",
      aggregateId: command.id,
      commandName: "DelegateProjectCommand",
    } as const;

    this.logger.info({ ...ctxBase }, "project.delegate.started");

    if (!this.policies) {
      const err = new Error("PROJECT_POLICY_REGISTRY not registered — delegate 불가");
      this.logger.error({ ...ctxBase, outcome: "failure", err }, "project.delegate.failure");
      throw err;
    }

    try {
      const cur = await this.policies.resolve(command.id);
      if (!cur) {
        const err = new Error(`policy not found for project ${command.id}`);
        this.logger.error({ ...ctxBase, outcome: "failure", err }, "project.delegate.failure");
        throw err;
      }
      if (cur.state === "UNREGISTERED") {
        await this.policies.register(command.id, {
          cerbosPolicyRef: `project-${command.id}`,
        });
      }
      await this.policies.delegate(command.id, { graphRootId: command.graphRootId });
      if (this.delegationGraph) {
        await this.delegationGraph.grant(command.graphRootId, command.delegateUserId);
      }

      // delegate event emit (별도 트랜잭션 - policy 외부 store 라 outbox 와 동일 tx 보장 안 됨).
      await this.transaction.run("project.delegate", async (scope) => {
        const payload: ProjectDelegatedEventPayload = {
          id: command.id,
          graphRootId: command.graphRootId,
          delegateUserId: command.delegateUserId,
          occurredAt: new Date().toISOString(),
        };
        await this.outbox.append(
          {
            aggregateId: command.id,
            eventName: "project.delegated",
            eventVersion: 1,
            payload,
            occurredAt: new Date(),
          },
          scope,
        );
      });

      this.logger.info(
        { ...ctxBase, eventName: "project.delegated", eventVersion: 1, outcome: "success" },
        "project.delegate.success",
      );
      return { state: "DELEGATED", graphRootId: command.graphRootId };
    } catch (error) {
      this.logger.error(
        {
          ...ctxBase,
          outcome: "failure",
          errorCode: error instanceof Error ? error.name : "UNKNOWN_ERROR",
          err: error,
        },
        "project.delegate.failure",
      );
      throw error;
    }
  }

  async addDelegate(command: AddProjectDelegateCommand): Promise<{
    readonly state: string;
    readonly graphRootId: string;
    readonly delegateUserId: string;
  }> {
    const traceId = command.traceId ?? `trace-${command.id}`;
    const correlationId = command.correlationId ?? traceId;
    const ctxBase = {
      traceId,
      correlationId,
      domain: "project",
      useCase: "ProjectUseCase.addDelegate",
      aggregateId: command.id,
      commandName: "AddProjectDelegateCommand",
    } as const;

    this.logger.info({ ...ctxBase }, "project.addDelegate.started");

    if (!this.policies || !this.delegationGraph) {
      const err = new Error(
        "PROJECT_POLICY_REGISTRY or PROJECT_DELEGATION_GRAPH not registered — addDelegate 불가",
      );
      this.logger.error({ ...ctxBase, outcome: "failure", err }, "project.addDelegate.failure");
      throw err;
    }

    try {
      const cur = await this.policies.resolve(command.id);
      if (!cur) {
        const err = new Error(`policy not found for project ${command.id}`);
        this.logger.error({ ...ctxBase, outcome: "failure", err }, "project.addDelegate.failure");
        throw err;
      }
      if (cur.state !== "DELEGATED" || !cur.graphRootId) {
        const err = new Error(`project ${command.id} is not in DELEGATED state`);
        this.logger.error({ ...ctxBase, outcome: "failure", err }, "project.addDelegate.failure");
        throw err;
      }
      await this.delegationGraph.grant(cur.graphRootId, command.delegateUserId);

      this.logger.info(
        { ...ctxBase, outcome: "success" },
        "project.addDelegate.success",
      );
      return {
        state: cur.state,
        graphRootId: cur.graphRootId,
        delegateUserId: command.delegateUserId,
      };
    } catch (error) {
      this.logger.error(
        {
          ...ctxBase,
          outcome: "failure",
          errorCode: error instanceof Error ? error.name : "UNKNOWN_ERROR",
          err: error,
        },
        "project.addDelegate.failure",
      );
      throw error;
    }
  }
}
