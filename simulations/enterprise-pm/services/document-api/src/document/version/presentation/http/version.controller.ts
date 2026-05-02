// @def.boundary sim-document-api
// @def.doc domain-slice-architecture

import { Body, Controller, Get, Inject, Param, Post, UseFilters } from "@nestjs/common";
import { z } from "zod";
import { DomainExceptionFilter } from "@qa-sdk/sim-domain-slice-kit";
import { VersionUseCase } from "../../application/use-cases/version.use-case.js";
import {
  VersionReadModelQuery,
  type VersionDetailReadModel,
} from "../../application/queries/version-read-model.query.js";
import { VersionNotFoundException } from "../../domain/index.js";

const createSchema = z.object({
  contentRef: z.string().min(1),
  authorId: z.string().min(1),
});

interface VersionCommandAccepted {
  readonly documentId: string;
  readonly versionNumber: number;
  readonly status: "CREATED";
}

@Controller()
@UseFilters(DomainExceptionFilter)
export class VersionController {
  constructor(
    @Inject(VersionUseCase) private readonly useCase: VersionUseCase,
    @Inject(VersionReadModelQuery) private readonly readModel: VersionReadModelQuery,
  ) {}

  @Post("documents/:id/versions")
  async create(
    @Param("id") id: string,
    @Body() body: unknown,
  ): Promise<VersionCommandAccepted> {
    const parsed = createSchema.parse(body);
    const result = await this.useCase.create({
      documentId: id,
      contentRef: parsed.contentRef,
      authorId: parsed.authorId,
    });
    return result;
  }

  @Get("documents/:id/versions")
  async list(@Param("id") id: string): Promise<VersionDetailReadModel[]> {
    return this.readModel.listByDocument(id);
  }

  @Get("documents/:id/versions/:versionNumber")
  async get(
    @Param("id") id: string,
    @Param("versionNumber") versionNumber: string,
  ): Promise<VersionDetailReadModel> {
    const n = Number(versionNumber);
    const v = await this.readModel.findDetail(id, n);
    if (!v) throw new VersionNotFoundException(id, n);
    return v;
  }
}
