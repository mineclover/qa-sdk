// @def.boundary sim-auth-api
// @def.doc authorization-ontology-bitmap-pipeline

import { Body, Controller, Inject, Post, UnauthorizedException } from "@nestjs/common";
import { z } from "zod";
import { UserService } from "../user/user.service.js";
import { CREDENTIAL_STORE, type CredentialStore } from "./credential-store.js";

const authSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/**
 * POST /auth/authenticate
 *
 * sim 편의 — email 존재 + credentialStore.verify(email, password) 양자 통과 시 userId 반환.
 * 실패 시 401 — 동일한 오류 메시지로 타이밍 공격 방지 고려는 §Defer.
 */
@Controller("auth")
export class AuthenticateController {
  constructor(
    @Inject(UserService) private readonly users: UserService,
    @Inject(CREDENTIAL_STORE) private readonly credentials: CredentialStore,
  ) {}

  @Post("authenticate")
  async authenticate(@Body() body: unknown) {
    const { email, password } = authSchema.parse(body);
    const user = await this.users.findByEmail(email);
    if (!user) throw new UnauthorizedException({ error: "invalid_credentials" });

    const ok = await this.credentials.verify(email, password);
    if (!ok) throw new UnauthorizedException({ error: "invalid_credentials" });

    return {
      userId: user.id,
      displayName: user.displayName,
      departmentId: user.departmentId ?? null,
    };
  }
}
