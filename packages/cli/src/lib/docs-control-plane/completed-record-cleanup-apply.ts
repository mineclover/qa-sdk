// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import { access, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { dirname, resolve } from "node:path";

import { extractFrontmatter, parseDocument, writeFrontmatterToFile, type DbMetadata } from "definition-catalog";
import type { CompletedRecordState, DocumentEnvelope } from "doc-envelope";

import {
  buildCompletedRecordCleanupPlan,
  type CompletedRecordCleanupPlan,
  type CompletedRecordCleanupPlanAction,
} from "./completed-record-cleanup-plan.js";

export interface CompletedRecordCleanupApplyResult {
  readonly action: CompletedRecordCleanupPlanAction;
  readonly target: string;
  readonly targetValidatedAs: "record-path" | "document-id" | "paired-path";
  readonly record: CompletedRecordState;
  readonly moved: readonly {
    readonly from: string;
    readonly to: string;
    readonly kind: "record" | "paired";
  }[];
  readonly updated: readonly string[];
  readonly preservedEvidencePaths: readonly string[];
  readonly warnings: readonly string[];
}

export interface ApplyCompletedRecordCleanupOptions {
  readonly rootDir: string;
  readonly documents: readonly DocumentEnvelope[];
  readonly completedRecords: readonly CompletedRecordState[];
  readonly target: string;
  readonly action: CompletedRecordCleanupPlanAction;
  readonly plan?: CompletedRecordCleanupPlan;
}

interface CleanupRenderSource {
  readonly labelPath: string;
  readonly content: string;
  readonly frontmatter: ReturnType<typeof extractFrontmatter>;
  readonly body: string;
  readonly completedItems: readonly string[];
}

export async function applyCompletedRecordCleanup(
  options: ApplyCompletedRecordCleanupOptions,
): Promise<CompletedRecordCleanupApplyResult | null> {
  const plan = options.plan ?? buildCompletedRecordCleanupPlan({
    documents: options.documents,
    completedRecords: options.completedRecords,
    target: options.target,
    action: options.action,
    dryRunDefaulted: false,
  });
  if (!plan) return null;

  const moves = plannedMoves(plan);
  const updated = plannedUpdates(plan);
  const recordTargetPath = recordResultPath(plan);
  if (!moves && updated.length === 0) return null;
  const safeMoves = moves ?? [];
  const renderSource = requiresCleanupRenderSource(plan)
    ? await loadCleanupRenderSource(options.rootDir, plan.record.path, plan.record.path)
    : null;

  for (const move of safeMoves) {
    await assertPathExists(options.rootDir, move.from);
    await assertPathAbsent(options.rootDir, move.to);
  }
  for (const update of updated) {
    await assertPathExists(options.rootDir, update);
  }

  if (options.action === "promote-spec" && plan.assimilationTargetPath) {
    await assimilateCompletedTodoIntoSpec(
      options.rootDir,
      plan.record.path,
      plan.assimilationTargetPath,
      plan,
    );
  }
  for (const move of safeMoves) {
    const fromPath = resolve(options.rootDir, normalizePath(move.from));
    const toPath = resolve(options.rootDir, normalizePath(move.to));
    await mkdir(dirname(toPath), { recursive: true });
    await rename(fromPath, toPath);
    if (shouldArchiveLifecycle(options.action, move.kind)) {
      await archiveFrontmatterIfPresent(options.rootDir, move.to);
    }
    await applyFrontmatterPatchIfPresent(options.rootDir, move.to, plan);
  }
  if (recordTargetPath && renderSource && requiresRecordBodyRewrite(plan)) {
    await writeCleanupRecordTargetBody(
      options.rootDir,
      recordTargetPath,
      plan,
      renderSource,
    );
    await applyFrontmatterPatchIfPresent(options.rootDir, recordTargetPath, plan);
  } else if (recordTargetPath && !recordMoveExists(safeMoves)) {
    await applyFrontmatterPatchIfPresent(options.rootDir, recordTargetPath, plan);
  }
  if (
    plan.action === "rewrite"
    && plan.assimilationTargetPath
    && plan.assimilationTargetPath !== recordTargetPath
    && renderSource
  ) {
    await rewriteAssimilationTargetBody(
      options.rootDir,
      plan.assimilationTargetPath,
      plan,
      renderSource,
    );
  }
  for (const update of updated) {
    await applyFrontmatterPatchIfPresent(options.rootDir, update, plan);
  }

  return {
    action: options.action,
    target: options.target,
    targetValidatedAs: plan.targetValidatedAs,
    record: plan.record,
    moved: safeMoves,
    updated,
    preservedEvidencePaths: plan.preservedEvidencePaths,
    warnings: plan.warnings,
  };
}

