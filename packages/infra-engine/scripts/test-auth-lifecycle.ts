#!/usr/bin/env pnpm exec tsx
/**
 * AuthN/AuthZ 라이프사이클 테스트
 *
 * enrichment-server의 권한 관리 API를 종합 테스트한다.
 *
 * 테스트 시나리오:
 *  1. 신규 유저 → 기본 viewer role
 *  2. Viewer 권한 체크
 *  3. Role 부여 (operator)
 *  4. Role 상속 확인
 *  5. Admin 승격
 *  6. User Override (deny/grant)
 *  7. 세션 무효화 (perms_v 증가)
 *  8. Explain (권한 추적)
 *  9. Role 제거
 * 10. 유저 비활성화 + 재활성화
 * 11. Bitmask 최종 확인
 *
 * 실행: pnpm exec tsx scripts/test-auth-lifecycle.ts
 * 전제: enrichment server가 localhost:3900에서 실행 중
 */

const API = process.env.ENRICHMENT_URL ?? 'http://localhost:3900';

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<boolean>): Promise<void> {
  try {
    const ok = await fn();
    if (ok) {
      passed++;
      console.log(`  [PASS] ${name}`);
    } else {
      failed++;
      console.log(`  [FAIL] ${name}`);
    }
  } catch (err) {
    failed++;
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`  [FAIL] ${name} -- ${msg}`);
  }
}

async function api<T = Record<string, unknown>>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    signal: AbortSignal.timeout(5_000),
  });
  return res.json() as Promise<T>;
}

async function check(
  userId: string,
  feature: string,
): Promise<{ granted: boolean; reason: string; sources: string[] }> {
  return api('/check', {
    method: 'POST',
    body: JSON.stringify({ userId, domain: 'infra', feature }),
  });
}

async function explain(
  userId: string,
  feature: string,
): Promise<{ granted: boolean; reason: string; sources: string[] }> {
  return api('/explain', {
    method: 'POST',
    body: JSON.stringify({ userId, domain: 'infra', feature }),
  });
}

