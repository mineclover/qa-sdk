import { Module } from "@nestjs/common";
import { MemberService } from "./member.service.js";
import { MemberController } from "./member.controller.js";

@Module({
  providers: [MemberService],
  controllers: [MemberController],
  exports: [MemberService],
})
export class MemberModule {}