async function assertPathExists(rootDir: string, path: string): Promise<void> {
  const fullPath = resolve(rootDir, normalizePath(path));
  await access(fullPath, fsConstants.F_OK);
}

async function assertPathAbsent(rootDir: string, path: string): Promise<void> {
  const fullPath = resolve(rootDir, normalizePath(path));
  try {
    await access(fullPath, fsConstants.F_OK);
    throw new Error(`cleanup output path already exists: ${path}`);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("cleanup output path already exists:")) {
      throw error;
    }
  }
}

function plannedMoves(
  plan: CompletedRecordCleanupPlan,
): readonly { readonly from: string; readonly to: string; readonly kind: "record" | "paired" }[] | null {
  const record = plan.record;
  const action = plan.action;
  if (action === "archive") {
    return [
      {
        from: record.path,
        to: plan.proposedOutputPath,
        kind: "record",
      },
      ...(record.pairedPath
        ? [{
          from: record.pairedPath,
          to: plan.secondaryOutputPath ?? archiveOutputPath(record.pairedPath),
          kind: "paired" as const,
        }]
        : []),
    ];
  }

  if (action === "memo-conversion" && record.kind === "todo" && !record.pairedPath) {
    return [
      {
        from: record.path,
        to: plan.proposedOutputPath,
        kind: "record",
      },
    ];
  }

  if (action === "memo-conversion" && record.kind === "prd" && record.pairedPath) {
    return [
      {
        from: record.path,
        to: plan.proposedOutputPath,
        kind: "record",
      },
      {
        from: record.pairedPath,
        to: plan.secondaryOutputPath ?? archiveOutputPath(record.pairedPath),
        kind: "paired",
      },
    ];
  }

  if (action === "promote-spec" && record.kind === "todo" && !record.pairedPath) {
    return [
      {
        from: record.path,
        to: plan.secondaryOutputPath ?? archiveOutputPath(record.path),
        kind: "record",
      },
    ];
  }

  if (action === "rewrite") {
    return [
      ...(plan.proposedOutputPath !== record.path
        ? [{
          from: record.path,
          to: plan.proposedOutputPath,
          kind: "record" as const,
        }]
        : []),
      ...(record.pairedPath && plan.secondaryOutputPath
        ? [{
          from: record.pairedPath,
          to: plan.secondaryOutputPath,
          kind: "paired" as const,
        }]
        : []),
    ];
  }

  return null;
}

function plannedUpdates(
  plan: ReturnType<typeof buildCompletedRecordCleanupPlan> extends infer T ? T extends null ? never : T : never,
): readonly string[] {
  return plan.assimilationTargetPath
    && (plan.action === "promote-spec" || (plan.action === "rewrite" && plan.assimilationTargetPath !== recordResultPath(plan)))
    ? [plan.assimilationTargetPath]
    : [];
}

