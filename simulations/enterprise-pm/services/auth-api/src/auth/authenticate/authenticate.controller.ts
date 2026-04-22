// @def.boundary sim-auth-api
// @def.doc authorization-ontology-bitmap-pipeline

import { Body, Controller, Post, UnauthorizedException } from "@nestjs/common";
import { z } from "zod";
import { UserService } from "../user/user.service.js";

const authSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/**
 * POST /auth/authenticate
 *
 * 시뮬 환경 — 실제 password verify 로직은 sim 스코프 밖. email 존재 여부만 검증.
 * §2 bitmap-pipeline §3 (저장·전달) — gateway가 본 엔드포인트로 userId 확정 후
 * /bitmap/issue를 호출하는 two-step 플로우.
 */
@Controller("auth")
export class AuthenticateController {
  constructor(private readonly users: UserService) {}

  @Post("authenticate")
  async authenticate(@Body() body: unknown) {
    const { email } = authSchema.parse(body);
    const user = await this.users.findByEmail(email);
    if (!user) throw new UnauthorizedException({ error: "invalid_credentials" });
    return {
      userId: user.id,
      displayName: user.displayName,
      departmentId: user.departmentId ?? null,
    };
  }
}
