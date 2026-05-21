import { describe, it, expect } from "vitest";
import { fetchGitLog } from "./git-log-api";

describe("fetchGitLog", () => {
  it("repo 안 파일은 commit 목록 반환", () => {
    const log = fetchGitLog({ cwd: process.cwd(), file: "package.json", limit: 5 });
    expect(Array.isArray(log)).toBe(true);
    if (log.length > 0) {
      expect(log[0]).toHaveProperty("sha");
      expect(log[0]).toHaveProperty("subject");
    }
  });

  it("존재하지 않는 파일 → 빈 배열", () => {
    const log = fetchGitLog({ cwd: process.cwd(), file: "nonexistent-file-xyz.txt", limit: 5 });
    expect(log).toEqual([]);
  });
});
