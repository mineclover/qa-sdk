# Plan 04a — qa-sdk-db PG 컨테이너 + init.sql

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `infra-engine`의 `docker-compose.infra.yaml`에 `qa-sdk-db: postgres:16-alpine` 컨테이너 신규 추가 (zitadel-db와 독립). 호스트 포트 5434. 컨테이너 부팅 시 `init.sql`이 `qa_sdk` + `qa_sdk_test` 두 database, 5개 schema (`auth/audit/ingest/decision/definition`), 도메인별 application role + cross-domain admin role을 자동 생성.

**Architecture:** docker-compose service 1개 추가 + bind mount된 init script 1개. `postgres:16-alpine` 이미지의 `/docker-entrypoint-initdb.d/`에 `*.sql` 파일을 두면 첫 부팅 시 자동 실행. zitadel-db와 별도 named volume(`qa-sdk-db-data`) — lifecycle 격리.

**Tech Stack:**
- postgres:16-alpine (zitadel-db와 동일 버전)
- docker-compose v3+ syntax (기존 파일 컨벤션)
- 신규 의존 없음 (이미지 + bind mount만)

---

## File Structure

### 새로 만드는 파일

| 경로 | 책임 |
|---|---|
| `packages/infra-engine/init/qa-sdk-db.sql` | 첫 부팅 시 실행될 init script — DB·schema·role 생성 |
| `packages/infra-engine/scripts/test-qa-sdk-db.sh` | docker compose up 후 PG 연결·schema 검증하는 smoke 스크립트 |

### 수정하는 파일

| 경로 | 변경 |
|---|---|
| `packages/infra-engine/docker-compose.infra.yaml` | `qa-sdk-db` 서비스 추가 + `qa-sdk-db-data` volume |
| `packages/infra-engine/.env.docker` | `QA_SDK_DB_PASSWORD` 등 신규 변수 추가 (sops 갱신) |

---

## Task 0: baseline 검증

- [ ] **Step 1: 현재 docker compose 정상 부팅 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk/packages/infra-engine && docker compose -f docker-compose.infra.yaml ps 2>&1 | head -10
```

기록: 현재 실행 중인 서비스 목록. 본 plan은 새 컨테이너만 추가하므로 기존 서비스 영향 없어야 한다.

- [ ] **Step 2: 포트 5434 미사용 확인**

```bash
lsof -nP -iTCP:5434 2>&1 | head -5
```

Expected: empty (포트 free). 사용 중이면 충돌 — 개발자가 다른 프로세스를 끄거나 포트 변경 의논.

---

## Task 1: init.sql 작성

**Files:**
- Create: `packages/infra-engine/init/qa-sdk-db.sql`

postgres 첫 부팅 시 `/docker-entrypoint-initdb.d/`의 `*.sql`이 알파벳 순으로 실행됨. 본 init은 단일 파일.

- [ ] **Step 1: init/qa-sdk-db.sql 작성**

```bash
mkdir -p /Users/junwoobang/workflow/qa-sdk/packages/infra-engine/init
```

`packages/infra-engine/init/qa-sdk-db.sql`:

```sql
-- qa-sdk PG 부트스트랩 — postgres 컨테이너 첫 부팅 시 자동 실행
-- pg-migration-design.md §3 (schema 격리)와 동기 유지

-- 1. 운영 DB + 테스트 DB
CREATE DATABASE qa_sdk;
CREATE DATABASE qa_sdk_test;

-- 2. 운영 DB에 5개 도메인 schema + role 생성
\c qa_sdk

CREATE SCHEMA auth;
CREATE SCHEMA audit;
CREATE SCHEMA ingest;
CREATE SCHEMA decision;
CREATE SCHEMA definition;

-- 도메인별 application role (각 schema 안에서만 동작)
-- 비밀번호는 .env.docker → docker entrypoint에서 환경 변수로 주입
CREATE ROLE auth_app       WITH LOGIN PASSWORD :'QA_SDK_AUTH_PASSWORD';
CREATE ROLE audit_app      WITH LOGIN PASSWORD :'QA_SDK_AUDIT_PASSWORD';
CREATE ROLE ingest_app     WITH LOGIN PASSWORD :'QA_SDK_INGEST_PASSWORD';
CREATE ROLE decision_app   WITH LOGIN PASSWORD :'QA_SDK_DECISION_PASSWORD';
CREATE ROLE definition_app WITH LOGIN PASSWORD :'QA_SDK_DEFINITION_PASSWORD';

