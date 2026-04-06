import { describe, it, expect } from "vitest";
import { generateHelp } from "../src/help.js";
import type { CliCommandNode } from "../src/types.js";

describe("generateHelp", () => {
  const tree: CliCommandNode[] = [
    { segment: "deploy", description: "서비스 배포", handler: async () => {} },
    {
      segment: "config",
      description: "설정 관리",
      children: [
        { segment: "show", description: "현재 설정", handler: async () => {} },
        { segment: "use", description: "프로필 전환", handler: async () => {} },
      ],
    },
    {
      segment: "review",
      usage: "infra review request [file] --reviewer <name>",
      continuation: [
        "[--decision-id <id>]",
        "[--title <text> --rationale <text>]",
      ],
      handler: async () => {},
    },
  ];

  it("전체 help 생성", () => {
    const help = generateHelp("infra", tree);
    expect(help).toContain("infra");
    expect(help).toContain("deploy");
    expect(help).toContain("config");
  });

  it("노드 help 생성", () => {
    const help = generateHelp("infra", tree, tree[1]);
    expect(help).toContain("config");
    expect(help).toContain("show");
    expect(help).toContain("use");
  });

  it("usage continuation을 함께 렌더링한다", () => {
    const help = generateHelp("infra", tree);
    expect(help).toContain("infra review request [file] --reviewer <name>");
    expect(help).toContain("[--decision-id <id>]");
    expect(help).toContain("[--title <text> --rationale <text>]");
  });
});
