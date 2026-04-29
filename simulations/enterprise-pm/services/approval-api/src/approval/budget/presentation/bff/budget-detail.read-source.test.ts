// @def.boundary sim-approval-api
// @def.doc 04-scaling-infra

import { describe, it, expect, beforeAll } from "vitest";
import { Test } from "@nestjs/testing";
import {
  READ_DATA_SOURCE,
  WRITE_DATA_SOURCE,
  APPROVAL_DB_INSTANCE,
  type ApprovalDbInstanceHandle,
} from "../../../approval-db.module.js";

describe("BFF read-source binding (spec 04 §4.3)", () => {
  beforeAll(() => {
    process.env.SIM_SERVICE_VERSION = "v3";
  });

  it("READ_DATA_SOURCE / WRITE_DATA_SOURCE 토큰이 모듈에서 export 된다", () => {
    expect(typeof READ_DATA_SOURCE).toBe("symbol");
    expect(typeof WRITE_DATA_SOURCE).toBe("symbol");
    expect(READ_DATA_SOURCE).not.toBe(WRITE_DATA_SOURCE);
  });

  it("두 토큰이 ApprovalDbInstanceHandle의 db/readDb로 분기된다 (DI factory)", async () => {
    const writeDb = { __id: "write-db" };
    const readDb = { __id: "read-db" };
    const handle: ApprovalDbInstanceHandle = {
      dialect: "pg",
      db: writeDb as never,
      readDb: readDb as never,
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        { provide: APPROVAL_DB_INSTANCE, useValue: handle },
        {
          provide: WRITE_DATA_SOURCE,
          useFactory: (h: ApprovalDbInstanceHandle) => h.db,
          inject: [APPROVAL_DB_INSTANCE],
        },
        {
          provide: READ_DATA_SOURCE,
          useFactory: (h: ApprovalDbInstanceHandle) => h.readDb ?? h.db,
          inject: [APPROVAL_DB_INSTANCE],
        },
      ],
    }).compile();
    expect(moduleRef.get(WRITE_DATA_SOURCE)).toBe(writeDb);
    expect(moduleRef.get(READ_DATA_SOURCE)).toBe(readDb);
  });

  it("readDb 미설정 시 READ_DATA_SOURCE는 write로 fallback (단일 컨테이너 dev)", async () => {
    const writeDb = { __id: "write-db" };
    const handle: ApprovalDbInstanceHandle = {
      dialect: "sqlite",
      db: writeDb as never,
      // readDb 의도적으로 미정의
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        { provide: APPROVAL_DB_INSTANCE, useValue: handle },
        {
          provide: READ_DATA_SOURCE,
          useFactory: (h: ApprovalDbInstanceHandle) => h.readDb ?? h.db,
          inject: [APPROVAL_DB_INSTANCE],
        },
      ],
    }).compile();
    expect(moduleRef.get(READ_DATA_SOURCE)).toBe(writeDb);
  });
});
