# Plan 04d — infra-engine env export에 PG 변수 통합

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `infra-engine`의 `infra export env` 명령이 SERVICE_PORTS의 PG entry(`zitadel-postgres`, `qa-sdk-postgres`)와 도메인별 비밀번호를 `.env` 파일로 자동 생성. Plan 04c의 `dbEnvSchema`(`QA_PG_HOST`, `QA_PG_PORT`, `QA_PG_DATABASE`, `QA_PG_USER`, `QA_PG_PASSWORD`)와 1:1 일치.

**Architecture:** `infra-engine/src/export/`의 기존 env export 로직 확장. SERVICE_PORTS scan + PG-specific env builder 추가. 비밀번호는 `.env.docker`(sops)에서 read.

**Tech Stack:** TypeScript, infra-engine 내부 모듈. 신규 의존 없음.

---

## File Structure

### 수정하는 파일

| 경로 | 변경 |
|---|---|
| `packages/infra-engine/src/export/env.ts` (또는 동등 위치) | PG 변수 export 로직 추가 |
| `packages/infra-engine/src/cli/commands/export.ts` (또는 동등) | `--include-pg` 또는 기본 활성 |
| `packages/infra-engine/scripts/export.ts` | 호출 옵션 갱신 |

### 새로 만드는 파일

| 경로 | 책임 |
|---|---|
| `packages/infra-engine/src/export/pg-env-builder.ts` | SERVICE_PORTS + .env.docker → PG 변수 dict |
| `packages/infra-engine/src/export/pg-env-builder.test.ts` | 단위 테스트 |

---

## Task 0: baseline + 현재 export 구조 파악

- [ ] **Step 1: 현재 infra export env 동작 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter infra-engine build && node packages/infra-engine/scripts/export.ts --help 2>&1 | head -20
```

기록: 현재 옵션 + 출력 형식. PG 변수가 이미 있는지도 확인.

- [ ] **Step 2: 기존 export 모듈 위치 파악**

```bash
cd /Users/junwoobang/workflow/qa-sdk && ls packages/infra-engine/src/export/ packages/infra-engine/src/commands/ 2>&1 | head -20
```

기록: 정확한 파일명. 본 plan의 File Structure 표는 발견된 실제 경로로 갱신.

- [ ] **Step 3: Plan 04a (qa-sdk-db init) + 04b (SERVICE_PORTS) + 04c (db-bootstrap) 완료 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk && grep -q "qa-sdk-postgres" packages/core/src/lib/service-ports.ts && ls packages/db-bootstrap/dist 2>&1 | head -3
```

Expected: SERVICE_PORTS에 등록 + db-bootstrap build 결과 존재. 미완료 시 본 plan 시작 금지.

---

## Task 1: pg-env-builder 모듈 — 단위

**Files:**
- Create: `packages/infra-engine/src/export/pg-env-builder.ts`
- Create: `packages/infra-engine/src/export/pg-env-builder.test.ts`

- [ ] **Step 1: 테스트 작성**

`packages/infra-engine/src/export/pg-env-builder.test.ts`:

```ts
// @def.boundary infra-engine
// @def.doc infra-engine

import { describe, it, expect } from "vitest";
import { buildPgEnvVars, type PgEnvBuilderInput } from "./pg-env-builder.js";

describe("buildPgEnvVars", () => {
  const SECRETS: Record<string, string> = {
    QA_SDK_AUTH_PASSWORD: "auth-pw",
    QA_SDK_AUDIT_PASSWORD: "audit-pw",
    QA_SDK_INGEST_PASSWORD: "ingest-pw",
    QA_SDK_DECISION_PASSWORD: "decision-pw",
    QA_SDK_DEFINITION_PASSWORD: "definition-pw",
    QA_SDK_ADMIN_PASSWORD: "admin-pw",
  };

  it("auth 도메인 서비스 — auth_app role + auth schema", () => {
    const input: PgEnvBuilderInput = { domain: "auth", host: "localhost", secrets: SECRETS };
    const env = buildPgEnvVars(input);
    expect(env).toMatchObject({
      QA_DB_DIALECT: "pg",
      QA_PG_HOST: "localhost",
      QA_PG_PORT: "5434",
      QA_PG_DATABASE: "qa_sdk",
      QA_PG_USER: "auth_app",
      QA_PG_PASSWORD: "auth-pw",
      QA_PG_SCHEMA: "auth",
    });
  });

  it("admin 도메인 — qa_admin role + 모든 schema 접근 (search_path 미지정)", () => {
    const env = buildPgEnvVars({ domain: "admin", host: "localhost", secrets: SECRETS });
    expect(env.QA_PG_USER).toBe("qa_admin");
    expect(env.QA_PG_PASSWORD).toBe("admin-pw");
    expect(env.QA_PG_SCHEMA).toBeUndefined();
  });

  it("알 수 없는 도메인 → 에러", () => {
    expect(() => buildPgEnvVars({
      domain: "unknown" as any, host: "localhost", secrets: SECRETS,
    })).toThrow(/unknown.*domain/i);
  });

  it("비밀번호 누락 → 에러", () => {
    const partialSecrets = { ...SECRETS };
    delete partialSecrets.QA_SDK_AUTH_PASSWORD;
    expect(() => buildPgEnvVars({
      domain: "auth", host: "localhost", secrets: partialSecrets,
    })).toThrow(/QA_SDK_AUTH_PASSWORD/);
  });

  it("SERVICE_PORTS에서 qa-sdk-postgres 포트 동적 조회", () => {
    // 포트는 SSOT(SERVICE_PORTS)에서 도출, 본 모듈이 하드코드 안 함
    // 간접 검증: input에 host만 있고 port는 SERVICE_PORTS lookup 결과
    const env = buildPgEnvVars({ domain: "auth", host: "h", secrets: SECRETS });
    expect(env.QA_PG_PORT).toBe("5434");
  });
});
```

