// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import { describe, it, expect } from "vitest";
import { parseTestsDeclaration } from "./test.js";

describe("parseTestsDeclaration", () => {
  it("frontmatter tests 배열 파싱", () => {
    const raw = [
      { kind: "unit", intent: "입력 검증", module: "@qa-sdk/auth/process-auth" },
      { kind: "auth-flow", intent: "관리자 권한", scope: "pair", participants: ["gateway"] },
    ];
    const result = parseTestsDeclaration(raw, "def:42");
    expect(result).toHaveLength(2);
    expect(result[0].aCoord).toBe("def:42/unit");
    expect(result[0].kind).toBe("unit");
    expect(result[1].scope).toBe("pair");
    expect(result[1].participants).toEqual(["gateway"]);
  });

  it("kind 없는 항목은 skip", () => {
    const raw = [{ intent: "의도만 있음" }];
    const result = parseTestsDeclaration(raw, "def:42");
    expect(result).toHaveLength(0);
  });
});
