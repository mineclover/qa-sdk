import { assessDpmReadiness } from "./dpm.js";
import type {
  CheckedGate,
  DataStructureProfile,
  DiagnosticSeverity,
  ProfileDiagnostic,
  QualityGate,
  ValidateProfileOptions,
  ValidationReport,
} from "./types.js";
import { hasTaxonomyEntry } from "./taxonomy.js";

export function validateProfile(
  profile: DataStructureProfile,
  options: ValidateProfileOptions = {},
): ValidationReport {
  const checkedGates: CheckedGate[] = [];
  const diagnostics: ProfileDiagnostic[] = [
    ...validateTaxonomyRefs(profile, options),
    ...validateLocalGraphRefs(profile),
  ];

  for (const gate of profile.quality_gates) {
    const result = checkGate(profile, gate);
    checkedGates.push(result.checkedGate);
    if (result.diagnostic) {
      diagnostics.push(result.diagnostic);
    }
  }

  const dpmReadiness = assessDpmReadiness(profile);
  if (dpmReadiness.diagnostics.length > 0) {
    checkedGates.push({
      id: "privacy-readiness",
      risk: "pii-leak",
      severity: dpmReadiness.diagnostics[0]?.severity ?? "warning",
      result: dpmReadiness.diagnostics[0]?.severity === "error" ? "fail" : "warn",
      evidence: "privacy.dpm_policy_ref",
    });
    diagnostics.push(...dpmReadiness.diagnostics);
  }

  const summary = {
    errors: diagnostics.filter((diagnostic) => diagnostic.severity === "error").length,
    warnings: diagnostics.filter((diagnostic) => diagnostic.severity === "warning").length,
    infos: diagnostics.filter((diagnostic) => diagnostic.severity === "info").length,
  };

  return {
    kind: "data-structure-profile.validation-report.v1",
    profile: profile.profile,
    status: summary.errors > 0 ? "fail" : summary.warnings > 0 ? "needs-review" : "pass",
    summary,
    checkedGates,
    diagnostics,
  };
}

function validateTaxonomyRefs(
  profile: DataStructureProfile,
  options: ValidateProfileOptions,
): ProfileDiagnostic[] {
  const diagnostics: ProfileDiagnostic[] = [];
  const taxonomy = options.taxonomy;
  if (!taxonomy) return diagnostics;

  addUnknownRefDiagnostic(diagnostics, taxonomy, "data-source-kind", profile.source.kind, "source.kind");

  for (const structure of profile.structures) {
    addUnknownRefDiagnostic(
      diagnostics,
      taxonomy,
      "structure-kind",
      structure.kind,
      `structures.${structure.id}.kind`,
    );
  }

  for (const transform of profile.transforms) {
    addUnknownRefDiagnostic(
      diagnostics,
      taxonomy,
      "transform-kind",
      transform.kind,
      `transforms.${transform.id}.kind`,
    );
  }

  for (const gate of profile.quality_gates) {
    addUnknownRefDiagnostic(
      diagnostics,
      taxonomy,
      "quality-risk",
      gate.risk,
      `quality_gates.${gate.id}.risk`,
    );
  }

  return diagnostics;
}

function validateLocalGraphRefs(profile: DataStructureProfile): ProfileDiagnostic[] {
  const diagnostics: ProfileDiagnostic[] = [];
  const structureIds = new Set(profile.structures.map((structure) => structure.id));
  const localNodeIds = new Set([profile.source.id, ...structureIds]);

  for (const structure of profile.structures) {
    if (structure.parent && !structureIds.has(structure.parent)) {
      diagnostics.push(localRefDiagnostic(`structures.${structure.id}.parent`, structure.parent));
    }
  }

  for (const relationship of profile.relationships) {
    if (!localNodeIds.has(relationship.from)) {
      diagnostics.push(localRefDiagnostic(`relationships.${relationship.id}.from`, relationship.from));
    }
    if (!localNodeIds.has(relationship.to)) {
      diagnostics.push(localRefDiagnostic(`relationships.${relationship.id}.to`, relationship.to));
    }
  }

  for (const transform of profile.transforms) {
    if (!localNodeIds.has(transform.from)) {
      diagnostics.push(localRefDiagnostic(`transforms.${transform.id}.from`, transform.from));
    }
    if (!localNodeIds.has(transform.to)) {
      diagnostics.push(localRefDiagnostic(`transforms.${transform.id}.to`, transform.to));
    }
  }

  return diagnostics;
}