async function main(): Promise<void> {
  console.log('\n========================================');
  console.log('  AuthN/AuthZ 라이프사이클 테스트');
  console.log('========================================\n');

  const userId = `lifecycle-test-${Date.now()}`;

  // ── 1. 신규 유저 ──────────────────────────────────

  console.log('--- [1] 신규 유저 기본 상태 ---');

  await test('기본 role = viewer (1개)', async () => {
    const u = await api<{ roles: string[] }>(`/users/${userId}`);
    return Array.isArray(u.roles) && u.roles.length === 1 && u.roles[0] === 'viewer';
  });

  await test('perms_v = 1 (초기값)', async () => {
    const u = await api<{ perms_v: number }>(`/users/${userId}`);
    return u.perms_v === 1;
  });

  await test('active = true (초기값)', async () => {
    const u = await api<{ active: boolean }>(`/users/${userId}`);
    return u.active === true;
  });

  // ── 2. Viewer 권한 체크 ───────────────────────────

  console.log('\n--- [2] Viewer 권한 체크 ---');

  await test('ingest_read -> granted (viewer)', async () => {
    const r = await check(userId, 'ingest_read');
    return r.granted === true && r.reason === 'role_grant';
  });

  await test('registry_read -> granted (viewer)', async () => {
    const r = await check(userId, 'registry_read');
    return r.granted === true;
  });

  await test('monitoring_read -> granted (viewer)', async () => {
    const r = await check(userId, 'monitoring_read');
    return r.granted === true;
  });

  await test('ingest_write -> denied (viewer는 write 없음)', async () => {
    const r = await check(userId, 'ingest_write');
    return r.granted === false && r.reason === 'not_assigned';
  });

  await test('deploy_execute -> denied (viewer)', async () => {
    const r = await check(userId, 'deploy_execute');
    return r.granted === false && r.reason === 'not_assigned';
  });

  await test('definition_write -> denied (viewer)', async () => {
    const r = await check(userId, 'definition_write');
    return r.granted === false;
  });

  await test('존재하지 않는 feature -> denied', async () => {
    const r = await check(userId, 'nonexistent_feature');
    return r.granted === false && r.reason === 'not_assigned';
  });

  // ── 3. Role 부여 (operator) ───────────────────────

  console.log('\n--- [3] Role 부여 (operator) ---');

  await test('operator role 부여 성공', async () => {
    const r = await api<{ ok: boolean; roles: string[] }>(`/users/${userId}/grant-role`, {
      method: 'POST',
      body: JSON.stringify({ role: 'operator' }),
    });
    return r.ok === true && r.roles.includes('operator');
  });

  await test('중복 부여해도 roles 중복 안 됨', async () => {
    await api(`/users/${userId}/grant-role`, {
      method: 'POST',
      body: JSON.stringify({ role: 'operator' }),
    });
    const u = await api<{ roles: string[] }>(`/users/${userId}`);
    return u.roles.filter((r: string) => r === 'operator').length === 1;
  });

  await test('ingest_write -> granted (operator 고유)', async () => {
    const r = await check(userId, 'ingest_write');
    return r.granted === true && r.reason === 'role_grant';
  });

  await test('deploy_execute -> granted (operator 고유)', async () => {
    const r = await check(userId, 'deploy_execute');
    return r.granted === true;
  });

  // ── 4. Role 상속 확인 ─────────────────────────────

  console.log('\n--- [4] Role 상속 확인 ---');

  await test('operator는 viewer features도 포함 (registry_read)', async () => {
    const r = await check(userId, 'registry_read');
    return r.granted === true;
  });

  await test('operator는 viewer features도 포함 (gate_read)', async () => {
    const r = await check(userId, 'gate_read');
    return r.granted === true;
  });

  await test('operator는 admin features 불포함 (definition_write)', async () => {
    const r = await check(userId, 'definition_write');
    return r.granted === false;
  });

  await test('operator는 admin features 불포함 (decision_write)', async () => {
    const r = await check(userId, 'decision_write');
    return r.granted === false;
  });

  await test('operator는 admin features 불포함 (ingest_admin)', async () => {
    const r = await check(userId, 'ingest_admin');
    return r.granted === false;
  });

  // ── 5. Admin 승격 ─────────────────────────────────

  console.log('\n--- [5] Admin 승격 ---');

  await test('admin role 부여', async () => {
    const r = await api<{ ok: boolean }>(`/users/${userId}/grant-role`, {
      method: 'POST',
      body: JSON.stringify({ role: 'admin' }),
    });
    return r.ok === true;
  });

  await test('definition_write -> granted (admin)', async () => {
    const r = await check(userId, 'definition_write');
    return r.granted === true;
  });

  await test('decision_write -> granted (admin)', async () => {
    const r = await check(userId, 'decision_write');
    return r.granted === true;
  });

  await test('ingest_admin -> granted (admin)', async () => {
    const r = await check(userId, 'ingest_admin');
    return r.granted === true;
  });

  await test('admin은 전체 13 features 보유', async () => {
    const allFeatures = [
      'ingest_read',
      'ingest_write',
      'registry_read',
      'gate_read',
      'query_read',
      'decode_read',
      'definition_read',
      'definition_write',
      'decision_read',
      'decision_write',
      'deploy_execute',
      'monitoring_read',
      'ingest_admin',
    ];
    for (const f of allFeatures) {
      const r = await check(userId, f);
      if (!r.granted) return false;
    }
    return true;
  });

  // ── 6. User Override ──────────────────────────────

  console.log('\n--- [6] User Override ---');

  await test('deploy_execute deny override 설정', async () => {
    const r = await api<{ ok: boolean }>(`/users/${userId}/override`, {
      method: 'POST',
      body: JSON.stringify({ feature: 'deploy_execute', granted: false }),
    });
    return r.ok === true;
  });

  await test('deploy_execute -> denied (override가 role보다 우선)', async () => {
    const r = await check(userId, 'deploy_execute');
    return r.granted === false && r.reason === 'user_override_deny';
  });

  await test('다른 features는 영향 없음 (ingest_write)', async () => {
    const r = await check(userId, 'ingest_write');
    return r.granted === true && r.reason === 'role_grant';
  });

  await test('다른 features는 영향 없음 (definition_write)', async () => {
    const r = await check(userId, 'definition_write');
    return r.granted === true;
  });

  await test('override를 grant로 변경', async () => {
    await api(`/users/${userId}/override`, {
      method: 'POST',
      body: JSON.stringify({ feature: 'deploy_execute', granted: true }),
    });
    const r = await check(userId, 'deploy_execute');
    return r.granted === true && r.reason === 'user_override_grant';
  });

  await test('override 제거 -> role 기반으로 복구', async () => {
    await api(`/users/${userId}/override/deploy_execute`, { method: 'DELETE' });
    const r = await check(userId, 'deploy_execute');
    return r.granted === true && r.reason === 'role_grant';
  });

  // 존재하지 않는 feature에 grant override -> granted
  await test('미등록 feature에 grant override -> granted', async () => {
    await api(`/users/${userId}/override`, {
      method: 'POST',
      body: JSON.stringify({ feature: 'custom_special', granted: true }),
    });
    const r = await check(userId, 'custom_special');
    return r.granted === true && r.reason === 'user_override_grant';
  });

  // 정리
  await api(`/users/${userId}/override/custom_special`, { method: 'DELETE' });

  // ── 7. 세션 무효화 ───────────────────────────────

  console.log('\n--- [7] 세션 무효화 ---');

  const beforeState = await api<{ perms_v: number }>(`/users/${userId}`);
  const beforeV = beforeState.perms_v;

  await test('세션 무효화 요청 성공', async () => {
    const r = await api<{ ok: boolean; perms_v: number; active: boolean }>(
      `/users/${userId}/invalidate`,
      { method: 'POST' },
    );
    return r.ok === true && r.perms_v > beforeV && r.active === false;
  });

  await test('perms_v 증가 확인', async () => {
    const u = await api<{ perms_v: number }>(`/users/${userId}`);
    return u.perms_v > beforeV;
  });

  await test('active = false 확인', async () => {
    const u = await api<{ active: boolean }>(`/users/${userId}`);
    return u.active === false;
  });

  await test('비활성 상태에서 권한 check -> denied (session_invalidated)', async () => {
    const r = await check(userId, 'ingest_read');
    return r.granted === false && r.reason === 'session_invalidated';
  });

  await test('비활성 상태에서 모든 feature 차단', async () => {
    const r1 = await check(userId, 'definition_write');
    const r2 = await check(userId, 'deploy_execute');
    return r1.granted === false && r2.granted === false;
  });

  // ── 8. Explain (권한 추적) ────────────────────────

  console.log('\n--- [8] 재활성화 + Explain ---');

  await test('재활성화', async () => {
    const r = await api<{ ok: boolean; active: boolean }>(`/users/${userId}/activate`, {
      method: 'POST',
    });
    return r.ok === true && r.active === true;
  });

  await test('explain ingest_write -> admin/operator에서 부여', async () => {
    const r = await explain(userId, 'ingest_write');
    return r.granted === true && r.sources.length > 0;
  });

  await test('explain definition_write -> admin에서만 부여', async () => {
    const r = await explain(userId, 'definition_write');
    return r.granted === true && r.sources.includes('admin');
  });

  await test('explain ingest_read -> viewer 포함 다수 role', async () => {
    const r = await explain(userId, 'ingest_read');
    return r.granted === true && r.sources.length >= 1;
  });

  await test('explain nonexistent -> denied + not_assigned', async () => {
    const r = await explain(userId, 'nonexistent_feature');
    return r.granted === false && r.reason === 'not_assigned';
  });

  // ── 9. Role 제거 ──────────────────────────────────

  console.log('\n--- [9] Role 제거 ---');

  await test('admin role 제거', async () => {
    const r = await api<{ ok: boolean; roles: string[] }>(`/users/${userId}/revoke-role/admin`, {
      method: 'DELETE',
    });
    return r.ok === true && !r.roles.includes('admin');
  });

  await test('definition_write -> denied (admin 제거됨)', async () => {
    const r = await check(userId, 'definition_write');
    return r.granted === false;
  });

  await test('decision_write -> denied (admin 제거됨)', async () => {
    const r = await check(userId, 'decision_write');
    return r.granted === false;
  });

  await test('ingest_admin -> denied (admin 제거됨)', async () => {
    const r = await check(userId, 'ingest_admin');
    return r.granted === false;
  });

  await test('ingest_write -> still granted (operator 유지)', async () => {
    const r = await check(userId, 'ingest_write');
    return r.granted === true;
  });

  await test('deploy_execute -> still granted (operator 유지)', async () => {
    const r = await check(userId, 'deploy_execute');
    return r.granted === true;
  });

  await test('operator role도 제거 -> viewer fallback', async () => {
    const r = await api<{ ok: boolean; roles: string[] }>(`/users/${userId}/revoke-role/operator`, {
      method: 'DELETE',
    });
    // viewer만 남거나, 빈 경우 viewer가 자동 추가됨
    return r.ok === true;
  });

  await test('ingest_write -> denied (viewer만 남음)', async () => {
    const r = await check(userId, 'ingest_write');
    return r.granted === false;
  });

  await test('ingest_read -> granted (viewer 유지)', async () => {
    const r = await check(userId, 'ingest_read');
    return r.granted === true;
  });

  // ── 10. 유저 비활성화 + 재활성화 ──────────────────

  console.log('\n--- [10] 유저 비활성화 + 재활성화 ---');

  await test('유저 비활성화', async () => {
    const r = await api<{ ok: boolean; active: boolean }>(`/users/${userId}/invalidate`, {
      method: 'POST',
    });
    return r.ok === true && r.active === false;
  });

  await test('비활성 유저 enrich -> perms_v 변경됨', async () => {
    const r = await api<{ perms_v: number }>('/enrich', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
    return r.perms_v > 1;
  });

  await test('재활성화 후 check 정상 동작', async () => {
    await api(`/users/${userId}/activate`, { method: 'POST' });
    const r = await check(userId, 'ingest_read');
    return r.granted === true;
  });

  // ── 11. Bitmask 최종 확인 ─────────────────────────

  console.log('\n--- [11] Bitmask 최종 확인 ---');

  await test('enrich -> viewer bitmask 생성', async () => {
    const r = await api<{ perms: { infra: string }; perms_v: number }>('/enrich', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
    return typeof r.perms?.infra === 'string' && r.perms.infra.length > 0;
  });

  // operator 부여 후 bitmask 변경 확인
  await api(`/users/${userId}/grant-role`, {
    method: 'POST',
    body: JSON.stringify({ role: 'operator' }),
  });

  await test('operator 부여 후 bitmask에 ingest_write 비트 포함', async () => {
    const r = await api<{ perms: { infra: string } }>('/enrich', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
    // ingest_write = bit 1
    const bytes = Buffer.from(r.perms.infra, 'base64');
    return (bytes[0] & (1 << 1)) !== 0;
  });

  await test('features API 정상 응답', async () => {
    const r = await api<{ features: string[]; roleDefs: Record<string, unknown> }>('/features');
    return Array.isArray(r.features) && r.features.length >= 12 && r.roleDefs != null;
  });

  await test('health API 정상', async () => {
    const r = await api<{ status: string }>('/health');
    return r.status === 'ok';
  });

  // ── 결과 ──────────────────────────────────────────

  console.log('\n========================================');
  console.log(`  결과: ${passed} passed, ${failed} failed (총 ${passed + failed}건)`);
  console.log('========================================\n');

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('테스트 실행 실패:', err);
  process.exit(1);
});
