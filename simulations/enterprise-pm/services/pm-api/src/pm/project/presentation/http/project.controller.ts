// @def.boundary sim-pm-api
// @def.doc domain-slice-architecture

import { randomUUID } from 'node:crypto';
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
} from '@nestjs/common';
import { z } from 'zod';
import { ProjectUseCase } from '../../application/use-cases/project.use-case.js';
import {
  ProjectReadModelQuery,
  type ProjectDetailReadModel,
} from '../../application/queries/project-read-model.query.js';
import { ProjectAccessService } from '../../application/services/project-access.service.js';
import {
  CurrentUser,
  type CurrentUserContext,
} from '../../../../auth-deps/current-user.decorator.js';
import { CurrentUserGuard } from '../../../../auth-deps/current-user.guard.js';

const createSchema = z.object({
  name: z.string().min(1),
  departmentId: z.string().min(1),
  status: z.enum(['draft', 'active', 'archived']).optional(),
});

const updateSchema = createSchema.partial();

/**
 * Project HTTP controller.
 *
 * 기존 routing surface 유지 (access check 보존):
 *   - POST /projects
 *   - GET /projects/:id
 *   - GET /projects/:id/delegation-graph
 *   - GET /projects?departmentId=...&ownerId=...
 *   - PUT /projects/:id
 *   - POST /projects/:id/delegate
 *   - POST /projects/:id/delegates
 *   - DELETE /projects/:id
 */
@Controller('projects')
@UseGuards(CurrentUserGuard)
export class ProjectController {
  constructor(
    @Inject(ProjectUseCase) private readonly useCase: ProjectUseCase,
    @Inject(ProjectReadModelQuery) private readonly readModel: ProjectReadModelQuery,
    @Inject(ProjectAccessService) private readonly access: ProjectAccessService,
  ) {}

  @Post()
  async create(
    @Body() body: unknown,
    @CurrentUser() user: CurrentUserContext,
  ): Promise<ProjectDetailReadModel & { rootSpanId: string }> {
    const parsed = createSchema.parse(body);

    const pre = await this.access.check({
      apiId: 'project.create',
      user,
      targetId: null,
      departmentId: parsed.departmentId,
    });
    if (!pre.allow) {
      throw new ForbiddenException({
        error: 'access_denied',
        denyReason: pre.denyReason,
        rootSpanId: pre.rootSpanId,
      });
    }

    const result = await this.useCase.create({
      id: randomUUID(),
      name: parsed.name,
      ownerId: user.userId,
      departmentId: parsed.departmentId,
      status: parsed.status,
    });
    return { ...result, rootSpanId: pre.rootSpanId };
  }

  @Get(':id/delegation-graph')
  async delegationGraph(@Param('id') id: string, @CurrentUser() user: CurrentUserContext) {
    const p = await this.readModel.findDetail(id);
    if (!p) throw new NotFoundException(`Project not found: ${id}`);

    const check = await this.access.check({
      apiId: 'project.read',
      user,
      targetId: id,
      resourceOwnerId: p.ownerId,
      departmentId: p.departmentId,
    });
    if (!check.allow) {
      throw new ForbiddenException({
        error: 'access_denied',
        denyReason: check.denyReason,
        rootSpanId: check.rootSpanId,
      });
    }

    const snapshot = await this.readModel.findDelegationSnapshot(id);
    if (!snapshot) {
      throw new NotFoundException({
        error: 'delegation_graph_not_found',
        projectId: id,
      });
    }

    return {
      rootSpanId: check.rootSpanId,
      graphId: snapshot.graphId,
      snapshotId: snapshot.snapshotId,
      nodeCount: snapshot.nodeCount,
      relationCount: snapshot.relationCount,
      graph: snapshot.graph,
    };
  }