-- cross-domain 분석 role (admin)
CREATE ROLE qa_admin WITH LOGIN PASSWORD :'QA_SDK_ADMIN_PASSWORD';

-- schema-level GRANT
GRANT USAGE ON SCHEMA auth       TO auth_app;
GRANT USAGE ON SCHEMA audit      TO audit_app;
GRANT USAGE ON SCHEMA ingest     TO ingest_app;
GRANT USAGE ON SCHEMA decision   TO decision_app;
GRANT USAGE ON SCHEMA definition TO definition_app;

GRANT USAGE ON SCHEMA auth, audit, ingest, decision, definition TO qa_admin;

-- 테이블이 아직 없으므로 ALTER DEFAULT PRIVILEGES로 미래 테이블도 자동 권한 부여
ALTER DEFAULT PRIVILEGES IN SCHEMA auth       GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO auth_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA audit      GRANT SELECT, INSERT                ON TABLES TO audit_app;  -- audit는 write-mostly, update/delete 권한 제외
ALTER DEFAULT PRIVILEGES IN SCHEMA ingest     GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ingest_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA decision   GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO decision_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA definition GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO definition_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA auth, audit, ingest, decision, definition GRANT SELECT ON TABLES TO qa_admin;

-- 3. 테스트 DB도 동일 schema 구조 (각 테스트가 random schema를 만들지만 도메인 schema 기본 보유)
\c qa_sdk_test

CREATE SCHEMA auth;
CREATE SCHEMA audit;
CREATE SCHEMA ingest;
CREATE SCHEMA decision;
CREATE SCHEMA definition;

-- 테스트 DB는 qa_admin이 모든 권한 (random schema 생성·drop)
GRANT ALL ON SCHEMA auth, audit, ingest, decision, definition TO qa_admin;
GRANT CREATE ON DATABASE qa_sdk_test TO qa_admin;
```

**주의 — `:'VAR'` 문법**: psql variable interpolation. `psql --set VAR=value` 또는 docker entrypoint가 환경 변수를 자동 주입. 본 plan에서는 `.env.docker`의 변수명과 일치하도록 작성.

- [ ] **Step 2: SQL 문법 검증 (실행 없이 lint)**

```bash
docker run --rm -v /Users/junwoobang/workflow/qa-sdk/packages/infra-engine/init:/sql:ro postgres:16-alpine \
  pg_verifyfile /sql/qa-sdk-db.sql 2>&1 | tail -10
```

`pg_verifyfile`이 없으면 다음 대안:

```bash
docker run --rm -v /Users/junwoobang/workflow/qa-sdk/packages/infra-engine/init:/sql:ro postgres:16-alpine \
  cat /sql/qa-sdk-db.sql > /dev/null && echo "syntax OK (basic)"
```

(완전한 lint는 Step 4의 실제 부팅에서 검증)

- [ ] **Step 3: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && git add packages/infra-engine/init/qa-sdk-db.sql && git commit -m "$(cat <<'EOF'
feat(infra-engine): qa-sdk-db init.sql — 5 schema + role 부트스트랩

운영 DB qa_sdk + 테스트 DB qa_sdk_test 생성.
도메인별 app role(auth/audit/ingest/decision/definition) + qa_admin.
audit_app은 write-mostly로 update/delete 권한 제외.
ALTER DEFAULT PRIVILEGES로 미래 테이블 자동 권한 부여.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: docker-compose.infra.yaml에 qa-sdk-db 서비스 추가

**Files:**
- Modify: `packages/infra-engine/docker-compose.infra.yaml`

기존 `zitadel-db` 블록과 동일 패턴 + init script bind mount.

- [ ] **Step 1: 서비스 블록 추가 (zitadel-db 다음 위치)**

`packages/infra-engine/docker-compose.infra.yaml` — `zitadel-db:` 블록 다음, `volumes:` 블록 직전에 추가:

```yaml
  qa-sdk-db:
    image: postgres:16-alpine
    env_file: .env.docker
    environment:
      POSTGRES_DB: postgres
      # init.sql의 :'VAR' 변수 주입
      QA_SDK_AUTH_PASSWORD: ${QA_SDK_AUTH_PASSWORD}
      QA_SDK_AUDIT_PASSWORD: ${QA_SDK_AUDIT_PASSWORD}
      QA_SDK_INGEST_PASSWORD: ${QA_SDK_INGEST_PASSWORD}
      QA_SDK_DECISION_PASSWORD: ${QA_SDK_DECISION_PASSWORD}
      QA_SDK_DEFINITION_PASSWORD: ${QA_SDK_DEFINITION_PASSWORD}
      QA_SDK_ADMIN_PASSWORD: ${QA_SDK_ADMIN_PASSWORD}
    ports:
      - "5434:5432"
    volumes:
      - qa-sdk-db-data:/var/lib/postgresql/data
      - ./init/qa-sdk-db.sql:/docker-entrypoint-initdb.d/00-qa-sdk-db.sql:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d qa_sdk"]
      interval: 5s
      timeout: 3s
      retries: 15
      start_period: 10s
