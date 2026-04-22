// @def.boundary sim-pm-api
// @def.doc authorization-ontology-bitmap-pipeline

import { createParamDecorator, type ExecutionContext } from "@nestjs/common";

export interface CurrentUserContext {
  userId: string;
  bitmapMask: Uint8Array;
  bitmapVersion: string;
}

/**
 * @CurrentUser() — 컨트롤러 파라미터로 gateway 주입 사용자 컨텍스트 소비.
 *
 * Guard 가 request.currentUser 를 세팅했다고 가정. 누락 시 undefined (guard 가 401 throw).
 */
export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): CurrentUserContext | undefined => {
    const req = ctx.switchToHttp().getRequest<{ currentUser?: CurrentUserContext }>();
    return req.currentUser;
  },
);
