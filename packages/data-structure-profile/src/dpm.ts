import type {
  DataStructureProfile,
  DiagnosticSeverity,
  DpmReadinessReport,
  ProfileDiagnostic,
  SensitivePath,
} from './types.js';

const MISSING_DPM_MESSAGE = 'Sensitive paths exist but no DPM policy reference is declared.';

export function assessDpmReadiness(profile: DataStructureProfile): DpmReadinessReport {
  const required = profile.privacy?.required ?? false;
  const policyRef = profile.privacy?.dpm_policy_ref ?? null;
  const sensitivePaths = normalizeSensitivePaths(profile.privacy?.sensitive_paths ?? []);
  const diagnostics: ProfileDiagnostic[] = [];

  if (sensitivePaths.length > 0 && !policyRef) {
    diagnostics.push({
      code: 'dsp-privacy-dpm-ref-missing',
      severity: required ? 'error' : 'warning',
      target: 'privacy.dpm_policy_ref',
      message: MISSING_DPM_MESSAGE,
    });
  }

  return {
    kind: 'data-structure-profile.dpm-readiness.v1',
    profile: profile.profile,
    required,
    policyRef,
    sensitivePaths,
    diagnostics,
  };
}

function normalizeSensitivePaths(paths: Array<string | SensitivePath>): SensitivePath[] {
  return paths.map((entry) => {
    if (typeof entry === 'string') {
      return { path: entry, role: 'sensitive' };
    }
    return { path: entry.path, role: entry.role };
  });
}

export function dpmGateSeverity(profile: DataStructureProfile): DiagnosticSeverity {
  return profile.privacy?.required ? 'error' : 'warning';
}
