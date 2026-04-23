// @def.boundary sim-pm-api
// @def.doc authorization-ontology-resource-lifecycle

import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Inject,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";
import { ProjectService } from "./project.service.js";
import { ProjectAccessService } from "./project-access.service.js";
import { CurrentUser, type CurrentUserContext } from "../../auth-deps/current-user.decorator.js";
import { CurrentUserGuard } from "../../auth-deps/current-user.guard.js";

const createSchema = z.object({
  name: z.string().min(1),
  departmentId: z.string().min(1),
  status: z.enum(["draft", "active", "archived"]).optional(),
});

const updateSchema = createSchema.partial();

@Controller("projects")
@UseGuards(CurrentUserGuard)
export class ProjectController {
  constructor(
    @Inject(ProjectService) private readonly svc: ProjectService,
    @Inject(ProjectAccessService) private readonly access: ProjectAccessService,
  ) {}

  @Post()
  async create(@Body() body: unknown, @CurrentUser() user: CurrentUserContext) {
    const parsed = createSchema.parse(body);

    // Pass 1/2 사전 체크 — 생성 시점은 targetId=null, transaction kind 로 평가
    const pre = await this.access.check({
      apiId: "project.create",
      user,
      targetId: null,
      departmentId: parsed.departmentId,
    });
    if (!pre.allow) {
      throw new ForbiddenException({
        error: "access_denied",
        denyReason: pre.denyReason,
        rootSpanId: pre.rootSpanId,
      });
    }

    // ownerId 는 JWT sub 에서 도출 (body 에 없음)
    const project = await this.svc.create({
      name: parsed.name,
      ownerId: user.userId,
      departmentId: parsed.departmentId,
      status: parsed.status,
    });

    return { ...project, rootSpanId: pre.rootSpanId };
  }

  @Get(":id/delegation-graph")
  async delegationGraph(
    @Param("id") id: string,
    @CurrentUser() user: CurrentUserContext,
  ) {
    const p = await this.svc.find(id);
    if (!p) throw new NotFoundException(`Project not found: ${id}`);

    const check = await this.access.check({
      apiId: "project.read",
      user,
      targetId: id,
      resourceOwnerId: p.ownerId,
      departmentId: p.departmentId,
    });
    if (!check.allow) {
      throw new ForbiddenException({
        error: "access_denied",
        denyReason: check.denyReason,
        rootSpanId: check.rootSpanId,
      });
    }

    const snapshot = await this.svc.getDelegationSnapshot(id);
    if (!snapshot) {
      throw new NotFoundException({
        error: "delegation_graph_not_found",
        projectId: id,
      });
    }

    return {
      rootSpanId: check.rootSpanId,
      graphId: snapshot.graphId,
      snapshotId: snapshot.snapshotId,
      nodeCount: snapshot.graph.nodes.length,
      relationCount: snapshot.graph.relations.length,
      graph: snapshot.graph,
    };
  }

  @Get(":id")
  async get(@Param("id") id: string, @CurrentUser() user: CurrentUserContext) {
    const p = await this.svc.find(id);
    if (!p) throw new NotFoundException(`Project not found: ${id}`);

    const check = await this.access.check({
      apiId: "project.read",
      user,
      targetId: id,
      resourceOwnerId: p.ownerId,
      departmentId: p.departmentId,
    });
    if (!check.allow) {
      throw new ForbiddenException({
        error: "access_denied",
        denyReason: check.denyReason,
        rootSpanId: check.rootSpanId,
      });
    }
    return { ...p, rootSpanId: check.rootSpanId };
  }

  @Get()
  async list(@Query("departmentId") deptId: string, @Query("ownerId") ownerId: string) {
    if (deptId) return this.svc.listByDepartment(deptId);
    if (ownerId) return this.svc.listByOwner(ownerId);
    throw new NotFoundException("departmentId or ownerId query required");
  }

  @Put(":id")
  async update(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentUser() user: CurrentUserContext,
  ) {
    const parsed = updateSchema.parse(body);
    const p = await this.svc.find(id);
    if (!p) throw new NotFoundException(`Project not found: ${id}`);

    const check = await this.access.check({
      apiId: "project.update",
      user,
      targetId: id,
      resourceOwnerId: p.ownerId,
      departmentId: p.departmentId,
    });
    if (!check.allow) {
      throw new ForbiddenException({
        error: "access_denied",
        denyReason: check.denyReason,
        rootSpanId: check.rootSpanId,
      });
    }
    const updated = await this.svc.update(id, parsed);
    return { ...updated, rootSpanId: check.rootSpanId };
  }

  @Post(":id/delegate")
  async delegate(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentUser() user: CurrentUserContext,
  ) {
    // Plan 13c 시나리오 6 — minimal delegate endpoint.
    const parsed = z
      .object({
        graphRootId: z.string().min(1),
        delegateUserId: z.string().min(1),
      })
      .parse(body);
    const p = await this.svc.find(id);
    if (!p) throw new NotFoundException(`Project not found: ${id}`);
    const check = await this.access.check({
      apiId: "project.update",
      user,
      targetId: id,
      resourceOwnerId: p.ownerId,
      departmentId: p.departmentId,
    });
    if (!check.allow) {
      throw new ForbiddenException({
        error: "access_denied",
        denyReason: check.denyReason,
        rootSpanId: check.rootSpanId,
      });
    }
    const res = await this.svc.delegate({
      projectId: id,
      graphRootId: parsed.graphRootId,
      delegateUserId: parsed.delegateUserId,
    });
    return { ...res, rootSpanId: check.rootSpanId };
  }

  @Delete(":id")
  async remove(@Param("id") id: string, @CurrentUser() user: CurrentUserContext) {
    const p = await this.svc.find(id);
    if (!p) throw new NotFoundException(`Project not found: ${id}`);

    const check = await this.access.check({
      apiId: "project.delete",
      user,
      targetId: id,
      resourceOwnerId: p.ownerId,
      departmentId: p.departmentId,
    });
    if (!check.allow) {
      throw new ForbiddenException({
        error: "access_denied",
        denyReason: check.denyReason,
        rootSpanId: check.rootSpanId,
      });
    }
    await this.svc.delete(id);
    return { status: "deleted", rootSpanId: check.rootSpanId };
  }
}
