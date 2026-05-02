// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

import { describe, it, expect } from "vitest";
import { createLogger } from "./create-logger.js";

describe("createLogger", () => {
  it("기본: stdout 단일 스트림", () => {
    const logger = createLogger("test-service");
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.error).toBe("function");
  });

  it("destinations 옵션: multi-destination 구성", () => {
    const written: string[] = [];
    const mockStream = {
      write(chunk: string) { written.push(chunk); },
    };

    const logger = createLogger("test-service", {
      destinations: [{ stream: mockStream, level: "info" }],
    });

    // info 레벨 로그 → mockStream에도 전달 (동기 write)
    logger.info({ test: true }, "멀티스트림 테스트");

    expect(written.length).toBeGreaterThanOrEqual(1);
    const parsed = JSON.parse(written[0]) as Record<string, unknown>;
    expect(parsed.msg).toBe("멀티스트림 테스트");
    expect(parsed.name).toBe("test-service");
    expect(parsed.test).toBe(true);
  });

  it("destinations level 필터: warn 이상만 전달", () => {
    const written: string[] = [];
    const mockStream = {
      write(chunk: string) { written.push(chunk); },
    };

    const logger = createLogger("test-service", {
      destinations: [{ stream: mockStream, level: "warn" }],
    });

    logger.info("info는 무시");
    logger.warn("warn은 전달");
    logger.error("error도 전달");

    // info는 필터링, warn/error만 전달
    expect(written.length).toBe(2);
    expect(JSON.parse(written[0]).level).toBe("warn");
    expect(JSON.parse(written[1]).level).toBe("error");
  });

  it("빈 destinations 배열이면 기본 동작", () => {
    const logger = createLogger("test-service", { destinations: [] });
    expect(logger).toBeDefined();
  });
});
