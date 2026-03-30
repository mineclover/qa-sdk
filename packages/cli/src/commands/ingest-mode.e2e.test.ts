/**
 * service mode CLI E2E 테스트.
 *
 * 실제 CLI 바이너리를 subprocess로 실행하여 프로필 전환을 검증한다.
 * (기존 ingest mode → service mode로 통합됨)
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execSync } from "node:child_process";
import { existsSync, readFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const CLI_PATH = resolve(dirname(fileURLToPath(import.meta.url)), "../../dist/index.js");

describe("service mode CLI E2E", () => {
  let tempHome: string;

  beforeEach(() => {
    tempHome = join(tmpdir(), `qa-sdk-mode-test-${Date.now()}`);
    mkdirSync(tempHome, { recursive: true });
  });

  afterEach(() => {
    try { rmSync(tempHome, { recursive: true, force: true }); } catch { /* 무시 */ }
  });

  function run(args: string): string {
    return execSync(`node ${CLI_PATH} ${args}`, {
      env: { ...process.env, HOME: tempHome },
      encoding: "utf-8",
      timeout: 30_000,
    });
  }

  function readProfile(): Record<string, unknown> | null {
    const path = join(tempHome, ".qa-sdk", "service-profile.json");
    if (!existsSync(path)) return null;
    return JSON.parse(readFileSync(path, "utf-8"));
  }

  it("인수 없이 호출 → 기본 local 프로필 표시", () => {
    const output = run("service mode");
    expect(output).toContain("Service Profile");
    expect(output).toContain("local");
  });

  it("local 모드 전환 → 프로필 파일 생성", () => {
    run("service mode local");
    const profile = readProfile();
    expect(profile).toBeTruthy();
    expect(profile!.mode).toBe("local");
    expect(profile!.insightsDriver).toBe("local");
    expect((profile!.services as Record<string, string>)["ingest-server"]).toBe("http://localhost:3200");
  });

  it("prod 모드 전환 → insightsDriver=app-hub + prod URL", () => {
    run("service mode prod");
    const profile = readProfile();
    expect(profile!.mode).toBe("prod");
    expect(profile!.insightsDriver).toBe("app-hub");
    expect((profile!.services as Record<string, string>)["ingest-server"]).toContain("qa-sdk.io");
  });

  it("staging 모드 → insightsDriver=local 유지", () => {
    run("service mode staging");
    const profile = readProfile();
    expect(profile!.mode).toBe("staging");
    expect(profile!.insightsDriver).toBe("local");
    expect((profile!.services as Record<string, string>)["registry-service"]).toContain("staging");
  });

  it("--set으로 개별 서비스 URL 수정", () => {
    run("service mode prod");
    run("service mode --set ingest-server=https://custom.ingest.io");
    const profile = readProfile();
    expect((profile!.services as Record<string, string>)["ingest-server"]).toBe("https://custom.ingest.io");
    // 나머지는 prod 유지
    expect((profile!.services as Record<string, string>)["registry-service"]).toContain("qa-sdk.io");
  });

  it("local ↔ prod 전환 시 appHub 설정 보존", () => {
    run("service mode prod --set appHub.projectId=my-project");
    run("service mode local");
    const profile = readProfile();
    expect(profile!.mode).toBe("local");
    expect(profile!.insightsDriver).toBe("local");
    const appHub = profile!.appHub as Record<string, string>;
    expect(appHub.projectId).toBe("my-project");
  });

  it("알 수 없는 모드 → 에러", () => {
    try {
      run("service mode unknown-mode");
    } catch (err: unknown) {
      // console.error → stderr
      const stderr = (err as { stderr?: Buffer })?.stderr?.toString() ?? "";
      const stdout = (err as { stdout?: Buffer })?.stdout?.toString() ?? "";
      expect(stdout + stderr).toContain("알 수 없는 모드");
    }
  });

  it("ingest mode → service mode 동일 동작", () => {
    // ingest mode는 service mode의 re-export이므로 동일하게 동작
    run("ingest mode local");
    const profile = readProfile();
    expect(profile!.mode).toBe("local");
  });

  it("prod → credential 마스킹 + 보존", () => {
    run("service mode prod --set appHub.credential=/path/to/key.json");
    const output = run("service mode");
    expect(output).toContain("***"); // 마스킹
    const profile = readProfile();
    const appHub = profile!.appHub as Record<string, string>;
    expect(appHub.credential).toBe("/path/to/key.json");
  });
});
