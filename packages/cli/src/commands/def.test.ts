import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cliDef } from "./def.js";

describe("def commands", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function getOutput(): string {
    return vi.mocked(console.log).mock.calls.map(c => String(c[0])).join("\n");
  }

  describe("help", () => {
    it("서브커맨드 없으면 help 출력", async () => {
      await cliDef([]);
      expect(getOutput()).toContain("qa-sdk def");
    });

    it("help 서브커맨드 명시", async () => {
      await cliDef(["help"]);
      expect(getOutput()).toContain("qa-sdk def");
    });
  });

  describe("link-rules", () => {
    it("LinkType 규칙 출력", async () => {
      await cliDef(["link-rules"]);
      const output = getOutput();
      expect(output).toContain("contains");
      expect(output).toContain("depends_on");
    });
  });

  describe("sync", () => {
    it("docs → local DB 동기화", async () => {
      await cliDef(["sync"]);
      const output = getOutput();
      expect(output).toContain("동기화 완료");
      expect(output).toContain("DB:");
    });
  });

  describe("scan (= sync alias)", () => {
    it("scan은 sync와 동일하게 동작", async () => {
      await cliDef(["scan"]);
      const output = getOutput();
      expect(output).toContain("동기화 완료");
    });
  });

  describe("list (sync 후)", () => {
    it("sync 후 문서 목록 조회", async () => {
      // sync 먼저 실행
      await cliDef(["sync"]);
      vi.mocked(console.log).mockClear();

      await cliDef(["list"]);
      const output = getOutput();
      // 문서가 존재해야 함
      expect(output.length).toBeGreaterThan(0);
    });

    it("--scope 필터", async () => {
      await cliDef(["sync"]);
      vi.mocked(console.log).mockClear();

      await cliDef(["list", "--scope=system"]);
      // system scope 문서만 출력 (에러 없이 실행)
      // 출력이 없을 수도 있음 (해당 scope 없으면)
    });
  });

  describe("stats (sync 후)", () => {
    it("분포 통계 출력", async () => {
      await cliDef(["sync"]);
      vi.mocked(console.log).mockClear();

      await cliDef(["stats"]);
      const output = getOutput();
      // 통계 출력 포함
      expect(output.length).toBeGreaterThan(0);
    });
  });

  describe("scan-audit", () => {
    it("raw frontmatter 감사 실행", async () => {
      await cliDef(["scan-audit"]);
      const output = getOutput();
      // 감사 결과 출력
      expect(output.length).toBeGreaterThan(0);
    });
  });

  describe("state", () => {
    it("전체 머신 상태 분포 출력", async () => {
      await cliDef(["state"]);
      const output = getOutput();
      expect(output.length).toBeGreaterThan(0);
    });
  });

  describe("validate (sync 후)", () => {
    it("그래프 검증 실행", async () => {
      await cliDef(["sync"]);
      vi.mocked(console.log).mockClear();

      await cliDef(["validate"]);
      // 검증 완료 (에러 없이 실행)
    });
  });

  describe("에러 처리", () => {
    it("get: ID 없이 호출하면 무시", async () => {
      await cliDef(["sync"]);
      vi.mocked(console.log).mockClear();

      await cliDef(["get"]);
      // 에러 없이 종료 (ID 미제공 시 빈 결과)
    });

    it("get: address로 단건 조회 가능", async () => {
      await cliDef(["sync"]);
      vi.mocked(console.log).mockClear();

      await cliDef(["get", "--address=def_document:v2:342161"]);
      const output = getOutput();
      expect(output).toContain("definition-addressing");
      expect(output).toContain("def_document:v2:342161");
    });

    it("incoming/outgoing: address로 링크 조회 가능", async () => {
      await cliDef(["sync"]);
      vi.mocked(console.log).mockClear();

      await cliDef(["incoming", "--address=def_document:v2:342161"]);
      const incomingOutput = getOutput();
      expect(incomingOutput).toContain("incoming");
      expect(incomingOutput).toContain("definition-taxonomy");

      vi.mocked(console.log).mockClear();
      await cliDef(["outgoing", "--address=def_document:v2:342161"]);
      const outgoingOutput = getOutput();
      expect(outgoingOutput).toContain("outgoing");
      expect(outgoingOutput).toContain("definition-taxonomy");
      expect(outgoingOutput).toContain("definition-addressing-plan");
    });

    it("boundary/boundary-context: address로 조회 가능", async () => {
      await cliDef(["sync"]);
      vi.mocked(console.log).mockClear();

      await cliDef(["boundary", "--address=def_document:v2:342161"]);
      const boundaryOutput = getOutput();
      expect(boundaryOutput).toContain("바운더리");
      expect(boundaryOutput).toContain("Definition Addressing");

      vi.mocked(console.log).mockClear();
      await cliDef(["boundary-context", "--address=def_document:v2:342161"]);
      const contextOutput = getOutput();
      expect(contextOutput).toContain("바운더리 컨텍스트");
      expect(contextOutput).toContain("blast radius");
    });

    it("알 수 없는 서브커맨드면 help 출력", async () => {
      await cliDef(["nonexistent-command"]);
      const output = getOutput();
      expect(output).toContain("qa-sdk def");
    });
  });
});