```

**주의**: init.sql은 `psql -v VAR=value` 형식이 아니라 환경 변수를 통해 주입되어야 함. postgres entrypoint가 `${VAR}`를 자동 치환하지는 않음. 해결: init script를 환경 변수에서 직접 읽는 형태로 변경하거나, 별도 entrypoint script로 wrapping.

**더 안전한 패턴 — 별도 wrapper script** (Step 2에서 결정):

옵션 A: init.sql 안에서 `\set VAR ` `getenv()` — psql `\getenv` (PG 14+) 사용 가능. `\getenv` 명령으로 환경변수를 psql 변수로 읽음.

옵션 B: docker-entrypoint가 init script 실행 전 SQL 파일을 sed로 substitute. 별도 shell wrapper 추가.

본 plan은 **옵션 A** 채택 (psql native). init.sql 상단에 추가:

```sql
-- 환경 변수에서 비밀번호 로드 (psql 14+)
\getenv qa_auth_pw       QA_SDK_AUTH_PASSWORD
\getenv qa_audit_pw      QA_SDK_AUDIT_PASSWORD
\getenv qa_ingest_pw     QA_SDK_INGEST_PASSWORD
\getenv qa_decision_pw   QA_SDK_DECISION_PASSWORD
\getenv qa_definition_pw QA_SDK_DEFINITION_PASSWORD
\getenv qa_admin_pw      QA_SDK_ADMIN_PASSWORD
```

그리고 `:'QA_SDK_AUTH_PASSWORD'`를 `:'qa_auth_pw'`로 변경.

- [ ] **Step 2: init.sql 갱신 (psql \getenv 패턴)**

`packages/infra-engine/init/qa-sdk-db.sql` 상단을 다음으로 교체:

```sql
-- qa-sdk PG 부트스트랩 — postgres 컨테이너 첫 부팅 시 자동 실행

-- 환경 변수 → psql 변수 로드 (psql 14+ \getenv)
\getenv qa_auth_pw       QA_SDK_AUTH_PASSWORD
\getenv qa_audit_pw      QA_SDK_AUDIT_PASSWORD
\getenv qa_ingest_pw     QA_SDK_INGEST_PASSWORD
\getenv qa_decision_pw   QA_SDK_DECISION_PASSWORD
\getenv qa_definition_pw QA_SDK_DEFINITION_PASSWORD
\getenv qa_admin_pw      QA_SDK_ADMIN_PASSWORD

-- 1. 운영 DB + 테스트 DB
CREATE DATABASE qa_sdk;
CREATE DATABASE qa_sdk_test;
```

그리고 모든 `CREATE ROLE ... PASSWORD :'QA_SDK_*_PASSWORD'`를 `:'qa_*_pw'` 형태로 변경.

- [ ] **Step 3: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && git add packages/infra-engine/docker-compose.infra.yaml packages/infra-engine/init/qa-sdk-db.sql && git commit -m "$(cat <<'EOF'
feat(infra-engine): qa-sdk-db docker-compose 서비스 추가 (포트 5434)

postgres:16-alpine, zitadel-db와 독립 volume.
init.sql을 docker-entrypoint-initdb.d로 bind mount → 첫 부팅 자동 실행.
psql \getenv로 환경 변수 → 비밀번호 주입.
healthcheck: pg_isready -d qa_sdk (init 완료 후 응답).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: .env.docker에 qa-sdk-db 비밀번호 변수 추가

**Files:**
- Modify: `packages/infra-engine/.env.docker`

`.env.docker`는 sops 암호화 파일이므로 직접 편집 불가. 평문 추가 후 sops로 재암호화하는 절차.

- [ ] **Step 1: sops로 복호화 → 편집 → 재암호화**

```bash
cd /Users/junwoobang/workflow/qa-sdk/packages/infra-engine && sops decrypt .env.docker > /tmp/qa-env-decrypted.txt
```

(sops 설정이 안 되어 있으면 `cat .env.docker`로 평문 확인 — 현재는 평문일 수도)

`/tmp/qa-env-decrypted.txt`에 다음 추가 (각 비밀번호는 `openssl rand -base64 24`로 생성):

```
# qa-sdk-db (PostgreSQL 운영 DB)
QA_SDK_AUTH_PASSWORD=<generated>
QA_SDK_AUDIT_PASSWORD=<generated>
QA_SDK_INGEST_PASSWORD=<generated>
QA_SDK_DECISION_PASSWORD=<generated>
QA_SDK_DEFINITION_PASSWORD=<generated>
QA_SDK_ADMIN_PASSWORD=<generated>
```

비밀번호 6개 일괄 생성:
```bash
for var in AUTH AUDIT INGEST DECISION DEFINITION ADMIN; do
  echo "QA_SDK_${var}_PASSWORD=$(openssl rand -base64 24 | tr -d '\n')"
