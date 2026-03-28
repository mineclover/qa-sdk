import { describe, it, expect, vi } from "vitest";
import { withQueryTracing } from "./drizzle-instrument.js";

describe("withQueryTracing", () => {
  it("select 호출을 가로채서 쿼리 빌더를 반환한다", () => {
    const mockBuilder = {
      from: vi.fn().mockReturnThis(),
      then: vi.fn((resolve) => resolve([{ id: 1 }])),
    };
    const mockDb = {
      select: vi.fn(() => mockBuilder),
    };

    const instrumented = withQueryTracing(mockDb);
    const result = instrumented.select();

    expect(mockDb.select).toHaveBeenCalled();
    // 빌더가 Proxy로 감싸져서 반환됨
    expect(result).toBeDefined();
  });

  it("쿼리 메서드가 아닌 프로퍼티는 원본을 그대로 반환한다", () => {
    const mockDb = {
      schema: { tables: {} },
      select: vi.fn(),
    };

    const instrumented = withQueryTracing(mockDb);
    expect(instrumented.schema).toBe(mockDb.schema);
  });

  it("then() 실행 시 결과를 정상적으로 전달한다", async () => {
    const expectedRows = [{ id: 1, name: "test" }];
    const mockBuilder = {
      from: vi.fn().mockReturnThis(),
      then: vi.fn((resolve) => resolve(expectedRows)),
    };
    const mockDb = {
      select: vi.fn(() => mockBuilder),
    };

    const instrumented = withQueryTracing(mockDb);
    const builder = instrumented.select();

    // then()이 감싸져도 결과는 동일해야 함
    const result = await new Promise((resolve) => {
      builder.then(resolve);
    });

    expect(result).toEqual(expectedRows);
  });

  it("then()에서 에러가 발생하면 rejection을 전파한다", async () => {
    const mockError = new Error("connection lost");
    const mockBuilder = {
      then: vi.fn((_resolve, reject) => reject(mockError)),
    };
    const mockDb = {
      select: vi.fn(() => mockBuilder),
    };

    const instrumented = withQueryTracing(mockDb);
    const builder = instrumented.select();

    await expect(
      new Promise((resolve, reject) => {
        builder.then(resolve, reject);
      }),
    ).rejects.toThrow("connection lost");
  });
});
