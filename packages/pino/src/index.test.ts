import { afterEach, describe, expect, it, vi } from "vitest";
import pino, { type Destination, type Logger } from "./index.js";

function createDestination(): { destination: Destination; writes: string[] } {
  const writes: string[] = [];
  return {
    destination: {
      write(message: string) {
        writes.push(message);
      },
    },
    writes,
  };
}

function parseLine(line: string): Record<string, unknown> {
  return JSON.parse(line) as Record<string, unknown>;
}

describe("pino", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("기본 레벨 필터링 — info에서 debug 숨김", () => {
    const { destination, writes } = createDestination();
    const logger = pino({ level: "info" }, destination);

    logger.debug("hidden");
    expect(writes).toHaveLength(0);

    logger.info("visible");
    expect(writes).toHaveLength(1);
    expect(parseLine(writes[0])).toMatchObject({
      level: 30,
      msg: "visible",
    });
  });

  it("구조화 JSON 출력 — level(숫자), time, msg 필드", () => {
    const now = 1_710_000_000_000;
    vi.spyOn(Date, "now").mockReturnValue(now);

    const { destination, writes } = createDestination();
    const logger = pino({ level: "info" }, destination);

    logger.info("structured log");

    expect(writes).toHaveLength(1);
    expect(writes[0].endsWith("\n")).toBe(true);
    expect(parseLine(writes[0])).toMatchObject({
      level: 30,
      time: now,
      msg: "structured log",
    });
  });

  it("child logger — 부모 바인딩 상속 + 추가 바인딩 병합", () => {
    const { destination, writes } = createDestination();
    const logger = pino({ base: { service: "registry-server" }, level: "info" }, destination);

    logger.child({ requestId: "req-123" }).info({ route: "/health" }, "handled");

    expect(writes).toHaveLength(1);
    expect(parseLine(writes[0])).toMatchObject({
      service: "registry-server",
      requestId: "req-123",
      route: "/health",
      level: 30,
      msg: "handled",
    });
  });

  it("에러 직렬화 — type, message, stack 포함", () => {
    const { destination, writes } = createDestination();
    const logger = pino({ level: "error" }, destination);
    const error = new TypeError("boom");

    logger.error(error, "request failed");

    expect(writes).toHaveLength(1);
    const parsed = parseLine(writes[0]);
    expect(parsed).toMatchObject({
      level: 50,
      msg: "request failed",
    });
    expect(parsed.err).toEqual(
      expect.objectContaining({
        type: "TypeError",
        message: "boom",
        stack: expect.stringContaining("TypeError: boom"),
      }),
    );
  });

  it("silent 레벨 — 아무것도 출력 안 함", () => {
    const { destination, writes } = createDestination();
    const logger = pino({ level: "silent" }, destination);

    logger.info("ignored");
    logger.error(new Error("ignored too"));
    logger.fatal("ignored as well");

    expect(writes).toHaveLength(0);
  });

  it("isLevelEnabled — 현재 레벨 기준 판단", () => {
    const { destination } = createDestination();
    const logger = pino({ level: "warn" }, destination);

    expect(logger.isLevelEnabled("trace")).toBe(false);
    expect(logger.isLevelEnabled("debug")).toBe(false);
    expect(logger.isLevelEnabled("info")).toBe(false);
    expect(logger.isLevelEnabled("warn")).toBe(true);
    expect(logger.isLevelEnabled("error")).toBe(true);
    expect(logger.isLevelEnabled("fatal")).toBe(true);
  });

  it("printf-style 인터폴레이션 — %s, %d, %j", () => {
    const { destination, writes } = createDestination();
    const logger = pino({ level: "info" }, destination);

    logger.info("user %s logged in %d times, data: %j", "alice", 3, { role: "admin" });

    expect(writes).toHaveLength(1);
    expect(parseLine(writes[0]).msg).toBe(
      'user alice logged in 3 times, data: {"role":"admin"}',
    );
  });

  it("mixin — 매 호출 시 동적 필드 추가", () => {
    let counter = 0;
    const { destination, writes } = createDestination();
    const logger = pino({
      level: "info",
      mixin: () => ({ seq: ++counter }),
    }, destination);

    logger.info("first");
    logger.info("second");

    expect(parseLine(writes[0]).seq).toBe(1);
    expect(parseLine(writes[1]).seq).toBe(2);
  });

  it("커스텀 serializers — 특정 키 값 변환", () => {
    const { destination, writes } = createDestination();
    const logger = pino({
      level: "info",
      serializers: {
        user: (u: unknown) => ({ id: (u as { id: string }).id }),
      },
    }, destination);

    logger.info({ user: { id: "u1", secret: "pw123" } }, "login");

    const parsed = parseLine(writes[0]);
    expect(parsed.user).toEqual({ id: "u1" });
    expect((parsed.user as Record<string, unknown>).secret).toBeUndefined();
  });

  it("level formatter — 레벨 출력 형식 커스터마이징", () => {
    const { destination, writes } = createDestination();
    const logger = pino({
      level: "info",
      formatters: {
        level: (label, _num) => ({ level: label }),
      },
    }, destination);

    logger.info("formatted");

    expect(parseLine(writes[0]).level).toBe("info");
  });

  it("timestamp: false — 시간 필드 생략", () => {
    const { destination, writes } = createDestination();
    const logger = pino({ level: "info", timestamp: false }, destination);

    logger.info("no time");

    const parsed = parseLine(writes[0]);
    expect(parsed.time).toBeUndefined();
    expect(parsed.msg).toBe("no time");
  });

  it("Error.cause 직렬화 — 중첩 에러 체인", () => {
    const { destination, writes } = createDestination();
    const logger = pino({ level: "error" }, destination);

    const root = new Error("root cause");
    const wrapped = new Error("wrapper", { cause: root });

    logger.error(wrapped, "chained");

    const parsed = parseLine(writes[0]);
    const err = parsed.err as Record<string, unknown>;
    expect(err.message).toBe("wrapper");
    expect(err.cause).toEqual(
      expect.objectContaining({ type: "Error", message: "root cause" }),
    );
  });

  it("silent 메서드 — 명시적 noop", () => {
    const { destination, writes } = createDestination();
    const logger = pino({ level: "trace" }, destination);

    logger.silent("never printed");

    expect(writes).toHaveLength(0);
  });

  it("levels 정적 프로퍼티 — 레벨 이름↔숫자 매핑", () => {
    expect(pino.levels.values.info).toBe(30);
    expect(pino.levels.values.error).toBe(50);
    expect(pino.levels.labels[30]).toBe("info");
    expect(pino.levels.labels[50]).toBe("error");
  });
});
