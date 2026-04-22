// @def.boundary sim-pm-api
// @def.doc authorization-ontology-resource-lifecycle

import { Module } from "@nestjs/common";
import { ProjectService } from "./project.service.js";
import { ProjectController } from "./project.controller.js";
import { ProjectAccessService } from "./project-access.service.js";

@Module({
  providers: [ProjectService, ProjectAccessService],
  controllers: [ProjectController],
  exports: [ProjectService],
})
export class ProjectModule {}
