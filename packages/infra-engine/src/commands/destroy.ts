// commands/destroy.ts — 서비스 리소스 삭제 (Pulumi stack + port-forward + 프로필 정리)
import { LocalWorkspace } from "@pulumi/pulumi/automation/index.js";
import { createInfraProfileAdapter } from "../adapters/infra-profile.js";
import { createServiceProfileAdapter } from "../adapters/service-profile.js";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { readFile, writeFile } from "node:fs/promises";

const PROFILE_DIR = resolve(homedir(), ".qa-sdk");
const PF_FILE = resolve(PROFILE_DIR, "infra-pf.json");

interface PfEntry { pid: number; localPort: number; service: string; namespace: string }

async function loadPfMap(): Promise<Record<string, PfEntry>> {
  try { return JSON.parse(await readFile(PF_FILE, "utf-8")); } catch { return {}; }
}

async function savePfMap(map: Record<string, PfEntry>): Promise<void> {
  await writeFile(PF_FILE, JSON.stringify(map, null, 2));
}

export async function destroy(serviceId: string, env: string): Promise<void> {
  const key = `${serviceId}-${env}`;
  const infraProfile = createInfraProfileAdapter(PROFILE_DIR);
  const serviceProfile = createServiceProfileAdapter(PROFILE_DIR);

  console.log(`\n=== infra-engine destroy ===`);
  console.log(`서비스: ${serviceId}`);
  console.log(`환경:   ${env}\n`);

  // 1. Kill port-forward
  const pfMap = await loadPfMap();
  if (pfMap[key]) {
    try {
      process.kill(pfMap[key].pid, "SIGTERM");
      console.log(`[port-forward] PID ${pfMap[key].pid} 종료 (port ${pfMap[key].localPort})`);
    } catch {
      console.log(`[port-forward] PID ${pfMap[key].pid} 이미 종료됨`);
    }
    delete pfMap[key];
    await savePfMap(pfMap);
  } else {
    // Fallback: pkill by pattern
    try {
      const { execa } = await import("execa");
      await execa("pkill", ["-f", `port-forward.*${serviceId}`]);
      console.log(`[port-forward] 패턴 매칭으로 정리`);
    } catch { /* none found */ }
  }

  // 2. Pulumi destroy
  const stackName = `${serviceId}-${env}-local-local`;
  const projectName = `infra-engine-${serviceId}`;
  try {
    const stack = await LocalWorkspace.selectStack({
      stackName,
      projectName,
      program: async () => {},
    }, {
      projectSettings: {
        name: projectName,
        runtime: "nodejs",
        backend: { url: "file://~/.pulumi-local" },
      },
    });

    console.log(`[pulumi] destroying stack ${stackName}...`);
    await stack.destroy({ onOutput: (msg) => process.stdout.write(msg) });
    console.log(`[pulumi] 스택 삭제 완료`);

    // 스택 완전 제거
    await stack.workspace.removeStack(stackName);
  } catch (err) {
    console.warn(`[pulumi] destroy 실패 (스택 없을 수 있음): ${err instanceof Error ? err.message : err}`);
  }

  // 3. Remove from infra-profile
  const deployment = await infraProfile.getDeployment(serviceId);
  if (deployment) {
    const allDeps = await infraProfile.getAllDeployments();
    delete allDeps[serviceId];
    const allMonitors = (await infraProfile.getAllMonitors()).filter(m => m.serviceId !== serviceId);
    await writeFile(
      resolve(PROFILE_DIR, "infra-profile.json"),
      JSON.stringify({ deployments: allDeps, monitors: allMonitors }, null, 2),
    );
    console.log(`[infra-profile] ${serviceId} 배포/모니터 기록 제거`);
  }

  // 4. Restore service-profile
  await serviceProfile.restore(serviceId);
  console.log(`[service-profile] URL 복원`);

  console.log(`\n${serviceId} (${env}) destroy 완료`);
}
