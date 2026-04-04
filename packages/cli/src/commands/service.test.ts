import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  serviceCleanupActivate,
  serviceCleanupDraft,
  serviceCleanupExecute,
  serviceCleanupPlan,
  serviceOwnershipTopology,
} from "./service.js";
import { USAGE, resolveSubcommand } from "../index.js";

describe("service cleanup CLI", () => {
  beforeEach(() => {
    vi.stubEnv("QA_REGISTRY_URL", "http://registry.test");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("cleanup-plan은 readiness와 후보를 출력한다", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      response({
        serviceId: "order-svc",
        manifestVersion: "1.0.0",
        ready: true,
        items: [
          {
            kind: "exposure",
            currentVersion: "exp-v1",
            candidateVersions: ["exp-v2"],
            suggestedVersion: "exp-v2",
            status: "replaceable",
          },
        ],
        warnings: [],
      }),
    );

    const output = await captureConsoleAsync(async () => {
      await serviceCleanupPlan(["order-svc"]);
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      "http://registry.test/resolve/services/order-svc/cleanup-plan",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(output.stdout).toContain("Cleanup Plan: order-svc (1.0.0)");
    expect(output.stdout).toContain("ready: yes");
    expect(output.stdout).toContain("exp-v2");
  });

  it("cleanup-execute는 plan → draft → activate 순으로 호출한다", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(response({
        serviceId: "order-svc",
        manifestVersion: "1.0.0",
        ready: true,
        items: [],
        warnings: [],
      }))
      .mockResolvedValueOnce(response({
        sourceManifestVersion: "1.0.0",
        manifestVersion: "1.0.1-cleanup",
        replacements: { exposureVersion: "exp-v2" },
      }))
      .mockResolvedValueOnce(response({
        previousActiveManifestVersion: "1.0.0",
        activatedManifestVersion: "1.0.1-cleanup",
        state: "active",
      }));

    await captureConsoleAsync(async () => {
      await serviceCleanupExecute(["order-svc", "--new-version", "1.0.1-cleanup"]);
    });

    expect(fetchSpy).toHaveBeenNthCalledWith(
      1,
      "http://registry.test/resolve/services/order-svc/cleanup-plan",
      expect.anything(),
    );
    expect(fetchSpy).toHaveBeenNthCalledWith(
      2,
      "http://registry.test/resolve/services/order-svc/cleanup-draft",
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetchSpy).toHaveBeenNthCalledWith(
      3,
      "http://registry.test/resolve/services/order-svc/cleanup-activate",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("ownership-topology는 alignment drift를 출력한다", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      response({
        serviceId: "order-svc",
        topology: {
          ownedPrefixes: ["tracking"],
          consumedPrefixes: ["service"],
        },
        ownershipComponent: {
          version: "own-v2",
          state: "published",
          ownedPrefixes: ["tracking", "endpoint"],
          consumedPrefixes: ["service", "permission"],
        },
        alignment: {
          status: "drifted",
          ownedPrefixes: {
            matching: ["tracking"],
            onlyInComponent: ["endpoint"],
            onlyInTopology: [],
          },
          consumedPrefixes: {
            matching: ["service"],
            onlyInComponent: ["permission"],
            onlyInTopology: [],
          },
          conflictingOwners: [],
          ownedPrefixConsumers: [],
          consumedPrefixOwners: [],
        },
      }),
    );

    const output = await captureConsoleAsync(async () => {
      await serviceOwnershipTopology(["order-svc", "--version", "own-v2"]);
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      "http://registry.test/api/services/order-svc/ownership/topology?version=own-v2",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(output.stdout).toContain("Ownership Topology: order-svc");
    expect(output.stdout).toContain("status: drifted");
    expect(output.stdout).toContain("only in component: endpoint");
  });

  it("usage와 subcommand 해석에 cleanup 명령을 노출한다", () => {
    expect(USAGE).toContain("qa-sdk service ownership-topology <serviceId>");
    expect(USAGE).toContain("qa-sdk service cleanup-plan <serviceId>");
    expect(resolveSubcommand(["service", "cleanup-execute", "order-svc", "--new-version", "1.0.1"])).toEqual({
      name: "service cleanup-execute",
      rest: ["order-svc", "--new-version", "1.0.1"],
    });
    expect(resolveSubcommand(["service", "ownership-topology", "order-svc", "--version", "own-v2"])).toEqual({
      name: "service ownership-topology",
      rest: ["order-svc", "--version", "own-v2"],
    });
  });
});

function response(payload: unknown): Response {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => payload,
  } as Response;
}

async function captureConsoleAsync(run: () => Promise<void>) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const logSpy = vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
    stdout.push(args.join(" "));
  });
  const errorSpy = vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    stderr.push(args.join(" "));
  });

  try {
    await run();
  } finally {
    logSpy.mockRestore();
    errorSpy.mockRestore();
  }

  return {
    stdout: stdout.join("\n"),
    stderr: stderr.join("\n"),
  };
}
