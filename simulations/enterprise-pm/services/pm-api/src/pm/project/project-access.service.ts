// @def.boundary sim-pm-api
// @def.doc authorization-ontology-resource-lifecycle

import { randomBytes } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import type { AccessChecker, AccessResult, ApiCall } from "permission-engine";
import { PROJECT_ACCESS_CHECKER } from "../../auth-deps/access-checker.module.js";
import type { CurrentUserContext } from "../../auth-deps/current-user.decorator.js";

export type ProjectApiId =
  | "project.create"
  | "project.read"
  | "project.update"
  | "project.delete";

export interface ProjectCheckInput {
  apiId: ProjectApiId;
  user: CurrentUserContext;
  /** 리소스 id. null 이면 create 경로 — Pass 1 만 실행. */
  targetId: string | null;
  /** 리소스 owner id. null 이면 Pass 2 스킵 (transaction kind 로 결정). */
  resourceOwnerId?: string | null;
  departmentId: string | null;
}

/**
 * ProjectCheckResult — AccessChecker 의 AccessResult 를 controller 응답 스키마에 맞춰 가공.
 *
 * Plan 11b-1 응답 규약: `rootSpanId` (= executionSpanId), `denyReason`, `allow`.
 * 시나리오 runner / Plan 12c 의 audit 조회는 본 rootSpanId 로 trace tree 를 추적.
 */
export interface ProjectCheckResult {
  allow: boolean;
  rootSpanId: string;
  denyReason?: string;
}

const PROJECT_API_COORDS: Record<ProjectApiId, number[]> = {
  "project.create": [0],
  "project.read": [1],
  "project.update": [2],
  "project.delete": [3],
};

function newSpanId(): string {
  return randomBytes(8).toString("hex");
}

function newTraceId(): string {
  return randomBytes(16).toString("hex");
}

@Injectable()
export class ProjectAccessService {
  constructor(
    @Inject(PROJECT_ACCESS_CHECKER) private readonly checker: AccessChecker,
  ) {}

  async check(input: ProjectCheckInput): Promise<ProjectCheckResult> {
    const hasResource =
      input.targetId !== null &&
      input.resourceOwnerId !== null &&
      input.resourceOwnerId !== undefined;

    const call: ApiCall = hasResource
      ? {
          kind: "resource",
          apiId: input.apiId,
          coords: PROJECT_API_COORDS[input.apiId],
          targetId: input.targetId!,
          resource: {
            id: input.targetId!,
            ownerId: input.resourceOwnerId!,
          },
        }
      : {
          kind: "transaction",
          apiId: input.apiId,
          coords: PROJECT_API_COORDS[input.apiId],
          targetId: input.targetId ?? input.apiId,
        };

    const result: AccessResult = await this.checker.check(
      {
        userId: input.user.userId,
        bitmap: {
          prefix: "sim.bitmap",
          v: input.user.bitmapVersion,
          mask: input.user.bitmapMask,
          issuedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 3600_000).toISOString(),
          issuer: "sim-pm-api",
          signature: "", // verify 는 caller 가 이미 수행 (gateway)
        },
        parentSpanId: null,
        traceId: newTraceId(),
        newSpanId,
      },
      call,
    );

    return {
      allow: result.allowed,
      rootSpanId: result.executionSpanId,
      denyReason: result.denyReason,
    };
  }
}
