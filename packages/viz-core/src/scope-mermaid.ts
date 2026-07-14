// @def.boundary viz-system-root
// @def.doc viz-system-root

/**
 * Scope Nesting → Mermaid 다이어그램 변환
 *
 * 3가지 뷰:
 * 1. nestingToMermaid — scope 계층 + 계약 하향 경로
 * 2. mountSnapshotToMermaid — depth별 활성 계약 타임라인
 * 3. timingToMermaid — readiness + delegation gap 시뮬 오버레이
 */

import type { ScopeNesting, NestingValidation, DescentPath } from '@qa-sdk/core';
import type { MountSnapshot } from '@qa-sdk/core';
import type { TimingValidation, ReadinessEntry, DelegationGap } from '@qa-sdk/core';

// ── 1. nestingToMermaid ──────────────────────────────

/**
 * ScopeNesting + 검증 결과 → Mermaid flowchart.
 * scope를 노드, 계약 하향을 엣지로 표현.
 */
export function nestingToMermaid(nesting: ScopeNesting, validation?: NestingValidation): string {
  const lines: string[] = ['flowchart TB'];
  const { scopes } = nesting;

  // scope 노드 선언
  for (let i = 0; i < scopes.length; i++) {
    const s = scopes[i];
    const provides = s.provides.map((c) => c.contractId).join(', ');
    const consumes = s.consumes
      .map((c) => {
        const opt = c.required === false ? '?' : '';
        return c.contractId + opt;
      })
      .join(', ');

    const label = provides
      ? `${s.scopeId}\\nprovides: ${provides}${consumes ? '\\nconsumes: ' + consumes : ''}`
      : `${s.scopeId}${consumes ? '\\nconsumes: ' + consumes : ''}`;

    lines.push(`  ${safe(s.scopeId)}["${label}"]`);
  }

  lines.push('');

  // nesting 순서 (점선)
  for (let i = 0; i < scopes.length - 1; i++) {
    lines.push(
      `  ${safe(scopes[i].scopeId)} -.->|depth ${i}→${i + 1}| ${safe(scopes[i + 1].scopeId)}`,
    );
  }

  // 계약 하향 경로 (실선)
  if (validation) {
    lines.push('');
    for (const path of validation.descentPaths) {
      for (const consumer of path.consumedBy) {
        lines.push(`  ${safe(path.providedBy)} -->|${path.contractId}| ${safe(consumer)}`);
      }
    }

    // 에러 노드 스타일
    const errorScopes = new Set(
      validation.issues.filter((i) => i.severity === 'error').map((i) => i.scopeId),
    );
    if (errorScopes.size > 0) {
      lines.push('');
      for (const scopeId of errorScopes) {
        lines.push(`  style ${safe(scopeId)} fill:#fdd,stroke:#c00`);
      }
    }
  }

  return lines.join('\n');
}

// ── 2. mountSnapshotToMermaid ────────────────────────

/**
 * MountSnapshot[] → Mermaid gantt chart.
 * depth별 활성 계약을 타임라인으로 표현.
 */
export function mountSnapshotToMermaid(snapshots: MountSnapshot[]): string {
  const lines: string[] = [
    'gantt',
    '  title Mount Flow — 활성 계약 타임라인',
    '  dateFormat X',
    '  axisFormat %s',
  ];

  for (const snap of snapshots) {
    lines.push(`  section ${snap.scopeId} (depth ${snap.depth})`);
    for (const contract of snap.activeContracts) {
      // 해당 depth에서 새로 추가된 계약인지 확인
      const prevContracts = snap.depth > 0 ? snapshots[snap.depth - 1].activeContracts : [];
      const isNew = !prevContracts.includes(contract);
      const marker = isNew ? '' : 'done, ';
      lines.push(
        `    ${contract} :${marker}d${snap.depth}_${safe(contract)}, ${snap.depth}, ${snap.depth + 1}`,
      );
    }
    if (snap.pipes.length > 0) {
      lines.push(
        `    pipes: ${snap.pipes.join(', ')} :milestone, m${snap.depth}, ${snap.depth}, ${snap.depth}`,
      );
    }
  }

  return lines.join('\n');
}

// ── 3. timingToMermaid ───────────────────────────────

/**
 * TimingValidation → Mermaid gantt chart.
 * readiness + delegation gap을 시뮬 타임라인에 오버레이.
 */
export function timingToMermaid(timing: TimingValidation, totalSteps: number): string {
  const lines: string[] = [
    'gantt',
    '  title Contract Timing — readiness + delegation gaps',
    '  dateFormat X',
    '  axisFormat %s',
  ];

  // readiness 섹션
  lines.push('  section Readiness');
  for (const entry of timing.readinessTimeline) {
    if (entry.readyAtStep < 0) {
      lines.push(
        `    ${entry.contractId} (즉시) :done, r_${safe(entry.contractId)}, 0, ${totalSteps}`,
      );
    } else {
      lines.push(
        `    ${entry.contractId} (pending) :crit, r_${safe(entry.contractId)}_pending, 0, ${entry.readyAtStep}`,
      );
      lines.push(
        `    ${entry.contractId} (ready) :done, r_${safe(entry.contractId)}_ready, ${entry.readyAtStep}, ${totalSteps}`,
      );
    }
  }

  // delegation gap 섹션
  if (timing.delegationGaps.length > 0) {
    lines.push('  section Delegation Gaps');
    for (const gap of timing.delegationGaps) {
      const consumers = gap.staleConsumers.join(', ');
      lines.push(
        `    ${gap.contractId} gap (${consumers}) :crit, g_${safe(gap.contractId)}, ${gap.gapStartStep}, ${gap.gapEndStep}`,
      );
    }
  }

  // issues 섹션
  const errors = timing.issues.filter((i) => i.severity === 'error');
  if (errors.length > 0) {
    lines.push('  section Errors');
    for (let i = 0; i < errors.length; i++) {
      const err = errors[i];
      lines.push(`    ${err.code}: ${err.contractId} :crit, e${i}, 0, 1`);
    }
  }

  return lines.join('\n');
}

// ── 유틸 ─────────────────────────────────────────────

function safe(id: string): string {
  return id.replace(/[^a-zA-Z0-9_]/g, '_');
}