async function assimilateCompletedTodoIntoSpec(
  rootDir: string,
  todoPath: string,
  specPath: string,
  plan: CompletedRecordCleanupPlan,
): Promise<void> {
  const todoFullPath = resolve(rootDir, normalizePath(todoPath));
  const specFullPath = resolve(rootDir, normalizePath(specPath));
  const [todoContent, specContent] = await Promise.all([
    readFile(todoFullPath, "utf8"),
    readFile(specFullPath, "utf8"),
  ]);

  const completedItems = extractCompletedTodoItems(todoContent);
  if (completedItems.length === 0) {
    throw new Error(`cleanup todo has no completed checklist items: ${todoPath}`);
  }
  if (specContent.includes(`Assimilated from \`${todoPath}\``)) {
    throw new Error(`cleanup spec already references completed todo: ${todoPath}`);
  }

  const specFrontmatter = extractFrontmatter(specContent);
  if (!specFrontmatter) {
    throw new Error(`spec has no frontmatter for cleanup promotion: ${specPath}`);
  }

  const assimilationBlock = [
    plan.bodyTemplate
      ? renderCleanupBodyTemplate(plan.bodyTemplate, {
        plan,
        sourcePath: todoPath,
        sourceBody: trimmedBody(todoContent),
        completedItems,
      })
      : [
        "",
        "## Todo Assimilation",
        "",
        `Assimilated from \`${todoPath}\`.`,
        "",
        "Completed execution slice:",
        ...completedItems.map((item) => `- ${item}`),
        ...(plan.candidate.recommendation.reason ? ["", `Cleanup recommendation: ${plan.candidate.recommendation.reason}`] : []),
        ...(plan.appendMarkdown ? ["", plan.appendMarkdown] : []),
        "",
      ].join("\n"),
  ].join("");

  const nextContent = `---\n${specFrontmatter.yaml}\n---\n${trimmedBody(specFrontmatter.body)}${assimilationBlock}`;
  await writeFile(specFullPath, nextContent, "utf8");
}

async function appendCleanupMemoBody(
  rootDir: string,
  sourcePath: string,
  targetPath: string,
  plan: CompletedRecordCleanupPlan,
): Promise<void> {
  const source = await loadCleanupRenderSource(rootDir, sourcePath, sourcePath);
  await writeCleanupRecordTargetBody(rootDir, targetPath, plan, source);
}

async function writeCleanupRecordTargetBody(
  rootDir: string,
  targetPath: string,
  plan: CompletedRecordCleanupPlan,
  source: CleanupRenderSource,
): Promise<void> {
  const memoBody = [
    plan.bodyTemplate
      ? renderCleanupBodyTemplate(plan.bodyTemplate, {
        plan,
        sourcePath: source.labelPath,
        sourceBody: source.body,
        completedItems: source.completedItems,
      })
      : [
        source.body,
        "",
        "## Cleanup Memo Conversion",
        "",
        `Converted from \`${source.labelPath}\`.`,
        ...(plan.candidate.recommendation.reason ? ["", `Cleanup recommendation: ${plan.candidate.recommendation.reason}`] : []),
        ...(plan.appendMarkdown ? ["", plan.appendMarkdown] : []),
        "",
      ].join("\n"),
  ].join("");
  const nextContent = source.frontmatter
    ? `---\n${source.frontmatter.yaml}\n---\n${memoBody}`
    : memoBody;
  await writeFile(resolve(rootDir, normalizePath(targetPath)), nextContent, "utf8");
}

async function rewriteAssimilationTargetBody(
  rootDir: string,
  targetPath: string,
  plan: CompletedRecordCleanupPlan,
  source: CleanupRenderSource,
): Promise<void> {
  const targetFullPath = resolve(rootDir, normalizePath(targetPath));
  const targetContent = await readFile(targetFullPath, "utf8");
  const targetFrontmatter = extractFrontmatter(targetContent);
  const targetBody = trimmedBody(targetFrontmatter ? targetFrontmatter.body : targetContent);
  const assimilationBlock = [
    plan.bodyTemplate
      ? renderCleanupBodyTemplate(plan.bodyTemplate, {
        plan,
        sourcePath: source.labelPath,
        sourceBody: source.body,
        completedItems: source.completedItems,
      })
      : [
        "## Cleanup Rewrite Assimilation",
        "",
        `Rewritten from \`${source.labelPath}\`.`,
        "",
        source.body,
        ...(source.completedItems.length > 0
          ? ["", "Completed execution slice:", ...source.completedItems.map((item) => `- ${item}`)]
          : []),
        ...(plan.candidate.recommendation.reason ? ["", `Cleanup recommendation: ${plan.candidate.recommendation.reason}`] : []),
        ...(plan.appendMarkdown ? ["", plan.appendMarkdown] : []),
        "",
      ].join("\n"),
  ].join("");
  const nextBody = targetBody ? `${targetBody}\n\n${assimilationBlock}` : assimilationBlock;
  const nextContent = targetFrontmatter
    ? `---\n${targetFrontmatter.yaml}\n---\n${nextBody}`
    : nextBody;
  await writeFile(targetFullPath, nextContent, "utf8");
}

