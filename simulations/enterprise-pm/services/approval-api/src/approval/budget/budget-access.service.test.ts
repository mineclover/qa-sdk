import { Test } from "@nestjs/testing";
import { describe, expect, it } from "vitest";
import type { AccessChecker, AccessResult } from "permission-engine";
import { BudgetAccessService } from "./budget-access.service.js";
import { APPROVAL_ACCESS_CHECKER } from "../../auth-deps/access-checker.module.js";

function fakeChecker(result: AccessResult): AccessChecker {
  return { check: async () => result } as unknown as AccessChecker;
}

describe("BudgetAccessService", () => {
  const user = {
    userId: "alice",
    bitmapMask: new Uint8Array([0xff, 0xff]),
    bitmapVersion: "uv1",
  };

  async function svcWith(result: AccessResult) {
    const moduleRef = await Test.createTestingModule({
      providers: [
        BudgetAccessService,
        { provide: APPROVAL_ACCESS_CHECKER, useValue: fakeChecker(result) },
      ],
    }).compile();
    return moduleRef.get(BudgetAccessService);
  }

  it("same dept → allow + rootSpanId", async () => {
    const svc = await svcWith({ allowed: true, executionSpanId: "root-allow" });
    const res = await svc.check({
      apiId: "budget.approve",
      user,
      requestId: "r-1",
      projectDepartmentId: "dept-eng",
      approverDepartmentId: "dept-eng",
      resourceOwnerId: "alice",
    });
    expect(res.allow).toBe(true);
    expect(res.rootSpanId).toBe("root-allow");
  });

  it("cross dept → deny + denyReason", async () => {
    const svc = await svcWith({
      allowed: false,
      denyReason: "cross_department_requires_approver_role",
      executionSpanId: "root-deny",
    });
    const res = await svc.check({
      apiId: "budget.approve",
      user,
      requestId: "r-1",
      projectDepartmentId: "dept-eng",
      approverDepartmentId: "dept-marketing",
      resourceOwnerId: "alice",
    });
    expect(res.allow).toBe(false);
    expect(res.denyReason).toBe("cross_department_requires_approver_role");
    expect(res.rootSpanId).toBe("root-deny");
  });

  it("requestId=null → transaction kind 로 호출", async () => {
    const svc = await svcWith({ allowed: true, executionSpanId: "root-tx" });
    const res = await svc.check({
      apiId: "budget.create",
      user,
      requestId: null,
      projectDepartmentId: "dept-eng",
    });
    expect(res.allow).toBe(true);
  });
});
