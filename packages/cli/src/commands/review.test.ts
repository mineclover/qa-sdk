// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

// 테스트용 임시 DB 경로
const TMP_DIR = join(tmpdir(), `qa-review-test-${Date.now()}`);

// qa-dir mock — 테스트용 임시 디렉토리
vi.mock("../lib/qa-dir.js", () => ({
  getQaSdkDir: () => TMP_DIR,
}));

// DKG 브릿지 mock
vi.mock("../lib/review-feedback-dkg.js", () => ({
  bridgeFeedbackRequestToDkg: vi.fn(() => ({
    observationId: "obs-test-1",
    targetId: "target-1",
    decisionId: null,
    createdDecision: false,
  })),
}));

// 문서 해석 mock
vi.mock("../lib/review-feedback-docs.js", () => ({
  resolveRelatedDocsForFiles: vi.fn(async () => ({})),
}));

// execa mock — expandGlobs에서 사용
vi.mock("execa", () => ({
  execaSync: vi.fn((_cmd: string, args: string[]) => {
    // glob 패턴이면 mock 파일 목록 반환
    if (args.includes("--") && args.some(a => a.includes("*"))) {
      return { stdout: "src/a.ts\nsrc/b.ts" };
    }
    // git log --oneline -1 → 현재 커밋
    if (args.includes("log")) {
      return { stdout: "abc1234 test commit" };
    }
    // git rev-parse HEAD
    if (args.includes("rev-parse")) {
      return { stdout: "abc1234567890" };
    }
    return { stdout: "" };
  }),
}));

describe("review commands", () => {
  beforeEach(() => {
    mkdirSync(TMP_DIR, { recursive: true });
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    try { rmSync(TMP_DIR, { recursive: true, force: true }); } catch {}
  });

  describe("reviewStatus", () => {
    it("리뷰 기록 없으면 빈 결과 출력", async () => {
      const { reviewStatus } = await import("./review.js");
      reviewStatus([]);
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining("표시할 파일이 없습니다"));
    });
  });

  describe("reviewDashboard", () => {
    it("리뷰 기록 없으면 안내 메시지", async () => {
      const { reviewDashboard } = await import("./review.js");
      reviewDashboard([]);
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining("리뷰 기록이 없습니다"));
    });
  });

  describe("reviewLog", () => {
    it("파일 이력 없으면 안내 메시지", async () => {
      const { reviewLog } = await import("./review.js");
      reviewLog(["nonexistent-file.ts"]);
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining("리뷰 기록이 없습니다"));
    });
  });

  describe("reviewRequests", () => {
    it("요청 없으면 빈 결과", async () => {
      const { reviewRequests } = await import("./review.js");
      reviewRequests([]);
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining("피드백 요청이 없습니다"));
    });
  });

  describe("review CLI surface", () => {
    it("review request를 tree 기반으로 해석한다", async () => {
      const { resolveSubcommand } = await import("../index.js");
      expect(resolveSubcommand(["review", "request", "src/a.ts", "--reviewer", "bot", "--purpose", "check"])).toEqual({
        name: "review request",
        rest: ["src/a.ts", "--reviewer", "bot", "--purpose", "check"],
      });
    });
  });

  describe("reviewMark + reviewLog 연동", () => {
    it("mark 후 log에서 이력 조회 가능", async () => {
      const { reviewMark, reviewLog } = await import("./review.js");

      // 실제 존재하는 파일 사용
      reviewMark(["package.json", "--reviewer", "reviewer-1", "--model", "claude"]);
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining("리뷰 기록 완료"));
      vi.mocked(console.log).mockClear();

      reviewLog(["package.json"]);
      const output = vi.mocked(console.log).mock.calls.map(c => String(c[0])).join("\n");
      expect(output).toContain("reviewer-1");
      expect(output).toContain("claude");
    });
  });
});