function renderCleanupBodyTemplate(
  template: string,
  input: {
    readonly plan: CompletedRecordCleanupPlan;
    readonly sourcePath: string;
    readonly sourceBody: string;
    readonly completedItems?: readonly string[];
  },
): string {
  const values = cleanupApplyTemplateValues(input);
  return template.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_match, key: string) =>
    values[key] ?? `{{${key}}}`
  );
}

function cleanupApplyTemplateValues(input: {
  readonly plan: CompletedRecordCleanupPlan;
  readonly sourcePath: string;
  readonly sourceBody: string;
  readonly completedItems?: readonly string[];
}): Readonly<Record<string, string>> {
  const { plan, sourcePath, sourceBody } = input;
  return {
    "record.path": plan.record.path,
    "record.documentId": plan.record.documentId,
    "record.kind": plan.record.kind,
    "record.title": plan.record.title,
    "source.path": sourcePath,
    "source.body": sourceBody,
    "completedItemsMarkdown": (input.completedItems ?? []).map((item) => `- ${item}`).join("\n"),
    "cleanupRecommendation": plan.candidate.recommendation.reason,
    "appendMarkdown": plan.appendMarkdown ?? "",
    "plan.action": plan.action,
    "plan.outputPath": plan.proposedOutputPath,
    "plan.secondaryOutputPath": plan.secondaryOutputPath ?? "",
    "plan.assimilationTargetPath": plan.assimilationTargetPath ?? "",
  };
}

function extractCompletedTodoItems(content: string): readonly string[] {
  return content
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*[-*]\s+\[[xX]\]\s+(.+?)\s*$/)?.[1]?.trim())
    .filter((line): line is string => Boolean(line));
}

function trimmedBody(value: string): string {
  return value.replace(/\s+$/u, "");
}

function archiveOutputPath(path: string): string {
  const normalizedPath = normalizePath(path);
  if (normalizedPath.startsWith("tasks/")) {
    return normalizePath(`tasks/archive/${normalizedPath.slice("tasks/".length)}`);
  }
  return normalizePath(`${dirname(normalizedPath)}/archive/${normalizedPath.split("/").pop() ?? normalizedPath}`);
}

function normalizePath(value: string): string {
  return value.replaceAll("\\", "/").replace(/\/+/g, "/");
}

function requiresCleanupRenderSource(
  plan: CompletedRecordCleanupPlan,
): boolean {
  return requiresRecordBodyRewrite(plan) || (plan.action === "rewrite" && Boolean(plan.assimilationTargetPath));
}

function shouldArchiveLifecycle(
  action: CompletedRecordCleanupPlanAction,
  kind: "record" | "paired",
): boolean {
  return action === "archive" || (action === "promote-spec" && kind === "record");
}

function recordResultPath(plan: CompletedRecordCleanupPlan): string | null {
  if (plan.action === "archive") return null;
  if (plan.action === "memo-conversion") return plan.proposedOutputPath;
  if (plan.action === "rewrite") return plan.proposedOutputPath;
  return null;
}

function requiresRecordBodyRewrite(plan: CompletedRecordCleanupPlan): boolean {
  return Boolean(plan.bodyTemplate || plan.appendMarkdown) && (plan.action === "memo-conversion" || plan.action === "rewrite");
}

function recordMoveExists(
  moves: readonly { readonly from: string; readonly to: string; readonly kind: "record" | "paired" }[],
): boolean {
  return moves.some((move) => move.kind === "record");
}

