#!/usr/bin/env tsx
/**
 * sim:catalog:validate — 4-way 정합성 게이트.
 *   1) contracts catalog invariant
 *   2) docker-compose.sim.yaml의 sim-approval-api-v1/v2 image:${APPROVAL_V*_TAG} 라인
 *   3) .env.sim의 APPROVAL_V*_TAG 값이 catalog 산출과 일치
 *   4) filesystem: services/approval-api/Dockerfile 존재
 * spec: docs/superpowers/specs/2026-04-28-canary-scaling/02-canary-topology.md §2 §5
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildImageTag, parseServicePrefix } from "sim-identifier-grammar";
import { getCurrentTopology, getServiceVersionTag } from "sim-service-catalog";
import { SIM_SERVICE_PREFIXES } from "../contracts/service-version.catalog.ts";

const SIM_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

interface Failure { axis: "contracts" | "compose" | "env" | "filesystem"; detail: string; }
const failures: Failure[] = [];
const fail = (axis: Failure["axis"], detail: string) => failures.push({ axis, detail });
const parseValue = (tag: string): number => {
  const m = tag.match(/^v([1-9][0-9]*)/);
  if (!m) throw new Error(`parseValue: invalid tag ${tag}`);
  return Number(m[1]);
};

function printAndExit(stableTag?: string, candidateTag?: string | null): never {
  if (failures.length === 0) {
    console.log("sim:catalog:validate — OK (4-way 정합성 통과)");
    console.log(`  contracts.stable    = ${stableTag}`);
    console.log(`  contracts.candidate = ${candidateTag ?? "<none>"}`);
    process.exit(0);
  }
  console.error(`sim:catalog:validate — FAIL (${failures.length}건)`);
  for (const f of failures) console.error(`  [${f.axis}] ${f.detail}`);
  process.exit(1);
}

// (1) contracts
const approval = SIM_SERVICE_PREFIXES.approvalApi;
let stableTag: string;
let candidateTag: string | null = null;
try {
  const topology = getCurrentTopology(approval, { revision: 0 });
  stableTag = getServiceVersionTag(approval, "stable");
  candidateTag = topology.candidate ? getServiceVersionTag(approval, "candidate") : null;
} catch (err) {
  fail("contracts", `catalog invariant 위반: ${(err as Error).message}`);
  printAndExit();
}

// image tag grammar 통과 확인 (raw 보간 차단)
const prefix = parseServicePrefix(approval.prefix);
buildImageTag({
  registry: "qa-sdk",
  servicePrefix: prefix,
  versionTag: { axis: "version", value: parseValue(stableTag), state: "stable" },
});
if (candidateTag) {
  buildImageTag({
    registry: "qa-sdk",
    servicePrefix: prefix,
    versionTag: { axis: "version", value: parseValue(candidateTag), state: "candidate" },
  });
}

// (2) docker-compose
const composeRaw = readFileSync(resolve(SIM_ROOT, "docker-compose.sim.yaml"), "utf8");
// follow-up #26 와 동일 grammar 확장 — `${VAR}` 와 `${VAR:-default}` 둘 다 인식.
const composeKeys = [...composeRaw.matchAll(
  /image:\s*qa-sdk\/sim-approval-api:\$\{(APPROVAL_V[12]_TAG)(?::-[a-z0-9.-]+)?\}/g,
)].map((m) => m[1]);
if (!composeKeys.includes("APPROVAL_V1_TAG")) {
  fail("compose", "sim-approval-api-v1 image:${APPROVAL_V1_TAG} 라인 누락");
}
if (candidateTag && !composeKeys.includes("APPROVAL_V2_TAG")) {
  fail("compose", "candidate 존재하지만 sim-approval-api-v2 image:${APPROVAL_V2_TAG} 라인 누락");
}

// (3) .env.sim
const envPath = resolve(SIM_ROOT, ".env.sim");
if (!existsSync(envPath)) {
  fail("env", `.env.sim 부재: ${envPath} (sops decrypt 미실행)`);
} else {
  const envRaw = readFileSync(envPath, "utf8");
  const envV1 = envRaw.match(/^APPROVAL_V1_TAG\s*=\s*(.+)$/m)?.[1]?.trim();
  const envV2 = envRaw.match(/^APPROVAL_V2_TAG\s*=\s*(.+)$/m)?.[1]?.trim();
  if (!envV1) fail("env", "APPROVAL_V1_TAG 미설정");
  else if (envV1 !== stableTag) fail("env", `APPROVAL_V1_TAG=${envV1} ≠ catalog stable=${stableTag}`);
  if (candidateTag) {
    if (!envV2) fail("env", "APPROVAL_V2_TAG 미설정 (candidate 존재)");
    else if (envV2 !== candidateTag) fail("env", `APPROVAL_V2_TAG=${envV2} ≠ catalog candidate=${candidateTag}`);
  }
}

// (4) filesystem
const approvalRoot = resolve(SIM_ROOT, "services", "approval-api");
if (!existsSync(approvalRoot)) fail("filesystem", `service 디렉토리 부재: ${approvalRoot}`);
if (!existsSync(resolve(approvalRoot, "Dockerfile"))) {
  fail("filesystem", `Dockerfile 부재: ${resolve(approvalRoot, "Dockerfile")}`);
}

printAndExit(stableTag, candidateTag);
