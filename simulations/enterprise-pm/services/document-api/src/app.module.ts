// @def.boundary sim-document-api
// @def.doc sim-erp-pm-design

import { Module } from "@nestjs/common";
import { HealthModule } from "./health/health.module.js";
import { DocumentDbModule } from "./document/document-db.module.js";
import { DocumentModule } from "./document/document/document.module.js";
import { VersionModule } from "./document/version/version.module.js";
import { CommentModule } from "./document/comment/comment.module.js";

@Module({
  imports: [
    HealthModule,
    DocumentDbModule.forRoot(),
    DocumentModule,
    VersionModule,
    CommentModule,
  ],
})
export class AppModule {}
