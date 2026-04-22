// @def.boundary sim-auth-api
// @def.doc authorization-ontology-bitmap-pipeline

import { Module } from "@nestjs/common";
import { AuthenticateController } from "./authenticate.controller.js";
import { UserModule } from "../user/user.module.js";

@Module({
  imports: [UserModule],
  controllers: [AuthenticateController],
})
export class AuthenticateModule {}