  @Get(':id')
  async get(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserContext,
  ): Promise<ProjectDetailReadModel & { rootSpanId: string }> {
    const p = await this.readModel.findDetail(id);
    if (!p) throw new NotFoundException(`Project not found: ${id}`);

    const check = await this.access.check({
      apiId: 'project.read',
      user,
      targetId: id,
      resourceOwnerId: p.ownerId,
      departmentId: p.departmentId,
    });
    if (!check.allow) {
      throw new ForbiddenException({
        error: 'access_denied',
        denyReason: check.denyReason,
        rootSpanId: check.rootSpanId,
      });
    }
    return { ...p, rootSpanId: check.rootSpanId };
  }

  @Get()
  async list(
    @Query('departmentId') deptId: string,
    @Query('ownerId') ownerId: string,
  ): Promise<ProjectDetailReadModel[]> {
    if (deptId) return this.readModel.listByDepartment(deptId);
    if (ownerId) return this.readModel.listByOwner(ownerId);
    throw new NotFoundException('departmentId or ownerId query required');
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() user: CurrentUserContext,
  ): Promise<ProjectDetailReadModel & { rootSpanId: string }> {
    const parsed = updateSchema.parse(body);
    const p = await this.readModel.findDetail(id);
    if (!p) throw new NotFoundException(`Project not found: ${id}`);

    const check = await this.access.check({
      apiId: 'project.update',
      user,
      targetId: id,
      resourceOwnerId: p.ownerId,
      departmentId: p.departmentId,
    });
    if (!check.allow) {
      throw new ForbiddenException({
        error: 'access_denied',
        denyReason: check.denyReason,
        rootSpanId: check.rootSpanId,
      });
    }
    const updated = await this.useCase.update({ id, patch: parsed });
    return { ...updated, rootSpanId: check.rootSpanId };
  }

  @Post(':id/delegate')
  async delegate(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() user: CurrentUserContext,
  ) {
    const parsed = z
      .object({
        graphRootId: z.string().min(1),
        delegateUserId: z.string().min(1),
      })
      .parse(body);
    const p = await this.readModel.findDetail(id);
    if (!p) throw new NotFoundException(`Project not found: ${id}`);
    const check = await this.access.check({
      apiId: 'project.update',
      user,
      targetId: id,
      resourceOwnerId: p.ownerId,
      departmentId: p.departmentId,
    });
    if (!check.allow) {
      throw new ForbiddenException({
        error: 'access_denied',
        denyReason: check.denyReason,
        rootSpanId: check.rootSpanId,
      });
    }
    const res = await this.useCase.delegate({
      id,
      graphRootId: parsed.graphRootId,
      delegateUserId: parsed.delegateUserId,
    });
    return { ...res, rootSpanId: check.rootSpanId };
  }

  @Post(':id/delegates')
  async addDelegate(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() user: CurrentUserContext,
  ) {
    const parsed = z
      .object({
        delegateUserId: z.string().min(1),
      })
      .parse(body);
    const p = await this.readModel.findDetail(id);
    if (!p) throw new NotFoundException(`Project not found: ${id}`);
    const check = await this.access.check({
      apiId: 'project.update',
      user,
      targetId: id,
      resourceOwnerId: p.ownerId,
      departmentId: p.departmentId,
    });
    if (!check.allow) {
      throw new ForbiddenException({
        error: 'access_denied',
        denyReason: check.denyReason,
        rootSpanId: check.rootSpanId,
      });
    }
    const res = await this.useCase.addDelegate({
      id,
      delegateUserId: parsed.delegateUserId,
    });
    return { ...res, rootSpanId: check.rootSpanId };
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser() user: CurrentUserContext) {
    const p = await this.readModel.findDetail(id);
    if (!p) throw new NotFoundException(`Project not found: ${id}`);

    const check = await this.access.check({
      apiId: 'project.delete',
      user,
      targetId: id,
      resourceOwnerId: p.ownerId,
      departmentId: p.departmentId,
    });
    if (!check.allow) {
      throw new ForbiddenException({
        error: 'access_denied',
        denyReason: check.denyReason,
        rootSpanId: check.rootSpanId,
      });
    }
    await this.useCase.delete({ id });
    return { status: 'deleted', rootSpanId: check.rootSpanId };
  }
}
