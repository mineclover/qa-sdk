// @def.boundary permission-engine-spec
// @def.doc authorization-ontology-rls-enforcement

import "reflect-metadata";
import type { CallHandler, ExecutionContext, NestInterceptor } from "@nestjs/common";
import { Injectable, SetMetadata } from "@nestjs/common";
import { Observable, catchError, tap, throwError } from "rxjs";

import { predictRlsDecision, type RlsShadowQuery } from "./rls-shadow-evaluator.js";
import { getCurrentRlsContext } from "./rls-context-storage.js";

/**
 * Controller 메서드에 @RlsShadow({ resourceTable, operation, requiredBit, ... }) 부착.
 */
export const RLS_SHADOW_META = "qa:rls-shadow";
export const RlsShadow = (query: RlsShadowQuery) => SetMetadata(RLS_SHADOW_META, query);

export interface RlsShadowRecorder {
  record(input: {
    userId: string | null;
    tenantId: string | null;
    resourceTable: string;
    operation: "select" | "insert" | "update" | "delete";
    applicationDecision: "allow" | "deny";
    rlsPrediction: ReturnType<typeof predictRlsDecision>;
    requestId?: string | null;
  }): void;
}

@Injectable()
export class RlsShadowInterceptor implements NestInterceptor {
  constructor(
    private readonly recorder: RlsShadowRecorder,
    private readonly options: { enabled?: boolean } = { enabled: true },
  ) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (!this.options.enabled) return next.handle();
    const handler = ctx.getHandler();
    const meta = Reflect.getMetadata(RLS_SHADOW_META, handler) as RlsShadowQuery | undefined;
    if (!meta) return next.handle();

    const req = ctx.switchToHttp().getRequest<{ requestId?: string; id?: string }>();
    const requestId = req.requestId ?? req.id ?? null;
    const rlsCtx = getCurrentRlsContext();
    const prediction = predictRlsDecision(rlsCtx, meta);

    return next.handle().pipe(
      tap(() => {
        this.recorder.record({
          userId: rlsCtx.userId,
          tenantId: rlsCtx.tenantId,
          resourceTable: meta.resourceTable,
          operation: meta.operation,
          applicationDecision: "allow",
          rlsPrediction: prediction,
          requestId,
        });
      }),
      catchError((err) => {
        this.recorder.record({
          userId: rlsCtx.userId,
          tenantId: rlsCtx.tenantId,
          resourceTable: meta.resourceTable,
          operation: meta.operation,
          applicationDecision: "deny",
          rlsPrediction: prediction,
          requestId,
        });
        return throwError(() => err);
      }),
    );
  }
}
