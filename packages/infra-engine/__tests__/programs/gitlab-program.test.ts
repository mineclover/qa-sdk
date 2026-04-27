import { describe, expect, it } from "vitest";
import { buildOmnibusConfig } from "../../src/programs/gitlab-program.js";

describe("buildOmnibusConfig", () => {
  it("external_url만 포함한다 (rootPasswordEnv 없음)", () => {
    const cfg = buildOmnibusConfig({
      externalUrl: "http://localhost:8929",
      useRootPasswordEnv: false,
    });
    expect(cfg).toBe("external_url 'http://localhost:8929'");
  });

  it("rootPasswordEnv가 true면 initial_root_password 라인을 추가한다", () => {
    const cfg = buildOmnibusConfig({
      externalUrl: "http://localhost:8929",
      useRootPasswordEnv: true,
    });
    expect(cfg).toContain("external_url 'http://localhost:8929'");
    expect(cfg).toContain(
      "gitlab_rails['initial_root_password'] = ENV['GITLAB_ROOT_PASSWORD'] if ENV['GITLAB_ROOT_PASSWORD']",
    );
  });

  it("두 라인 사이는 세미콜론+공백으로 구분한다", () => {
    const cfg = buildOmnibusConfig({
      externalUrl: "http://gitlab.test",
      useRootPasswordEnv: true,
    });
    const parts = cfg.split("; ");
    expect(parts).toHaveLength(2);
    expect(parts[0]).toBe("external_url 'http://gitlab.test'");
  });
});
