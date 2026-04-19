// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import { describe, expect, it, vi } from "vitest";
import {
  buildMotionPreviewUrl,
  launchMotionPreview,
  resolveMotionPreviewOrigin,
} from "./motion-preview-orchestration.js";

describe("motion preview orchestration", () => {
  it("builds preview URLs with optional workspace query state", () => {
    expect(buildMotionPreviewUrl("http://localhost:4179", "demo/workspace 1"))
      .toBe("http://localhost:4179/?workspace=demo%2Fworkspace+1");
    expect(buildMotionPreviewUrl("http://localhost:4179")).toBe("http://localhost:4179/");
  });

  it("reuses already-running workspace service and preview app", async () => {
    const runCommand = vi.fn();
    const startDetached = vi.fn();
    const openUrl = vi.fn(async () => {});
    const waitForUrl = vi.fn(async () => true);

    const result = await launchMotionPreview({
      previewOrigin: "http://localhost:4179",
      workspaceBaseUrl: "http://localhost:3710",
      workspaceId: "demo/reuse",
    }, {
      repoRoot: "/repo",
      runCommand,
      startDetached,
      openUrl,
      waitForUrl,
    });

    expect(runCommand).not.toHaveBeenCalled();
    expect(startDetached).not.toHaveBeenCalled();
    expect(openUrl).toHaveBeenCalledWith("http://localhost:4179/?workspace=demo%2Freuse");
    expect(result).toMatchObject({
      url: "http://localhost:4179/?workspace=demo%2Freuse",
      reusedWorkspaceService: true,
      reusedPreviewServer: true,
    });
  });

  it("builds and starts the service plus preview app when missing", async () => {
    const runCommand = vi.fn(async () => {});
    const startDetached = vi.fn(async () => {});
    const openUrl = vi.fn(async () => {});
    let workspaceChecks = 0;
    let previewChecks = 0;
    const waitForUrl = vi.fn(async (url: string) => {
      if (url === "http://localhost:3810/health") {
        workspaceChecks += 1;
        return workspaceChecks > 1;
      }
      if (url === "http://localhost:4279") {
        previewChecks += 1;
        return previewChecks > 1;
      }
      return false;
    });

    const result = await launchMotionPreview({
      previewOrigin: "http://localhost:4279",
      workspaceBaseUrl: "http://localhost:3810",
      workspaceId: "demo/bootstrap",
    }, {
      repoRoot: "/repo",
      runCommand,
      startDetached,
      openUrl,
      waitForUrl,
    });

    expect(runCommand).toHaveBeenNthCalledWith(
      1,
      "pnpm",
      ["--filter", "@qa-sdk/motion-workspace-service", "build"],
      { cwd: "/repo" },
    );
    expect(runCommand).toHaveBeenNthCalledWith(
      2,
      "pnpm",
      ["--filter", "@qa-sdk/motion-content-editor-demo", "build"],
      { cwd: "/repo" },
    );
    expect(startDetached).toHaveBeenNthCalledWith(
      1,
      "pnpm",
      ["--filter", "@qa-sdk/motion-workspace-service", "start"],
      expect.objectContaining({
        cwd: "/repo",
        env: expect.objectContaining({
          PORT: "3810",
        }),
      }),
    );
    expect(startDetached).toHaveBeenNthCalledWith(
      2,
      "pnpm",
      [
        "--filter",
        "@qa-sdk/motion-content-editor-demo",
        "preview",
        "--",
        "--host",
        "localhost",
        "--port",
        "4279",
        "--strictPort",
      ],
      expect.objectContaining({
        cwd: "/repo",
        env: expect.objectContaining({
          MOTION_WORKSPACE_SERVICE_ORIGIN: "http://localhost:3810",
        }),
      }),
    );
    expect(openUrl).toHaveBeenCalledWith("http://localhost:4279/?workspace=demo%2Fbootstrap");
    expect(result).toMatchObject({
      url: "http://localhost:4279/?workspace=demo%2Fbootstrap",
      reusedWorkspaceService: false,
      reusedPreviewServer: false,
    });
  });

  it("normalizes preview origin from explicit input", () => {
    expect(resolveMotionPreviewOrigin("http://localhost:4179/")).toBe("http://localhost:4179");
  });
});