- [ ] **Step 2: 실패 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk/packages/infra-engine && pnpm test -- pg-env-builder
```

Expected: FAIL.

- [ ] **Step 3: 구현**

`packages/infra-engine/src/export/pg-env-builder.ts`:

```ts
// @def.boundary infra-engine
// @def.doc infra-engine

/**
 * SERVICE_PORTS + 비밀번호 시크릿에서 도메인별 PG env 변수 dict 생성.
 *
 * 도메인 → (role, schema) 매핑은 pg-migration-design.md §3과 동기.
 * admin은 cross-domain 분석용 (search_path 미지정 → 명시 schema-qualified 쿼리).
 */

import { getRequiredServicePort } from "@qa-sdk/core";

export type PgDomain = "auth" | "audit" | "ingest" | "decision" | "definition" | "admin";

export interface PgEnvBuilderInput {
  domain: PgDomain;
  host: string;
  secrets: Record<string, string>;
}

interface DomainMapping {
  user: string;
  schema?: string;
  passwordVar: string;
}

const DOMAIN_MAP: Record<PgDomain, DomainMapping> = {
  auth:       { user: "auth_app",       schema: "auth",       passwordVar: "QA_SDK_AUTH_PASSWORD" },
  audit:      { user: "audit_app",      schema: "audit",      passwordVar: "QA_SDK_AUDIT_PASSWORD" },
  ingest:     { user: "ingest_app",     schema: "ingest",     passwordVar: "QA_SDK_INGEST_PASSWORD" },
  decision:   { user: "decision_app",   schema: "decision",   passwordVar: "QA_SDK_DECISION_PASSWORD" },
  definition: { user: "definition_app", schema: "definition", passwordVar: "QA_SDK_DEFINITION_PASSWORD" },
  admin:      { user: "qa_admin",       schema: undefined,    passwordVar: "QA_SDK_ADMIN_PASSWORD" },
};

export function buildPgEnvVars(input: PgEnvBuilderInput): Record<string, string> {
  const mapping = DOMAIN_MAP[input.domain];
  if (!mapping) {
    throw new Error(`unknown PG domain: ${input.domain}`);
  }

  const password = input.secrets[mapping.passwordVar];
  if (!password) {
    throw new Error(`PG 비밀번호 누락: ${mapping.passwordVar} (in .env.docker)`);
  }

  const port = getRequiredServicePort("qa-sdk-postgres");

  const env: Record<string, string> = {
    QA_DB_DIALECT: "pg",
    QA_PG_HOST: input.host,
    QA_PG_PORT: String(port),
    QA_PG_DATABASE: "qa_sdk",
    QA_PG_USER: mapping.user,
    QA_PG_PASSWORD: password,
  };

  if (mapping.schema) {
    env.QA_PG_SCHEMA = mapping.schema;
  }

  return env;
}
```

- [ ] **Step 4: 테스트 통과**

```bash
cd /Users/junwoobang/workflow/qa-sdk/packages/infra-engine && pnpm test -- pg-env-builder
```

Expected: 5 PASS.

- [ ] **Step 5: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && git add packages/infra-engine/src/export && git commit -m "$(cat <<'EOF'
feat(infra-engine): pg-env-builder — 도메인별 PG env 변수 생성

SERVICE_PORTS에서 qa-sdk-postgres 포트 동적 조회.
도메인 → (role, schema) 매핑은 pg-migration-design.md §3과 동기.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: 기존 env export에 PG 변수 통합

**Files:**
- Modify: 기존 env export 모듈 (Task 0 Step 2에서 발견된 경로)
- Modify: CLI commands export 모듈

호출 패턴은 export 모듈 구조에 따라 다름. 일반적으로:

```ts
// packages/infra-engine/src/export/env.ts (실제 위치는 Task 0에서 확인)
import { buildPgEnvVars, type PgDomain } from "./pg-env-builder.js";
import { readSopsSecrets } from "./secrets.js"; // 기존 모듈 또는 .env.docker 직접 read

