// scripts/break-glass-shared/audit-recorder-client.ts
// spec 05 §2: 4개 break-glass 명령(abort/force-promote/controller stop/replica pin)이
// audit-recorder에 같은 grammar의 decisionId로 기록되어야 한다는 SSOT.
// 본 모듈만 audit-recorder write를 수행하며, 두 CLI(sim-canary, sim-scale)는 본 모듈만 호출한다.
//
// 운영자 행동은 1회성, retry 없음. 실패 시 throw → 호출자가 exit 1.

export interface OperatorActionRecord {
  decisionId: string;
  operatorAction: true;
  actor: string;
  forcedBy?: string;
  command: string;
  service: string;
  prefix?: string;
  action?: Record<string, unknown>;
  transitions?: ReadonlyArray<Record<string, unknown>>;
  holdUntil?: string;
  reason: string;
}

export async function recordOperatorAction(
  auditUrl: string,
  record: OperatorActionRecord,
): Promise<void> {
  const body = {
    ...record,
    recordedAt: new Date().toISOString(),
    evidence: [
      {
        kind: 'external',
        source: 'break-glass-cli',
        content: { command: record.command, reason: record.reason },
      },
    ],
  };
  const res = await fetch(`${auditUrl}/operator-actions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(5_000),
  });
  if (!res.ok) {
    throw new Error(`audit-recorder write failed: ${res.status}`);
  }
}
