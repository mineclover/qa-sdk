#!/usr/bin/env pnpm exec tsx
/**
 * Zitadel Action 등록 + Flow 연결 + Metadata 동기화.
 *
 * 1. Action v1 스크립트 등록 (metadata → id_token claims 복사)
 * 2. Flow 2 (CustomiseToken)에 Action 연결:
 *    - Trigger 4: Pre Userinfo creation
 *    - Trigger 5: Pre Access token creation
 * 3. Machine user에 perms metadata 일괄 저장 (_bulk POST)
 * 4. 검증: metadata 재조회 + flow 상태 확인
 *
 * 사전 조건:
 * - Zitadel 실행 중 (localhost:8085)
 * - /tmp/zitadel-token.txt (admin PAT)
 * - /tmp/zitadel-machinekey.json (machine user key)
 *
 * 실행:
 *   pnpm exec tsx packages/infra-engine/scripts/setup-zitadel-action.ts
 */

import { readFile } from 'node:fs/promises';
import { createBitmask, FEATURES } from '../src/auth/enrichment-server.js';

const ZITADEL = process.env.ZITADEL_URL ?? 'http://localhost:8085';

async function main() {
  // PAT 로드
  let token: string;
  try {
    token = (await readFile('/tmp/zitadel-token.txt', 'utf-8')).trim();
  } catch {
    console.error('[error] /tmp/zitadel-token.txt 없음. Zitadel admin PAT를 먼저 생성하세요.');
    process.exit(1);
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  // ── 1. Action 등록 또는 기존 Action 조회 ──────────────

  console.log('[1] Zitadel Action 등록/조회');
  let actionId: string | null = null;

  // 기존 Action 검색
  try {
    const searchResp = await fetch(`${ZITADEL}/management/v1/actions/_search`, {
      method: 'POST',
      headers,
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(5_000),
    });
    if (searchResp.ok) {
      const data = (await searchResp.json()) as {
        result?: Array<{ id: string; name: string; state: string }>;
      };
      const existing = data.result?.find((a) => a.name === 'qa-enrich-perms');
      if (existing) {
        actionId = existing.id;
        console.log(`  기존 Action 발견: ${actionId} (${existing.state})`);
      }
    }
  } catch (err) {
    console.log(`  Action 검색 실패: ${err instanceof Error ? err.message : err}`);
  }

  // 없으면 새로 생성
  if (!actionId) {
    // v1 action: metadata에 저장된 perms를 id_token claims에 복사
    const actionScript = `
function enrich(ctx, api) {
  var metadata = ctx.user.metadata;
  if (metadata && metadata.perms) {
    api.v1.claims.setClaim('perms', JSON.parse(metadata.perms));
    api.v1.claims.setClaim('perms_v', parseInt(metadata.perms_v || '1'));
    api.v1.claims.setClaim('perms_schema', metadata.perms_schema || 'qa-v1');
  }
}
`;

    try {
      const actionResp = await fetch(`${ZITADEL}/management/v1/actions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: 'qa-enrich-perms',
          script: actionScript,
          timeout: '5s',
          allowedToFail: true,
        }),
        signal: AbortSignal.timeout(5_000),
      });

      if (actionResp.ok) {
        const action = (await actionResp.json()) as { id: string };
        actionId = action.id;
        console.log(`  Action 생성: ${actionId}`);
      } else {
        const errText = await actionResp.text();
        console.log(`  Action 생성 실패: ${errText}`);
      }
    } catch (err) {
      console.log(`  Action 생성 실패: ${err instanceof Error ? err.message : err}`);
    }
  }

  // ── 2. Flow 2 (CustomiseToken)에 Action 연결 ──────────

  console.log('\n[2] Flow 연결 (CustomiseToken)');
  let flowLinked = false;

  if (actionId) {
    // Flow 2 trigger types:
    //   4 = Pre Userinfo creation
    //   5 = Pre Access token creation
    // API: POST /management/v1/flows/{flowType}/trigger/{triggerType} body: {"actionIds":[...]}
    const triggerTypes = [
      { id: 4, label: 'Pre Userinfo creation' },
      { id: 5, label: 'Pre Access token creation' },
    ];

    for (const trigger of triggerTypes) {
      try {
        const resp = await fetch(`${ZITADEL}/management/v1/flows/2/trigger/${trigger.id}`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ actionIds: [actionId] }),
          signal: AbortSignal.timeout(5_000),
        });
        if (resp.ok) {
          console.log(`  Trigger ${trigger.id} (${trigger.label}): OK`);
          flowLinked = true;
        } else {
          // code 9 = "No Changes" — 이미 연결됨 (성공으로 취급)
          const body = (await resp.json().catch(() => null)) as { code?: number } | null;
          if (body?.code === 9) {
            console.log(`  Trigger ${trigger.id} (${trigger.label}): OK (이미 연결됨)`);
            flowLinked = true;
          } else {
            console.log(`  Trigger ${trigger.id} (${trigger.label}): FAIL (${resp.status})`);
          }
        }
      } catch (err) {
        console.log(`  Trigger ${trigger.id}: FAIL (${err instanceof Error ? err.message : err})`);
      }
    }
  } else {
    console.log('  Action 미등록 -- flow 연결 건너뜀');
  }

  // ── 3. Machine user metadata 일괄 저장 (_bulk) ────────

  console.log('\n[3] Machine user metadata 저장 (_bulk)');

  let userId: string;
  try {
    const machineKey = JSON.parse(await readFile('/tmp/zitadel-machinekey.json', 'utf-8')) as {
      userId: string;
    };
    userId = machineKey.userId;
    console.log(`  userId: ${userId}`);
  } catch {
    console.error('[error] /tmp/zitadel-machinekey.json 없음.');
    console.log('  metadata 저장 건너뜀. gateway metadata fallback만 사용됩니다.');
    printSummary(!!actionId, flowLinked);
    return;
  }

  // admin role: 전체 feature bitmask
  const allFeatures = [...FEATURES] as const;
  const adminBitmask = createBitmask(allFeatures);
  const permsValue = JSON.stringify({ infra: adminBitmask });

  try {
    const bulkResp = await fetch(`${ZITADEL}/management/v1/users/${userId}/metadata/_bulk`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        metadata: [
          { key: 'perms', value: Buffer.from(permsValue).toString('base64') },
          { key: 'perms_v', value: Buffer.from('1').toString('base64') },
          { key: 'perms_schema', value: Buffer.from('qa-v1').toString('base64') },
        ],
      }),
      signal: AbortSignal.timeout(5_000),
    });
    console.log(`  _bulk POST: ${bulkResp.ok ? 'OK' : `FAIL (${bulkResp.status})`}`);
  } catch (err) {
    console.log(`  _bulk POST: FAIL (${err instanceof Error ? err.message : err})`);
  }

  // ── 4. 검증 ──────────────────────────────────────────

  console.log('\n[4] 검증');

  // 4a. Metadata 재조회
  console.log('  [metadata]');
  try {
    const metaResp = await fetch(`${ZITADEL}/management/v1/users/${userId}/metadata/_search`, {
      method: 'POST',
      headers,
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(5_000),
    });
    if (metaResp.ok) {
      const meta = (await metaResp.json()) as { result?: Array<{ key: string; value: string }> };
      for (const m of meta.result ?? []) {
        const val = Buffer.from(m.value, 'base64').toString();
        console.log(`    ${m.key} = ${val}`);
      }
    } else {
      console.log(`    검색 실패: ${metaResp.status}`);
    }
  } catch (err) {
    console.log(`    검색 실패: ${err instanceof Error ? err.message : err}`);
  }

  // 4b. Flow 상태 확인
  console.log('  [flow]');
  try {
    const flowResp = await fetch(`${ZITADEL}/management/v1/flows/2`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5_000),
    });
    if (flowResp.ok) {
      const flow = (await flowResp.json()) as {
        flow: {
          state: string;
          triggerActions?: Array<{
            triggerType: { id: string; name: { localizedMessage: string } };
            actions: Array<{ name: string }>;
          }>;
        };
      };
      console.log(`    state: ${flow.flow.state}`);
      for (const ta of flow.flow.triggerActions ?? []) {
        const names = ta.actions.map((a) => a.name).join(', ');
        console.log(
          `    trigger ${ta.triggerType.id} (${ta.triggerType.name.localizedMessage}): [${names}]`,
        );
      }
    } else {
      console.log(`    flow 조회 실패: ${flowResp.status}`);
    }
  } catch (err) {
    console.log(`    flow 조회 실패: ${err instanceof Error ? err.message : err}`);
  }

  printSummary(!!actionId, flowLinked);
}

function printSummary(actionRegistered: boolean, flowLinked: boolean): void {
  console.log('\n=== 완료 ===');
  if (actionRegistered && flowLinked) {
    console.log('Zitadel Action + Flow 연결 완료 -- id_token에 perms claims 자동 주입됩니다.');
  } else if (actionRegistered) {
    console.log('Action 등록됨, Flow 연결 실패 -- metadata fallback 사용.');
    console.log('gateway에서 id_token에 perms가 없으면 Zitadel metadata를 조회합니다.');
    console.log('(ZITADEL_URL + ZITADEL_SERVICE_TOKEN 환경변수 필요)');
  } else {
    console.log('Action 미등록 -- enrichment 서버 또는 metadata fallback만 사용.');
    console.log('(ENRICHMENT_URL 또는 ZITADEL_URL + ZITADEL_SERVICE_TOKEN 필요)');
  }
}

main().catch(console.error);