async function loadCleanupRenderSource(
  rootDir: string,
  path: string,
  labelPath: string,
): Promise<CleanupRenderSource> {
  const fullPath = resolve(rootDir, normalizePath(path));
  const content = await readFile(fullPath, "utf8");
  const frontmatter = extractFrontmatter(content);
  return {
    labelPath,
    content,
    frontmatter,
    body: frontmatter ? trimmedBody(frontmatter.body) : trimmedBody(content),
    completedItems: extractCompletedTodoItems(content),
  };
}

async function archiveFrontmatterIfPresent(
  rootDir: string,
  path: string,
): Promise<void> {
  const fullPath = resolve(rootDir, normalizePath(path));
  const content = await readFile(fullPath, "utf8");
  const frontmatter = extractFrontmatter(content);
  if (!frontmatter) return;

  const parsed = parseDocument(content, fullPath);
  const metadata: DbMetadata = {
    ...(parsed.def.version ? { version: parsed.def.version } : {}),
    ...(parsed.def.revision !== undefined ? { revision: parsed.def.revision } : {}),
    ...(parsed.def.level ? { level: parsed.def.level } : {}),
    scope: parsed.def.scope ?? "flow",
    aspect: parsed.def.aspect ?? "process_flow",
    depth: parsed.def.depth ?? "specification",
    lifecycle: "archived",
    ...(parsed.def.layer ? { layer: parsed.def.layer } : {}),
    ...(parsed.def.tags ? { tags: parsed.def.tags } : {}),
    ...(parsed.def.links ? { links: parsed.def.links.map((link) => ({ target: link.target, type: link.type })) } : {}),
    ...(parsed.def.svc ? { svc: parsed.def.svc } : {}),
    ...(parsed.def.address ? { address: parsed.def.address } : {}),
  };

  await writeFrontmatterToFile(fullPath, metadata);
}

async function applyFrontmatterPatchIfPresent(
  rootDir: string,
  path: string,
  plan: CompletedRecordCleanupPlan,
): Promise<void> {
  if (!plan.frontmatterPatch) return;
  const fullPath = resolve(rootDir, normalizePath(path));
  const content = await readFile(fullPath, "utf8");
  const frontmatter = extractFrontmatter(content);
  if (!frontmatter) return;

  const parsed = parseDocument(content, fullPath);
  const metadata: DbMetadata = {
    ...(parsed.def.version ? { version: parsed.def.version } : {}),
    ...(parsed.def.revision !== undefined ? { revision: parsed.def.revision } : {}),
    ...(plan.frontmatterPatch.level ? { level: plan.frontmatterPatch.level } : parsed.def.level ? { level: parsed.def.level } : {}),
    scope: plan.frontmatterPatch.scope ?? parsed.def.scope ?? "flow",
    aspect: plan.frontmatterPatch.aspect ?? parsed.def.aspect ?? "process_flow",
    depth: plan.frontmatterPatch.depth ?? parsed.def.depth ?? "specification",
    lifecycle: plan.frontmatterPatch.lifecycle ?? parsed.def.lifecycle,
    ...(plan.frontmatterPatch.layer ? { layer: plan.frontmatterPatch.layer } : parsed.def.layer ? { layer: parsed.def.layer } : {}),
    ...(plan.frontmatterPatch.tags ? { tags: plan.frontmatterPatch.tags } : parsed.def.tags ? { tags: parsed.def.tags } : {}),
    ...(plan.frontmatterPatch.links
      ? { links: plan.frontmatterPatch.links.map((link) => ({ target: link.target, type: link.type })) }
      : parsed.def.links
      ? { links: parsed.def.links.map((link) => ({ target: link.target, type: link.type })) }
      : {}),
    ...(plan.frontmatterPatch.svc ? { svc: plan.frontmatterPatch.svc } : parsed.def.svc ? { svc: parsed.def.svc } : {}),
    ...(parsed.def.address ? { address: parsed.def.address } : {}),
  };

  await writeFrontmatterToFile(fullPath, metadata);
}