export interface ExportEnvOptions {
  service: string;          // 어느 서비스용 .env 파일인가
  pgDomain?: PgDomain;      // PG 사용 시 도메인
  outFile: string;
}

export async function exportEnv(opts: ExportEnvOptions): Promise<void> {
  const lines: string[] = [];
  // ... 기존 ports/URL 등 export ...

  if (opts.pgDomain) {
    const secrets = await readSopsSecrets("packages/infra-engine/.env.docker");
    const pgEnv = buildPgEnvVars({
      domain: opts.pgDomain,
      host: "localhost",  // 또는 service-profile에서
      secrets,
    });
    for (const [k, v] of Object.entries(pgEnv)) {
      lines.push(`${k}=${v}`);
    }
  }

  await writeFile(opts.outFile, lines.join("\n") + "\n");
}
```

- [ ] **Step 1: 실제 export 모듈 read + 패치 위치 결정**

```bash
cd /Users/junwoobang/workflow/qa-sdk/packages/infra-engine && grep -rn "QA_PG_\|export.*env\|writeFile.*env" src/ --include="*.ts" | head -10
```

기록: 실제 통합 지점.

- [ ] **Step 2: pgDomain 옵션 추가 + buildPgEnvVars 호출**

위 발견된 위치에 `pgDomain` 옵션 추가. 호출 시 `buildPgEnvVars` 결과를 env line으로 직렬화.

- [ ] **Step 3: scripts/export.ts (CLI)에서 옵션 노출**

```bash
cd /Users/junwoobang/workflow/qa-sdk/packages/infra-engine && grep -n "argv\|parseArgs\|commander\|yargs" scripts/export.ts
```

CLI parser 패턴 확인 후 `--pg-domain <domain>` 플래그 추가.

- [ ] **Step 4: 통합 테스트 — 실제 export 실행**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter infra-engine build && \
  node packages/infra-engine/scripts/export.ts \
    --service permission-engine-svc \
    --pg-domain auth \
    --out /tmp/test-permission.env
cat /tmp/test-permission.env | head -20
```

Expected: `/tmp/test-permission.env`에 `QA_DB_DIALECT=pg`, `QA_PG_HOST=localhost`, `QA_PG_PORT=5434`, `QA_PG_USER=auth_app` 등 포함.

- [ ] **Step 5: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && git add packages/infra-engine/src packages/infra-engine/scripts && git commit -m "$(cat <<'EOF'
feat(infra-engine): export env에 --pg-domain 옵션 통합

도메인별 role/schema/password 자동 주입.
db-bootstrap의 dbEnvSchema와 1:1 일치.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: 회귀

- [ ] **Step 1: infra-engine 전체 테스트**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter infra-engine test 2>&1 | tail -10
```

Expected: 회귀 없음.

- [ ] **Step 2: 기존 export 사용처 회귀 (다른 service의 env export가 깨지지 않는지)**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter infra-engine build && \
  node packages/infra-engine/scripts/export.ts --service ingest-server --out /tmp/ingest.env && \
  cat /tmp/ingest.env | grep -c "="
```

Expected: 기존 PORT/URL 등 변수 그대로 export, PG 옵션 없으면 PG 변수 없음.

- [ ] **Step 3: def gate 회귀 (코드 변경만, 스펙 무관)**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter @qa-sdk/cli def validate 2>&1 | head -3
```

Expected: errors 0 유지.

---

## Self-Review

- [ ] pg-env-builder 단위 테스트 5건 통과
- [ ] 도메인별 (role, schema) 매핑이 pg-migration-design.md §3과 동기
- [ ] SERVICE_PORTS의 qa-sdk-postgres 포트 동적 조회 (하드코드 없음)
- [ ] 비밀번호 누락 시 fail-fast (silent skip 금지)
- [ ] CLI `--pg-domain` 옵션 추가 + scripts/export.ts에서 노출
- [ ] 기존 env export 사용처 회귀 없음

---

## Defer

| 작업 | 이유 |
|---|---|
| ServiceProfile.json에 `db_dialect`, `pg_domain` 필드 추가 | 본 plan은 CLI flag로만, 자동 결정은 서비스별 service-profile 통합 plan에서 |
| 비밀번호 rotation 자동화 | 운영 도입 시점 |
| sops 외 secret store (Vault 등) 통합 | 도입 시점 결정 |

---

## 의존·후속

- **Plan 04a/04b/04c**: 본 plan의 모든 부품. 완료 필수.
- **Plan 05+**: 각 store가 사용할 서비스의 .env 파일 생성 시 본 plan의 export CLI 사용.
