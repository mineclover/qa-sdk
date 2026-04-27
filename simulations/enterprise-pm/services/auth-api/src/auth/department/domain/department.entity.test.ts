// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

import { describe, expect, it } from "vitest";
import { DepartmentEntity } from "./department.entity.js";
import {
  InvalidDepartmentInputException,
  DepartmentNotFoundException,
  DepartmentCycleException,
} from "./department.exceptions.js";

describe("DepartmentEntity", () => {
  const baseInput = {
    id: "dept_1",
    name: "Engineering",
    now: new Date("2026-01-01T00:00:00.000Z"),
  };

  it("create() 정상", () => {
    const d = DepartmentEntity.create(baseInput);
    expect(d.id).toBe("dept_1");
    expect(d.toSnapshot().name).toBe("Engineering");
    expect(d.toSnapshot().parentId).toBeNull();
  });

  it("create() 빈 id 거부", () => {
    expect(() => DepartmentEntity.create({ ...baseInput, id: "  " })).toThrow(InvalidDepartmentInputException);
  });

  it("create() 빈 name 거부", () => {
    expect(() => DepartmentEntity.create({ ...baseInput, name: "" })).toThrow(InvalidDepartmentInputException);
  });

  it("updateProfile() 새 인스턴스 반환", () => {
    const d = DepartmentEntity.create(baseInput);
    const updated = d.updateProfile({ name: "Eng-2" });
    expect(updated).not.toBe(d);
    expect(updated.toSnapshot().name).toBe("Eng-2");
    expect(d.toSnapshot().name).toBe("Engineering");
  });

  it("updateProfile() 빈 name 거부", () => {
    const d = DepartmentEntity.create(baseInput);
    expect(() => d.updateProfile({ name: " " })).toThrow(InvalidDepartmentInputException);
  });

  it("toSnapshot/rehydrate 라운드트립", () => {
    const d = DepartmentEntity.create({ ...baseInput, parentId: "dept_root", managerId: "mgr_1" });
    const re = DepartmentEntity.rehydrate(d.toSnapshot());
    expect(re.toSnapshot()).toEqual(d.toSnapshot());
  });

  it("InvalidDepartmentInputException name='ValidationError'", () => {
    expect(new InvalidDepartmentInputException("x").name).toBe("ValidationError");
  });

  it("DepartmentNotFoundException name='NotFoundError'", () => {
    expect(new DepartmentNotFoundException("x").name).toBe("NotFoundError");
  });

  it("DepartmentCycleException name='ConflictError'", () => {
    expect(new DepartmentCycleException("a", "b").name).toBe("ConflictError");
  });
});
