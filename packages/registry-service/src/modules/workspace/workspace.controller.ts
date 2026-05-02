// @def.boundary registry-system
// @def.doc registry-system

import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  UseFilters,
} from "@nestjs/common";
import { WorkspaceExceptionFilter } from "./workspace.exception-filter.js";
import { WorkspaceService } from "./workspace.service.js";

@UseFilters(new WorkspaceExceptionFilter())
@Controller("workspace")
export class WorkspaceController {
  constructor(@Inject(WorkspaceService) private readonly workspace: WorkspaceService) {}

  @Get("drafts")
  listDrafts() {
    return this.workspace.listDrafts();
  }

  @HttpCode(200)
  @Post("simulate")
  simulate(@Body() body: unknown) {
    return this.workspace.simulate(body);
  }

  @HttpCode(200)
  @Post("analyze")
  analyze() {
    return this.workspace.analyze();
  }

  @HttpCode(200)
  @Post("lock-all")
  lockAll() {
    return this.workspace.lockAll();
  }

  @HttpCode(200)
  @Post("release-all")
  releaseAll() {
    return this.workspace.releaseAll();
  }
}
