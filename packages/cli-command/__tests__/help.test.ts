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

  it("노드의 args와 options를 렌더링한다", () => {
    const node: CliCommandNode = {
      segment: "deploy",
      description: "서비스 배포",
      handler: async () => {},
      args: [
        { name: "file", required: true, description: "대상 파일" },
        { name: "env", description: "환경" },
      ],
      options: [
        { flag: "--verbose", short: "-v", type: "boolean", description: "상세 출력" },
        { flag: "--provider", type: "string", valueHint: "<name>", description: "클라우드 제공자" },
        { flag: "--format", type: "string", choices: ["json", "yaml"], default: "json", description: "출력 형식" },
      ],
    };

    const help = generateHelp("infra", tree, node);
    // args 섹션
    expect(help).toContain("인자:");
    expect(help).toContain("<file>");
    expect(help).toContain("(필수)");
    expect(help).toContain("<env>");
    // options 섹션
    expect(help).toContain("옵션:");
    expect(help).toContain("--verbose");
    expect(help).toContain("-v");
    expect(help).toContain("--provider");
    expect(help).toContain("<name>");
    expect(help).toContain("--format");
    expect(help).toContain("[json|yaml]");
    expect(help).toContain("(기본: json)");
  });

  it("usage continuation을 함께 렌더링한다", () => {
    const help = generateHelp("infra", tree);
    expect(help).toContain("infra review request [file] --reviewer <name>");
    expect(help).toContain("[--decision-id <id>]");
    expect(help).toContain("[--title <text> --rationale <text>]");
  });
});