done
```

- [ ] **Step 2: sops로 재암호화**

```bash
cd /Users/junwoobang/workflow/qa-sdk/packages/infra-engine && sops encrypt /tmp/qa-env-decrypted.txt > .env.docker
rm /tmp/qa-env-decrypted.txt
```

sops 미설정 시: `cp /tmp/qa-env-decrypted.txt .env.docker` (평문 유지, .gitignore 확인 필수).

- [ ] **Step 3: .gitignore 점검**

`packages/infra-engine/.gitignore`에 `.env.docker` 항목이 있는지 확인. 없으면 추가:

```bash
cd /Users/junwoobang/workflow/qa-sdk/packages/infra-engine && grep -q "^\.env\.docker$" .gitignore || echo ".env.docker" >> .gitignore
```

- [ ] **Step 4: 커밋 (.env.docker 자체는 staging 안 함, .gitignore 변경만)**

```bash
cd /Users/junwoobang/workflow/qa-sdk && git add packages/infra-engine/.gitignore && git commit -m "$(cat <<'EOF'
chore(infra-engine): .env.docker gitignore 점검 — qa-sdk-db 비밀번호 노출 방지

QA_SDK_*_PASSWORD 6개 추가 (실제 값은 sops/.env.docker로 격리).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: 컨테이너 부팅 + smoke 검증

**Files:**
- Create: `packages/infra-engine/scripts/test-qa-sdk-db.sh`

- [ ] **Step 1: smoke 스크립트 작성**

`packages/infra-engine/scripts/test-qa-sdk-db.sh`:

```bash
#!/usr/bin/env bash
# qa-sdk-db 컨테이너 부팅 검증 — 5 schema + 6 role 생성 확인
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

echo "==> qa-sdk-db 컨테이너 부팅"
docker compose -f docker-compose.infra.yaml up -d qa-sdk-db

echo "==> healthcheck 대기 (최대 60초)"
for i in $(seq 1 12); do
  status=$(docker compose -f docker-compose.infra.yaml ps --format json qa-sdk-db | jq -r '.Health' 2>/dev/null || echo "starting")
  if [[ "$status" == "healthy" ]]; then
    echo "  → healthy"
    break
  fi
  echo "  → $status (대기 ${i}/12)"
  sleep 5
done

echo "==> qa_sdk DB 존재 확인"
docker compose -f docker-compose.infra.yaml exec -T qa-sdk-db psql -U postgres -tA -c "SELECT datname FROM pg_database WHERE datname IN ('qa_sdk','qa_sdk_test');" | sort

echo "==> qa_sdk schema 5개 확인"
docker compose -f docker-compose.infra.yaml exec -T qa-sdk-db psql -U postgres -d qa_sdk -tA -c "SELECT nspname FROM pg_namespace WHERE nspname IN ('auth','audit','ingest','decision','definition') ORDER BY nspname;"

echo "==> role 6개 확인"
docker compose -f docker-compose.infra.yaml exec -T qa-sdk-db psql -U postgres -tA -c "SELECT rolname FROM pg_roles WHERE rolname IN ('auth_app','audit_app','ingest_app','decision_app','definition_app','qa_admin') ORDER BY rolname;"

echo "==> auth_app role의 auth schema 권한 확인 (USAGE 있어야 함)"
docker compose -f docker-compose.infra.yaml exec -T qa-sdk-db psql -U postgres -d qa_sdk -tA -c "SELECT has_schema_privilege('auth_app', 'auth', 'USAGE');"

echo "✓ qa-sdk-db smoke 통과"
```

