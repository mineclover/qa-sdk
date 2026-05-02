// @def.boundary sim-pm-api
// @def.doc domain-slice-architecture

import { describe, expect, it } from "vitest";
import { AssignmentEntity } from "./assignment.entity.js";
import {
  AssignmentCancelledException,
  InvalidAssignmentIdException,
} from "./assignment.exceptions.js";

describe("AssignmentEntity", () => {
  const baseInput = {
    id: "asg_001",
    projectId: "prj_001",
    managerId: "mgr_001",
    now: new Date("2026-01-01T00:00:00.000Z"),
  };

  it("create() 는 status='draft' 로 시작한다", () => {
    const e = AssignmentEntity.create(baseInput);
    expect(e.status).toBe("draft");
    expect(e.id).toBe("asg_001");
  });

  it("create() 는 빈 id 에 대해 InvalidAssignmentIdException 을 던진다", () => {
    expect(() => AssignmentEntity.create({ ...baseInput, id: "  " })).toThrow(
      InvalidAssignmentIdException,
    );
  });

  it("assign() 은 draft → assigned 상태 전이를 수행한다", () => {
    const e = AssignmentEntity.create(baseInput).assign(new Date("2026-01-02T00:00:00.000Z"));
    expect(e.status).toBe("assigned");
  });

  it("assign() 은 새 인스턴스를 반환한다 (불변)", () => {
    const draft = AssignmentEntity.create(baseInput);
    const assigned = draft.assign();
    expect(assigned).not.toBe(draft);
    expect(draft.status).toBe("draft");
    expect(assigned.status).toBe("assigned");
  });

  it("cancelled 상태에서 assign() 호출 시 AssignmentCancelledException 을 던진다", () => {
    const cancelled = AssignmentEntity.rehydrate({
      id: "asg_001",
      projectId: "prj_001",
      managerId: "mgr_001",
      status: "cancelled",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(() => cancelled.assign()).toThrow(AssignmentCancelledException);
  });

  it("toSnapshot() / rehydrate() 는 라운드트립을 보존한다", () => {
    const original = AssignmentEntity.create(baseInput).assign(
      new Date("2026-01-02T00:00:00.000Z"),
    );
    const snapshot = original.toSnapshot();
    const rehydrated = AssignmentEntity.rehydrate(snapshot);
    expect(rehydrated.toSnapshot()).toEqual(snapshot);
  });

  it("AssignmentCancelledException name 이 'ConflictError' 매핑된다", () => {
    const err = new AssignmentCancelledException();
    expect(err.name).toBe("ConflictError");
    expect(err.code).toBe("ASSIGNMENT_CANCELLED");
  });

  it("InvalidAssignmentIdException name 이 'ValidationError' 매핑된다", () => {
    const err = new InvalidAssignmentIdException();
    expect(err.name).toBe("ValidationError");
    expect(err.code).toBe("INVALID_ASSIGNMENT_ID");
  });
});