function localRefDiagnostic(target: string, ref: string): ProfileDiagnostic {
  return {
    code: "dsp-profile-ref-unknown",
    severity: "error",
    target,
    message: `Unknown profile-local reference "${ref}".`,
  };
}

function addUnknownRefDiagnostic(
  diagnostics: ProfileDiagnostic[],
  taxonomy: NonNullable<ValidateProfileOptions["taxonomy"]>,
  axisName: string,
  entryId: string,
  target: string,
): void {
  if (hasTaxonomyEntry(taxonomy, axisName, entryId)) return;
  diagnostics.push({
    code: "dsp-taxonomy-ref-unknown",
    severity: "error",
    target,
    message: `Unknown ${axisName} "${entryId}".`,
  });
}

function checkGate(
  profile: DataStructureProfile,
  gate: QualityGate,
): { checkedGate: CheckedGate; diagnostic?: ProfileDiagnostic } {
  switch (gate.risk) {
    case "dedup":
      return profile.source.event_id_path
        ? pass(gate, profile.source.event_id_path)
        : fail(gate, {
            code: "dsp-quality-dedup-key-missing",
            severity: gate.severity,
            target: "source.event_id_path",
            message: "Stream source has no event id path for deduplication.",
          });
    case "replay":
      return profile.source.replay_policy
        ? pass(gate, "source.replay_policy")
        : fail(gate, {
            code: "dsp-quality-replay-policy-missing",
            severity: gate.severity,
            target: "source.replay_policy",
            message: "Stream source has no replay/backfill policy.",
          });
    case "schema-drift":
      return profile.source.schema_ref
        ? pass(gate, profile.source.schema_ref)
        : fail(gate, {
            code: "dsp-quality-schema-ref-missing",
            severity: gate.severity,
            target: "source.schema_ref",
            message: "Stream source has no checked-in schema reference.",
          });
    case "array-explosion":
      return checkArrayExplosion(profile, gate);
    default:
      return pass(gate, gate.evidence?.path ?? gate.id);
  }
}

function checkArrayExplosion(
  profile: DataStructureProfile,
  gate: QualityGate,
): { checkedGate: CheckedGate; diagnostic?: ProfileDiagnostic } {
  const explode = profile.transforms.find((transform) => transform.kind === "explode");
  const maxArrayLength = explode?.semantics?.max_array_length;
  const threshold = gate.threshold?.max_array_length ?? gate.threshold?.max_row_multiplier;

  if (typeof maxArrayLength !== "number") {
    return fail(gate, {
      code: "dsp-transform-unbounded-array",
      severity: gate.severity,
      target: explode ? `transforms.${explode.id}.semantics.max_array_length` : "transforms",
      message: "Explode transform has no max_array_length bound.",
    });
  }

  if (threshold !== undefined && maxArrayLength > threshold) {
    const explodeId = explode?.id ?? "unknown";
    return fail(gate, {
      code: "dsp-transform-array-threshold-exceeded",
      severity: gate.severity,
      target: `transforms.${explodeId}.semantics.max_array_length`,
      message: `Explode transform max_array_length=${maxArrayLength} exceeds threshold=${threshold}.`,
    });
  }

  return pass(gate, `max_array_length=${maxArrayLength}`);
}

function pass(gate: QualityGate, evidence: string): { checkedGate: CheckedGate } {
  return {
    checkedGate: {
      id: gate.id,
      risk: gate.risk,
      severity: gate.severity,
      result: "pass",
      evidence,
    },
  };
}

function fail(
  gate: QualityGate,
  diagnostic: ProfileDiagnostic & { severity: DiagnosticSeverity },
): { checkedGate: CheckedGate; diagnostic: ProfileDiagnostic } {
  return {
    checkedGate: {
      id: gate.id,
      risk: gate.risk,
      severity: gate.severity,
      result: diagnostic.severity === "error" ? "fail" : "warn",
      evidence: diagnostic.target,
    },
    diagnostic,
  };
}
