// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

import { describe, expect, it } from "vitest";
import { ExpenseEntity } from "./expense.entity.js";
import {
  ExpenseStatusConflictException,
  InvalidExpenseAmountException,
  InvalidExpenseIdException,
} from "./expense.exceptions.js";

const baseInput = {
  id: "exp_001",
  requesterId: "user_001",
  amount: 10_000,
  category: "travel",
  description: "Taxi",
  now: new Date("2026-01-01T00:00:00.000Z"),
};

describe("ExpenseEntity", () => {
  it("create() draft 로 시작 + amount 보존", () => {
    const e = ExpenseEntity.create(baseInput);
    expect(e.status).toBe("draft");
  });

  it("빈 id → InvalidExpenseIdException", () => {
    expect(() => ExpenseEntity.create({ ...baseInput, id: "  " })).toThrow(InvalidExpenseIdException);
  });

  it("음수 amount → InvalidExpenseAmountException", () => {
    expect(() => ExpenseEntity.create({ ...baseInput, amount: -1 })).toThrow(
      InvalidExpenseAmountException,
    );
  });

  it("changeStatus draft → submitted", () => {
    const e = ExpenseEntity.create(baseInput).changeStatus("submitted");
    expect(e.status).toBe("submitted");
  });

  it("approved 에서 다른 status 로 변경 시 ExpenseStatusConflictException", () => {
    const approved = ExpenseEntity.rehydrate({
      ...baseInput,
      status: "approved",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(() => approved.changeStatus("submitted")).toThrow(ExpenseStatusConflictException);
  });

  it("snapshot 라운드트립", () => {
    const e = ExpenseEntity.create(baseInput).changeStatus("submitted");
    expect(ExpenseEntity.rehydrate(e.toSnapshot()).toSnapshot()).toEqual(e.toSnapshot());
  });

  it("예외 name 매핑", () => {
    expect(new InvalidExpenseIdException().name).toBe("ValidationError");
    expect(new InvalidExpenseAmountException(-1).name).toBe("ValidationError");
    expect(new ExpenseStatusConflictException("approved", "submitted").name).toBe("ConflictError");
  });
});
