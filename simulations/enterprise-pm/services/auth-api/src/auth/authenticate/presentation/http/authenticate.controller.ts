// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

import { Body, Controller, Inject, Post, UseFilters } from "@nestjs/common";
import { z } from "zod";
import { DomainExceptionFilter } from "@qa-sdk/sim-domain-slice-kit";
import { AuthenticateUseCase } from "../../application/use-cases/authenticate.use-case.js";
import type { AuthenticatedSession } from "../../domain/index.js";

const authSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/**
 * POST /auth/authenticate
 *
 * 라우트 (legacy 보존):
 *   email + password → AuthenticatedSession (userId, roleIds, roleAssignments)
 *
 * 도메인 예외 매핑:
 *   InvalidCredentialsException (UnauthorizedError) → 401
 *   InvalidAuthenticateInputException (ValidationError) → 400
 */
@Controller("auth")
@UseFilters(DomainExceptionFilter)
export class AuthenticateController {
  constructor(@Inject(AuthenticateUseCase) private readonly useCase: AuthenticateUseCase) {}

  @Post("authenticate")
  async authenticate(@Body() body: unknown): Promise<AuthenticatedSession> {
    const parsed = authSchema.parse(body);
    return this.useCase.authenticate(parsed);
  }
}
