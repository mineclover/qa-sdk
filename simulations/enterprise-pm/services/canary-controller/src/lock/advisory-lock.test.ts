// @def.boundary sim-canary-controller
// @def.doc canary-controller-config
// spec 01 §6 — 두 service 인스턴스가 같은 PG에 동시 접속 시 한쪽만 tryAcquire 성공.

import { describe, it, expect } from "vitest";
import { AdvisoryLockService } from "./advisory-lock.service.js";

describe("AdvisoryLockService (spec 01 §6)", () => {
  const PG = process.env.SIM_DB_WRITE_URL;
  const itPg = PG ? it : it.skip;

  itPg(
    "only one instance acquires; release lets the other succeed",
    async () => {
      const a = new AdvisoryLockService({
        pgUrl: PG!,
        lockKey: "sim-canary-controller-test",
      });
      const b = new AdvisoryLockService({
        pgUrl: PG!,
        lockKey: "sim-canary-controller-test",
      });
      await a.onModuleInit();
      await b.onModuleInit();
      try {
        const ok = await a.tryAcquire();
        expect(ok).toBe(true);
        // 두 번째 인스턴스 — 잠긴 동안 false
        expect(await b.tryAcquire()).toBe(false);
        await a.release();
        // release 이후에는 b가 획득 가능
        expect(await b.tryAcquire()).toBe(true);
        await b.release();
      } finally {
        await a.onModuleDestroy();
        await b.onModuleDestroy();
      }
    },
    30_000,
  );
});
