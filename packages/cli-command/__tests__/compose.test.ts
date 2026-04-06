import { describe, expect, it } from "vitest";
import { descriptorsToTree } from "../src/compose.js";
import type { CommandDescriptor } from "../src/types.js";

describe("descriptorsToTree", () => {
  it("flat and nested descriptors를 tree로 변환한다", () => {
    const descriptors: CommandDescriptor[] = [
      {
        id: "service.list",
        path: ["list"],
        usage: "qa-sdk service list",
        handlerKey: "service.list",
      },
      {
        id: "service.app.list",
        path: ["app", "list"],
        usage: "qa-sdk service app list",
        handlerKey: "service.app.list",
      },
      {
        id: "service.app.show",
        path: ["app", "show"],
        usage: "qa-sdk service app show <id>",
        handlerKey: "service.app.show",
      },
    ];

    const tree = descriptorsToTree(descriptors);
    expect(tree).toEqual([
      {
        segment: "list",
        usage: "qa-sdk service list",
        handlerKey: "service.list",
      },
      {
        segment: "app",
        children: [
          {
            segment: "list",
            usage: "qa-sdk service app list",
            handlerKey: "service.app.list",
          },
          {
            segment: "show",
            usage: "qa-sdk service app show <id>",
            handlerKey: "service.app.show",
          },
        ],
      },
    ]);
  });

  it("same path leaf에 metadata를 병합한다", () => {
    const descriptors: CommandDescriptor[] = [
      {
        id: "review.request",
        path: ["request"],
        usage: "qa-sdk review request",
      },
      {
        id: "review.request.help",
        path: ["request"],
        continuation: ["[--title <text>]"],
        handlerKey: "review.request",
      },
    ];

    const tree = descriptorsToTree(descriptors);
    expect(tree).toEqual([
      {
        segment: "request",
        usage: "qa-sdk review request",
        continuation: ["[--title <text>]"],
        handlerKey: "review.request",
      },
    ]);
  });
});
