import { describe, it, expect, vi } from "vitest";

vi.mock("execa", () => ({
  execa: vi.fn(),
}));

import { createSopsLoader } from "../../src/config/sops-loader.js";
import { execa } from "execa";

const mockedExeca = vi.mocked(execa);

describe("SopsLoader", () => {
  const loader = createSopsLoader();

  it("sops CLI 호출 → JSON 파싱", async () => {
    const jsonOutput = JSON.stringify({ global: { region: "local" }, services: {}, connections: {} });
    mockedExeca.mockResolvedValueOnce({ stdout: jsonOutput } as any);

    const result = await loader.decrypt("config/dev.yaml");
    expect(result).toEqual({ global: { region: "local" }, services: {}, connections: {} });
    expect(mockedExeca).toHaveBeenCalledWith("sops", ["--decrypt", "--output-type", "json", "config/dev.yaml"]);
  });

  it("sops 미설치 → 에러 메시지", async () => {
    mockedExeca.mockRejectedValueOnce(new Error("ENOENT"));
    await expect(loader.decrypt("config/dev.yaml")).rejects.toThrow("sops");
  });
});
