import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import {
  analyzeGateStructure,
  identifyCoreGates,
  validateFlowSchema,
  type FlowSchema,
  type GateProfile,
} from "decision-flow";
import { parse as parseYaml } from "taxonomy-engine";
import {
  extractEvidence,
  parseDecisionFile,
  resolveDecisionLink,
  toFlowSchema,
  type DecisionFile,
} from "taxonomy-decision-bridge";

const TAX_DIR = "docs/taxonomies";
const DECISIONS_DIR = "docs/decisions";

type AnalyzeArgs = {
  json: boolean;
  refFilter?: string;
};

type AnalyzeReport = {
  ref: string;
  decisionPath: string;
  decision: DecisionFile;
  schema: FlowSchema;
  profiles: GateProfile[];
  coreGateIds: string[];
  evidenceCount: number;
  validation: ReturnType<typeof validateFlowSchema>;
};

export async function decisionAnalyzeCmd(args: string[]): Promise<void> {
  const parsed = parseAnalyzeArgs(args);
  if ("error" in parsed) {
    console.error(parsed.error);
    process.exit(1);
    return;
  }

  const cwd = process.cwd();
  const reports: AnalyzeReport[] = [];
  let yamlFiles: string[];
  try {
    yamlFiles = readdirSync(join(cwd, TAX_DIR))
      .filter((f) => f.endsWith(".yaml"))
      .map((f) => join(TAX_DIR, f));
  } catch (e) {
    console.error(`docs/taxonomies/ 읽기 실패: ${(e as Error).message}`);
    process.exit(1);
    return;
  }

  for (const yamlFile of yamlFiles) {
    const text = readFileSync(join(cwd, yamlFile), "utf8");
    const r = parseYaml(text);
    if ("error" in r) continue;
    for (const [axisName, axis] of r.ir.axes) {
      for (const entry of axis.entries) {
        if (!entry.decisionLink) continue;
        const subject = `tax:${r.ir.taxonomy}:${axisName}.${entry.id}`;
        if (parsed.refFilter && parsed.refFilter !== subject) continue;
        const resolved = resolveDecisionLink({
          link: entry.decisionLink,
          yamlAbsDir: dirname(join(cwd, yamlFile)),
          decisionsDir: join(cwd, DECISIONS_DIR),
        });
        if (resolved.kind === "external" || resolved.kind === "unsupported") {
          continue;
        }
        const decisionPath = resolved.absPath;
        if (!existsSync(decisionPath)) continue;
        let decisionFile: DecisionFile;
        try {
          decisionFile = parseDecisionFile(readFileSync(decisionPath, "utf8"));
        } catch {
          continue;
        }
        const schema = toFlowSchema(decisionFile, {
          sourcePath: relative(cwd, decisionPath),
        });
        const profiles = analyzeGateStructure(schema);
        const coreGateIds = identifyCoreGates(profiles).map((g) => g.gateId);
        const evidence = extractEvidence(decisionFile, {
          sourcePath: relative(cwd, decisionPath),
        });
        const validation = validateFlowSchema(schema);
        reports.push({
          ref: subject,
          decisionPath: relative(cwd, decisionPath),
          decision: decisionFile,
          schema,
          profiles,
          coreGateIds,
          evidenceCount: evidence.length,
          validation,
        });
      }
    }
  }

  outputReport(reports, parsed);
}

function parseAnalyzeArgs(args: string[]): AnalyzeArgs | { error: string } {
  const opts: AnalyzeArgs = { json: false };
  for (const a of args) {
    if (a === "--json") opts.json = true;
    else if (!a.startsWith("--")) opts.refFilter = a;
    else return { error: `알 수 없는 옵션: ${a}` };
  }
  return opts;
}

function outputReport(reports: AnalyzeReport[], opts: AnalyzeArgs): void {
  if (opts.json) {
    console.log(JSON.stringify({ reports }, null, 2));
    return;
  }
  if (reports.length === 0) {
    console.log("✔ 분석 대상 decision 없음");
    return;
  }
  for (const r of reports) {
    const gates = r.schema.gates;
    const totalBranches = gates.reduce((sum, g) => sum + (g.branches?.length ?? 0), 0);
    const isSkeleton = totalBranches === 0 && r.evidenceCount === 0;
    const isMulti = gates.length > 1;

    console.log(`\n● ${r.ref}`);
    console.log(`  decision file: ${r.decisionPath}`);
    console.log(`  lifecycle:     ${r.decision.meta.lifecycle}`);
    if (isSkeleton) {
      console.log(`  🌱 skeleton — ^option/^evidence를 채우면 분석이 valid해집니다`);
      if (r.decision.markers.outcome) {
        console.log(`  outcome:       ${r.decision.markers.outcome}`);
      }
      continue;
    }

    console.log(
      `  gates:         ${gates.length}` +
        (isMulti ? ` (${gates.map((g) => g.id).join(", ")})` : ""),
    );

    if (isMulti) {
      for (const g of gates) {
        const branchCount = g.branches?.length ?? 0;
        const reqEv = g.requiredEvidence ?? [];
        const profile = r.profiles.find((p) => p.gateId === g.id);
        const cascade = profile?.cascadeImpact ?? 0;
        console.log(
          `    [${g.id}] phase=${g.phase} weight=${g.weight ?? "tactical"}` +
            ` branches=${branchCount}` +
            (reqEv.length ? ` evidence=[${reqEv.join(",")}]` : ""),
        );
        if (profile) {
          console.log(
            `        directImpact=${profile.directImpact} cascadeImpact=${cascade}`,
          );
        }
      }
    } else {
      const g = gates[0];
      const branchCount = g.branches?.length ?? 0;
      console.log(
        `  branches:      ${branchCount}` +
          (branchCount ? ` (${g.branches!.map((b) => b.id).join(", ")})` : ""),
      );
      const reqEv = g.requiredEvidence ?? [];
      console.log(
        `  evidence:      ${r.evidenceCount}` +
          (reqEv.length ? ` (kinds: ${reqEv.join(", ")})` : ""),
      );
      const profile = r.profiles[0];
      if (profile) {
        const cascade = profile.cascadeImpact ?? 0;
        console.log(
          `  gate profile:  weight=${profile.weight} directImpact=${profile.directImpact} cascadeImpact=${cascade}`,
        );
      }
    }

    console.log(
      `  core gates:    ${r.coreGateIds.length}/${r.profiles.length}` +
        (r.coreGateIds.length ? ` (${r.coreGateIds.join(", ")})` : ""),
    );
    if (!r.validation.valid) {
      console.log(`  schema issues: ${r.validation.issues.length}`);
      for (const issue of r.validation.issues) {
        console.log(`    - ${issue.message}`);
      }
    }
    if (r.decision.markers.outcome) {
      console.log(`  outcome:       ${r.decision.markers.outcome}`);
    }
  }
  console.log(`\n총 ${reports.length}건 분석.`);
}
