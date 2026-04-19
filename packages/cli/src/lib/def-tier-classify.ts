import { readFile, writeFile } from "node:fs/promises";
import { resolve, relative, join } from "node:path";
import type { DefinitionEntry, LinkType } from "definition-catalog";
import type { DefDataSource } from "../data-sources/data-source.js";

interface DocSignature {
  path: string;
  type?: string;
  level?: "group" | "module" | "leaf";
  scope?: string;
  aspect?: string;
  depth?: string;
  contains?: string[];
  depends_on?: string[];
  implements?: string[];
  refines?: string[];
  hasOperations: boolean;
  hasStateList: boolean;
  hasSchemaDef: boolean;
  hasEvidenceShape: boolean;
  childLevels: ("group" | "module" | "leaf")[];
}

export interface ClassificationSuggestion {
  type: "design" | "knowledge";
  tier?: "component" | "entry" | "system" | "layout" | "exempt";
  component_subtype?: "data-shape" | "state-enum" | "evidence-shape" | "data-facet-role" | "validation-rule" | "constant-literal";
  confidence: "high" | "medium" | "low";
  reason: string;
  warnings?: string[];
  needs_review: boolean;
}

export async function classifyTier(
  source: DefDataSource,
  docId: string,
  entry: DefinitionEntry,
  allEntries: DefinitionEntry[],
  links: { targetId: string; linkType: LinkType }[]
): Promise<ClassificationSuggestion> {
  const relPath = entry.ref || "";

  // Step 0 - Exempt (D-2 Extended)
  const exemptPatterns = [
    /^(CLAUDE|AGENTS|GEMINI|README|AGENT)\.md$/,
    /^docs\/[^/]+\.md$/, // docs/ top-level
    /^docs\/skills\/.*/,
    /^skills\/.*/,
    /^tasks\/.*/,
    /^\.claude\/.*/
  ];
  
  if (exemptPatterns.some(p => p.test(relPath))) {
    return {
      type: "knowledge",
      tier: "exempt",
      confidence: "high",
      reason: "STEP0-knowledge-or-exempt",
      needs_review: false
    };
  }

  // Basic structure
  let docType: "design" | "knowledge" = "design";
  if (entry.type === "knowledge") docType = "knowledge";

  if (docType === "knowledge") {
    return {
      type: "knowledge",
      tier: "exempt",
      confidence: "high",
      reason: "STEP0-knowledge-type",
      needs_review: false
    };
  }

  // Parse file to get AST hints
  let hasOperations = false;
  let hasStateList = false;
  let hasSchemaDef = false;
  let hasEvidenceShape = false;

  try {
    const content = await readFile(resolve(process.cwd(), relPath), "utf8");
    // Heuristic parsing
    if (content.includes("function ") || content.includes("class ") || content.includes("operations:")) {
      hasOperations = true;
    }
    if (content.includes("states:") || content.match(/상태 목록/)) {
      hasStateList = true;
    }
    if (content.includes("interface ") || content.includes("type ") || content.includes("schema:")) {
      hasSchemaDef = true;
    }
    if (content.match(/Evidence/) || relPath.includes("readiness")) {
      hasEvidenceShape = true;
    }
  } catch (e) {}

  const containsTargets = links.filter(l => l.linkType === "contains").map(l => l.targetId);
  const childLevels = containsTargets
    .map(id => allEntries.find(e => e.id === id)?.level || "leaf");

  // Step 2 - Layout
  if (entry.level === "group" || entry.depth === "overview") {
    if (containsTargets.length >= 2 && childLevels.filter(l => l === "module").length >= 2 && !hasOperations) {
      return {
        type: "design",
        tier: "layout",
        confidence: "high",
        reason: "STEP2-layout-group-with-modules",
        needs_review: false
      };
    }
  }

  // Step 3 - System
  let systemScore = 0;
  if (relPath.endsWith("-system.md") || (entry.id && entry.id.endsWith("-system"))) systemScore += 1;
  if (hasOperations) systemScore += 1;
  if (hasStateList || entry.lifecycleRef) systemScore += 1;

  const warnings: string[] = [];
  if (systemScore >= 2) {
    if (childLevels.includes("module")) {
      warnings.push("CON-VIOLATION-system-contains-system");
    }
    return {
      type: "design",
      tier: "system",
      confidence: "high",
      reason: "STEP3-R7-3check",
      warnings: warnings.length > 0 ? warnings : undefined,
      needs_review: false
    };
  }

  // Step 4 - Component
  if (hasSchemaDef || hasStateList || hasEvidenceShape || entry.level === "leaf") {
    let subtype: any = "data-shape";
    let conf: any = "high";
    if (hasStateList && !hasSchemaDef && !hasOperations) {
      subtype = "state-enum";
    } else if (hasEvidenceShape && entry.id && (entry.id.includes("evidence") || entry.id.includes("readiness"))) {
      subtype = "evidence-shape";
    } else if (entry.aspect && ["production", "consumption"].includes(entry.aspect)) {
      subtype = "data-facet-role";
    } else if (hasSchemaDef && entry.id && entry.id.includes("rule")) {
      subtype = "validation-rule";
      conf = "medium";
    } else if (entry.id && entry.id.includes("constant")) {
      subtype = "constant-literal";
      conf = "medium";
    } else if (hasSchemaDef) {
      subtype = "data-shape";
    } else {
      subtype = "data-shape";
      conf = "medium";
    }

    return {
      type: "design",
      tier: "component",
      component_subtype: subtype,
      confidence: conf,
      reason: "STEP4-component-rules",
      needs_review: conf === "medium"
    };
  }

  return {
    type: "design",
    tier: undefined,
    confidence: "low",
    reason: "STEP6-no-rule-matched",
    needs_review: true
  };
}
