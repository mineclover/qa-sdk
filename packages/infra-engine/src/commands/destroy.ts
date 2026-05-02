// @def.boundary infra-engine-system
// @def.doc infra-engine-system

// commands/destroy.ts — 서비스 리소스 삭제 (Pulumi stack + port-forward + 프로필 정리)
import { LocalWorkspace } from "@pulumi/pulumi/automation/index.js";
import { createInfraProfileAdapter } from "../adapters/infra-profile.js";
import { createServiceProfileAdapter } from "../adapters/service-profile.js";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { readFile, writeFile, rename } from "node:fs/promises";
import { validateId, isSafePid } from "../lib/validation.js";
import { loadPfMap, savePfMap } from "../lib/pf-registry.js";
import { loadInfraConfig, resolvePulumiBackendUrl } from "./config-manager.js";

const PROFILE_DIR = resolve(homedir(), ".qa-sdk");

export async function destroy(serviceId: string, env: string): Promise<void> {
  validateId(serviceId, "serviceId");
  validateId(env, "env");
  const key = `${serviceId}-${env}`;
  const infraProfile = createInfraProfileAdapter(PROFILE_DIR);
  const serviceProfile = createServiceProfileAdapter(PROFILE_DIR);

  console.log(`\n=== infra-engine destroy ===`);
  console.log(`서비스: ${serviceId}`);
  console.log(`환경:   ${env}\n`);

  // 1. Kill port-forward
  const pfMap = await loadPfMap();
  if (pfMap[key]) {
    if (isSafePid(pfMap[key].pid)) {
      try {
        process.kill(pfMap[key].pid, "SIGTERM");
        console.log(`[port-forward] PID ${pfMap[key].pid} 종료 (port ${pfMap[key].localPort})`);
      } catch {
        console.log(`[port-forward] PID ${pfMap[key].pid} 이미 종료됨`);
      }
    } else {
      console.warn(`[port-forward] 유효하지 않은 PID: ${pfMap[key].pid}`);
    }
    delete pfMap[key];
    await savePfMap(pfMap);
  }

  // 2. Pulumi destroy
  const deployment = await infraProfile.getDeployment(serviceId);
  const stackName = deployment?.stackName ?? `${serviceId}-${env}-local-local`;
  const projectName = `infra-engine-${serviceId}`;
  let backendUrl = process.env.PULUMI_BACKEND_URL;
  if (!backendUrl) {
    try {
      const config = await loadInfraConfig();
      backendUrl = resolvePulumiBackendUrl(config) ?? "file://~/.pulumi-local";
    } catch {
      backendUrl = "file://~/.pulumi-local";
    }
  }
  try {
    if (deployment?.provider === "cloudflare") {
      console.log("[pulumi] cloudflare 배포는 Pulumi stack destroy 대상이 아님 — stack 삭제 생략");
    } else {
      console.log(`[pulumi] backend: ${backendUrl.split("?")[0]}`);
      console.log(`[pulumi] destroying stack ${stackName}...`);
      const stack = await LocalWorkspace.selectStack({
        stackName,
        projectName,
        program: async () => {},
      }, {
        projectSettings: {
          name: projectName,
          runtime: "nodejs",
          backend: { url: backendUrl },
        },
      });

      await stack.destroy({ onOutput: (msg) => process.stdout.write(msg) });
      console.log("[pulumi] 스택 삭제 완료");

      // 스택 완전 제거
      await stack.workspace.removeStack(stackName);
    }
  } catch (err) {
    console.warn(`[pulumi] destroy 실패 (스택 없을 수 있음): ${err instanceof Error ? err.message : err}`);
  }

  // 3. Remove from infra-profile — 전체 필드 보존하며 대상만 삭제
  const profilePath = resolve(PROFILE_DIR, "infra-profile.json");
  try {
    const raw = JSON.parse(await readFile(profilePath, "utf-8"));
    delete raw.deployments?.[serviceId];
    raw.monitors = (raw.monitors ?? []).filter((m: any) => m.serviceId !== serviceId);
    const tmp = profilePath + ".tmp";
    await writeFile(tmp, JSON.stringify(raw, null, 2));
    await rename(tmp, profilePath);
    console.log(`[infra-profile] ${serviceId} 배포/모니터 기록 제거`);
  } catch { /* profile 파일 없으면 무시 */ }

  // 4. Restore service-profile
  await serviceProfile.restore(serviceId);
  console.log(`[service-profile] URL 복원`);

  console.log(`\n${serviceId} (${env}) destroy 완료`);
}
