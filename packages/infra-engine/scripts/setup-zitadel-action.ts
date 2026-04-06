#!/usr/bin/env pnpm exec tsx
/**
 * Zitadel Action 등록 -- id_token에 permission bitmask 주입.
 *
 * 사전 조건:
 * - Zitadel 실행 중 (localhost:8085)
 * - enrichment server 실행 중 (localhost:3900)
 * - /tmp/zitadel-token.txt (admin PAT)
 * - /tmp/zitadel-machinekey.json (machine user key)
 *
 * 실행:
 *   pnpm exec tsx packages/infra-engine/scripts/setup-zitadel-action.ts
 */

import { readFile } from "node:fs/promises";
import { createBitmask, FEATURES } from "../src/auth/enrichment-server.js";

const ZITADEL = process.env.ZITADEL_URL ?? "http://localhost:8085";
const ENRICHMENT = process.env.ENRICHMENT_URL ?? "http://localhost:3900";

async function main() {
  // PAT 로드
  let token: string;
  try {
    token = (await readFile("/tmp/zitadel-token.txt", "utf-8")).trim();
  } catch {
    console.error("[error] /tmp/zitadel-token.txt 없음. Zitadel admin PAT를 먼저 생성하세요.");
    process.exit(1);
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  // 1. Zitadel Action v2 Target 생성 시도
  console.log("[1] Zitadel Action Target 생성 시도");
  let actionRegistered = false;

  try {
    const targetResp = await fetch(`${ZITADEL}/management/v1/actions/v2/targets`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: "qa-permission-enrichment",
        restWebhook: { interruptOnError: false },
        endpoint: `${ENRICHMENT}/enrich`,
        timeout: "5s",
      }),
      signal: AbortSignal.timeout(5_000),
    });

    if (targetResp.ok) {
      const target = await targetResp.json() as { id: string };
      console.log(`  Target 생성: ${target.id}`);
      actionRegistered = true;
    } else {
      console.log(`  v2 Target API 미지원 (${targetResp.status})`);
    }
  } catch (err) {
    console.log(`  v2 API 호출 실패: ${err instanceof Error ? err.message : err}`);
  }

  // v2 실패 시 v1 Action 스크립트 등록 시도
  if (!actionRegistered) {
    console.log("  Zitadel Actions v1으로 시도...");

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
        method: "POST",
        headers,
        body: JSON.stringify({
          name: "qa-enrich-perms",
          script: actionScript,
          timeout: "5s",
          allowedToFail: true,
        }),
        signal: AbortSignal.timeout(5_000),
      });

      if (actionResp.ok) {
        const action = await actionResp.json() as { id: string };
        console.log(`  Action 생성: ${action.id}`);

        // Flow 2 (complement token), Trigger 4 (pre access token creation) 에 연결
        const flowResp = await fetch(
          `${ZITADEL}/management/v1/flows/2/trigger/4/action/${action.id}`,
          { method: "POST", headers, signal: AbortSignal.timeout(5_000) },
        );
        console.log(`  Flow 연결: ${flowResp.ok ? "성공" : "실패"}`);
        if (flowResp.ok) actionRegistered = true;
      } else {
        const err = await actionResp.text();
        console.log(`  Action 생성 실패: ${err}`);
      }
    } catch (err) {
      console.log(`  v1 API 호출 실패: ${err instanceof Error ? err.message : err}`);
    }
  }

  if (!actionRegistered) {
    console.log("  Action 미등록 -- gateway metadata fallback 사용");
  }

  // 2. Machine user에 metadata로 perms 저장
  console.log("\n[2] Machine user metadata에 perms 저장");

  let userId: string;
  try {
    const machineKey = JSON.parse(
      await readFile("/tmp/zitadel-machinekey.json", "utf-8"),
    ) as { userId: string };
    userId = machineKey.userId;
    console.log(`  userId: ${userId}`);
  } catch {
    console.error("[error] /tmp/zitadel-machinekey.json 없음.");
    console.log("  metadata 저장 건너뜀. gateway metadata fallback만 사용됩니다.");
    printSummary(actionRegistered);
    return;
  }

  // admin role: 전체 feature bitmask
  const allFeatures = [...FEATURES] as const;
  const adminBitmask = createBitmask(allFeatures);
  const permsValue = JSON.stringify({ infra: adminBitmask });

  const metadataEntries = [
    { key: "perms", value: Buffer.from(permsValue).toString("base64") },
    { key: "perms_v", value: Buffer.from("1").toString("base64") },
    { key: "perms_schema", value: Buffer.from("qa-v1").toString("base64") },
  ];

  for (const entry of metadataEntries) {
    try {
      const resp = await fetch(
        `${ZITADEL}/management/v1/users/${userId}/metadata/${entry.key}`,
        {
          method: "PUT",
          headers,
          body: JSON.stringify({ value: entry.value }),
          signal: AbortSignal.timeout(5_000),
        },
      );
      const label = resp.ok ? "OK" : `FAIL (${resp.status})`;
      console.log(`  ${entry.key}: ${label}`);
    } catch (err) {
      console.log(`  ${entry.key}: FAIL (${err instanceof Error ? err.message : err})`);
    }
  }

  // 3. 확인
  console.log("\n[3] Metadata 확인");
  try {
    const metaResp = await fetch(
      `${ZITADEL}/management/v1/users/${userId}/metadata/_search`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({}),
        signal: AbortSignal.timeout(5_000),
      },
    );
    if (metaResp.ok) {
      const meta = await metaResp.json() as { result?: Array<{ key: string; value: string }> };
      for (const m of meta.result ?? []) {
        const val = Buffer.from(m.value, "base64").toString();
        console.log(`  ${m.key} = ${val}`);
      }
    } else {
      console.log(`  검색 실패: ${metaResp.status}`);
    }
  } catch (err) {
    console.log(`  검색 실패: ${err instanceof Error ? err.message : err}`);
  }

  printSummary(actionRegistered);
}

function printSummary(actionRegistered: boolean): void {
  console.log("\n=== 완료 ===");
  if (actionRegistered) {
    console.log("Zitadel Action 활성 -- id_token에 perms claims 자동 주입됩니다.");
  } else {
    console.log("Zitadel Action 미등록 -- metadata 기반.");
    console.log("gateway에서 id_token에 perms가 없으면 Zitadel metadata를 조회합니다.");
    console.log("(ZITADEL_URL + ZITADEL_SERVICE_TOKEN 환경변수 필요)");
  }
}

main().catch(console.error);