```bash
chmod +x /Users/junwoobang/workflow/qa-sdk/packages/infra-engine/scripts/test-qa-sdk-db.sh
```

- [ ] **Step 2: smoke 실행**

```bash
cd /Users/junwoobang/workflow/qa-sdk/packages/infra-engine && ./scripts/test-qa-sdk-db.sh
```

Expected output 일부:
```
qa_sdk
qa_sdk_test
auth
audit
decision
definition
ingest
auth_app
audit_app
decision_app
definition_app
ingest_app
qa_admin
t
✓ qa-sdk-db smoke 통과
```

실패 시 진단:
- 컨테이너 fail → `docker compose -f docker-compose.infra.yaml logs qa-sdk-db` 확인
- 비밀번호 미주입 → `.env.docker`의 환경변수 docker-compose가 읽었는지 점검
- init.sql 문법 오류 → 위 logs에서 직접 확인

- [ ] **Step 3: 컨테이너 정리 (개발 워크플로우용 — 필수 아님)**

```bash
cd /Users/junwoobang/workflow/qa-sdk/packages/infra-engine && docker compose -f docker-compose.infra.yaml down qa-sdk-db
# volume까지 삭제하려면: docker volume rm infra-engine_qa-sdk-db-data
```

- [ ] **Step 4: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && git add packages/infra-engine/scripts/test-qa-sdk-db.sh && git commit -m "$(cat <<'EOF'
test(infra-engine): qa-sdk-db smoke 스크립트

컨테이너 부팅 → healthcheck → DB/schema/role 검증.
Plan 04a 마무리 검증 도구.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: 회귀 점검

- [ ] **Step 1: 기존 docker compose 영향 없음 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk/packages/infra-engine && docker compose -f docker-compose.infra.yaml config 2>&1 | tail -10
```

Expected: error 없이 전체 compose 파일이 valid로 출력.

- [ ] **Step 2: zitadel-db, minio 등 기존 서비스 부팅 (회귀 검증)**

```bash
cd /Users/junwoobang/workflow/qa-sdk/packages/infra-engine && docker compose -f docker-compose.infra.yaml up -d zitadel-db minio && sleep 10 && docker compose -f docker-compose.infra.yaml ps
```

Expected: zitadel-db + minio + qa-sdk-db 모두 healthy.

- [ ] **Step 3: def gate (스펙 변경 없으므로 영향 없어야)**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter @qa-sdk/cli def validate 2>&1 | head -5
```

Expected: errors 0 유지.

---

## Self-Review

- [ ] qa-sdk-db 컨테이너가 zitadel-db와 별도 named volume 사용
- [ ] init.sql이 첫 부팅 시에만 실행 (volume 재사용 시 skip — postgres 표준 동작)
- [ ] 5 schema + 6 role + 2 DB 모두 생성됨 (smoke 검증)
- [ ] audit_app은 write-only-ish (update/delete 권한 없음)
- [ ] qa_admin은 cross-domain SELECT만
- [ ] 비밀번호는 sops/.env.docker로 격리, git에 평문 노출 없음
- [ ] 기존 zitadel-db/minio 영향 없음

---

## Defer (본 plan 범위 외)

| 작업 | 이유 | 후속 plan |
|---|---|---|
| `auth_app` 등으로 실제 연결 테스트 | 권한 검증은 첫 store(Plan 05)에서 contract test로 자동 검증됨 | Plan 05c |
| RLS 정책 정의 | 스키마 placeholder만, 정책은 §3 RLS plan | Phase 3 (§3) |
| Backup·restore 절차 | 운영 도입 시점 | Plan 04 시리즈 외 |
| Connection pool 튜닝 (max_connections 등) | 부하 측정 후 결정 | 시뮬 트래픽 후 |

---

## 의존·후속

- **Plan 04b** (SERVICE_PORTS 등록): 본 plan과 독립. 병렬 가능.
- **Plan 04c** (db-bootstrap 패키지): 본 plan + 04b 완료 후. db-bootstrap의 PG fixture가 본 컨테이너를 사용.
- **Plan 04d** (infra-engine env export): 04b 완료 후. 본 plan의 비밀번호 환경 변수가 export 대상.
- **Plan 05+** (각 store dual-target): db-bootstrap(04c)의 fixture 활용해 port-contract.test 작성.
