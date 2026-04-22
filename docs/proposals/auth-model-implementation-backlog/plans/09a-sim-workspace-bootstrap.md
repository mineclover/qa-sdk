# Plan 09a — Enterprise PM 시뮬 workspace 부트스트랩

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Phase 4 시뮬 프로젝트의 monorepo 진입점 — `simulations/enterprise-pm/` 디렉토리 + `pnpm-workspace.yaml`에 `simulations/*` 패턴 추가 + sim root `package.json` (sim-* 스크립트) + 공통 `tsconfig.base.json` + 디자인 문서 링크 README. 실제 NestJS 서비스 코드는 Plan 10에서 추가하며, 본 plan은 workspace가 인식하는 골격까지만 만든다.

**Architecture:** pnpm workspace에 새 root (`simulations/enterprise-pm`)를 등록한다. `simulations/*` glob 한 줄 추가만으로 sim root가 workspace member로 인식되며, 추가 `simulations/*/services/*` 패턴은 Plan 10이 NestJS 서비스를 만들 때 자동으로 9 sub-package가 워크스페이스에 합류하도록 미리 선언한다. sim root 자체는 stub 서비스 코드는 갖지 않고 `sim:up`/`sim:down`/`sim:seed` orchestration script만 노출한다.

**Tech Stack:**
- pnpm 10 workspace (catalog 미수정)
- TypeScript ES2023 (qa-sdk monorepo 규칙)
- 신규 npm 의존 없음 (orchestration only)

---

## File Structure

### 새로 만드는 파일

| 경로 | 책임 |
|---|---|
| `simulations/enterprise-pm/package.json` | sim root — `sim:up`/`sim:down`/`sim:seed` 스크립트 진입점 |
| `simulations/enterprise-pm/README.md` | 시뮬 부팅 절차 + 디자인 문서 링크 + Plan 09~14 인덱스 |
| `simulations/enterprise-pm/tsconfig.base.json` | 9 NestJS 서비스가 `extends`할 공통 컴파일러 옵션 |
| `simulations/enterprise-pm/.gitignore` | `node_modules/`, `dist/`, `.env.sim` 격리 |
| `simulations/enterprise-pm/services/.gitkeep` | Plan 10이 채울 서비스 디렉토리 placeholder |
| `simulations/enterprise-pm/scripts/.gitkeep` | Plan 09c가 채울 sim-up/down 디렉토리 placeholder |

### 수정하는 파일

| 경로 | 변경 |
|---|---|
| `pnpm-workspace.yaml` | `simulations/enterprise-pm` + `simulations/enterprise-pm/services/*` 두 패턴 추가 |

---

## Task 0: baseline 검증

- [ ] **Step 1: 현재 workspace 정상 인식 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm -r list --depth -1 2>&1 | tail -10
```

Expected: 현재 32개 packages 인식. 이름 누락 없음. simulations 없음 — 본 plan으로 추가.

- [ ] **Step 2: 충돌 디렉토리 미존재 확인**

```bash
ls /Users/junwoobang/workflow/qa-sdk/simulations 2>&1
```

Expected: `No such file or directory`. 존재하면 다른 시뮬과 충돌 가능 — 작업 중지 후 의논.

- [ ] **Step 3: pnpm-workspace.yaml 현재 내용 기록**

```bash
cd /Users/junwoobang/workflow/qa-sdk && cat pnpm-workspace.yaml
```

Expected: `packages: ["packages/*"]` + catalog 4 entry. 본 plan은 `packages` 배열에 항목 추가만 한다.

---

## Task 1: simulations 디렉토리 + .gitignore 작성

**Files:**
- Create: `simulations/enterprise-pm/.gitignore`
- Create: `simulations/enterprise-pm/services/.gitkeep`
- Create: `simulations/enterprise-pm/scripts/.gitkeep`

- [ ] **Step 1: 디렉토리 생성**

```bash
mkdir -p /Users/junwoobang/workflow/qa-sdk/simulations/enterprise-pm/services /Users/junwoobang/workflow/qa-sdk/simulations/enterprise-pm/scripts /Users/junwoobang/workflow/qa-sdk/simulations/enterprise-pm/seed
```

- [ ] **Step 2: `.gitignore` 작성**

`simulations/enterprise-pm/.gitignore`:

```
node_modules/
dist/
.env.sim
.env.sim.local
*.log
coverage/
.turbo/
```

`.env.sim`은 sops로 관리 — 평문은 절대 커밋 금지 (Plan 09d).

- [ ] **Step 3: 빈 디렉토리 커밋용 placeholder**

`simulations/enterprise-pm/services/.gitkeep` (빈 파일):

```
# Plan 10에서 9 NestJS 서비스 디렉토리 추가 예정.
# 본 placeholder는 services/* glob이 빈 디렉토리에서도 의미를 가지도록 한다.
```

`simulations/enterprise-pm/scripts/.gitkeep`:

```
# Plan 09c에서 sim-up.sh / sim-down.sh 추가 예정.
```

`simulations/enterprise-pm/seed/.gitkeep`:

```
# Plan 09d에서 departments.sql / roles.sql / users.sql / role-assignments.sql / seed.ts 추가 예정.
```

- [ ] **Step 4: 디렉토리 구조 확인**

```bash
find /Users/junwoobang/workflow/qa-sdk/simulations -type f -o -type d | sort
```

Expected:
```
/Users/junwoobang/workflow/qa-sdk/simulations
/Users/junwoobang/workflow/qa-sdk/simulations/enterprise-pm
/Users/junwoobang/workflow/qa-sdk/simulations/enterprise-pm/.gitignore
/Users/junwoobang/workflow/qa-sdk/simulations/enterprise-pm/scripts
/Users/junwoobang/workflow/qa-sdk/simulations/enterprise-pm/scripts/.gitkeep
/Users/junwoobang/workflow/qa-sdk/simulations/enterprise-pm/seed
/Users/junwoobang/workflow/qa-sdk/simulations/enterprise-pm/seed/.gitkeep
/Users/junwoobang/workflow/qa-sdk/simulations/enterprise-pm/services
/Users/junwoobang/workflow/qa-sdk/simulations/enterprise-pm/services/.gitkeep
```

---

## Task 2: sim root `package.json` 작성

**Files:**
- Create: `simulations/enterprise-pm/package.json`

sim root는 NestJS 서비스가 아니라 orchestration container — 9 서비스를 docker compose로 묶고 seed runner를 실행하는 진입점.

- [ ] **Step 1: package.json 작성**

`simulations/enterprise-pm/package.json`:

```json
{
  "name": "@qa-sdk-sim/enterprise-pm",
  "version": "0.1.0",
  "private": true,
  "description": "Enterprise PM 시뮬 — qa-sdk 5축 검증용 9서비스 orchestration root",
  "type": "module",
  "scripts": {
    "sim:up": "bash scripts/sim-up.sh",
    "sim:down": "bash scripts/sim-down.sh",
    "sim:logs": "docker compose -f docker-compose.sim.yaml logs -f --tail=100",
    "sim:ps": "docker compose -f docker-compose.sim.yaml ps",
    "sim:seed": "tsx seed/seed.ts",
    "sim:scenario": "echo 'scenario runner는 Plan 13에서 추가 예정' && exit 1",
    "sim:doctor": "bash scripts/sim-doctor.sh || echo 'sim-doctor.sh는 Plan 14에서 추가 예정'",
    "build": "echo 'sim root는 빌드 산출물 없음 — 서비스별 build는 services/*/package.json 참조'",
    "test": "echo 'sim root 자체 테스트 없음 — 시나리오는 Plan 13, marginal density는 Plan 14 참조'"
  },
  "devDependencies": {
    "tsx": "^4.19.2",
    "typescript": "^5.6.3"
  },
  "engines": {
    "node": ">=22.0.0",
    "pnpm": ">=10.0.0"
  }
}
```

**주의 — `tsx` 의존**: `sim:seed`가 TypeScript runner를 ES module로 직접 실행하기 위해 필요. Plan 09d에서 `seed/seed.ts`를 작성한다.

**주의 — sim 스크립트는 sim root에서만 노출**: 모노레포 root의 `package.json`에는 `sim:*` 추가하지 않는다. workspace 격리 원칙.

- [ ] **Step 2: name 충돌 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm list --depth -1 -r 2>&1 | grep "qa-sdk-sim" | head -5
```

Expected: empty (신규 namespace).

---

## Task 3: 공통 `tsconfig.base.json` 작성

**Files:**
- Create: `simulations/enterprise-pm/tsconfig.base.json`

9 NestJS 서비스가 `extends`할 단일 base — qa-sdk monorepo의 ES2023 컨벤션 + NestJS 호환 (decorator, emitDecoratorMetadata).

- [ ] **Step 1: tsconfig.base.json 작성**

`simulations/enterprise-pm/tsconfig.base.json`:

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    "target": "ES2023",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2023"],
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "useDefineForClassFields": false,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "isolatedModules": true,
    "declaration": true,
    "sourceMap": true,
    "removeComments": false
  },
  "exclude": ["node_modules", "dist", "**/*.test.ts", "**/*.spec.ts"]
}
```

**근거**:
- `target: ES2023` — qa-sdk 모노레포 통일 (CLAUDE.md "TypeScript target ES2023")
- `experimentalDecorators` + `emitDecoratorMetadata` — NestJS 필수
- `useDefineForClassFields: false` — NestJS DI 호환
- `noUncheckedIndexedAccess` — 시뮬도 strict 유지

- [ ] **Step 2: 별도 tsconfig 검증 (구조 valid 확인)**

```bash
cd /Users/junwoobang/workflow/qa-sdk/simulations/enterprise-pm && npx -y typescript@5.6.3 --project tsconfig.base.json --noEmit --listFiles 2>&1 | tail -5
```

Expected: 에러 없음 (파일 0개 컴파일 — services가 아직 비어있음). 만약 `error TS18003: No inputs were found in config file` 발생 시 정상 — 본 base는 직접 빌드 대상 아님, services가 `extends`하기 위한 파일.

검증 우회: `tsc --showConfig` 만 실행:

```bash
cd /Users/junwoobang/workflow/qa-sdk/simulations/enterprise-pm && npx -y typescript@5.6.3 --project tsconfig.base.json --showConfig 2>&1 | head -30
```

Expected: JSON 출력 (파싱 가능). 에러 없음.

---

## Task 4: README 작성 (디자인 문서 링크 + 부팅 절차)

**Files:**
- Create: `simulations/enterprise-pm/README.md`

- [ ] **Step 1: README 작성**

`simulations/enterprise-pm/README.md`:

````markdown
# Enterprise PM 시뮬레이션

> qa-sdk 5축(권한·이벤트·관측·로직·로깅)을 PM + Approval Workflow 도메인에서 end-to-end 검증하는 test harness.

## 위치 및 범위

- 위치: `simulations/enterprise-pm/` (qa-sdk 모노레포 내부)
- 패키지명: `@qa-sdk-sim/enterprise-pm` (workspace member)
- 9 NestJS 서비스 + Hono gateway + 1 Redis + qa-sdk 본체 인프라(qa-sdk-db, ingest-server) 외부 참조
- CLI scenario runner only (UI 없음)

## 디자인·계획 문서

| 문서 | 내용 |
|---|---|
| [`docs/proposals/auth-model-implementation-backlog/sim-erp-pm-design.md`](../../docs/proposals/auth-model-implementation-backlog/sim-erp-pm-design.md) | 전체 아키텍처 — 토폴로지/도메인/8 시나리오/19 plan 분해 |
| Plan 09a (본 폴더) | workspace 부트스트랩 (현재 plan) |
| Plan 09b | qa-sdk-db init.sql `sim` schema + `sim_app` role + SERVICE_PORTS 9 entry |
| Plan 09c | docker-compose.sim.yaml + Dockerfile.service + sim-up/down 스크립트 |
| Plan 09d | .env.sim + sops + seed 데이터 (7 부서, 50 사용자, 7 역할) |
| Plan 10 | 9 NestJS 서비스 스캐폴딩 (10a/b/c) |
| Plan 11 | 도메인 모델 + DB schema (11a/b/c) |
| Plan 12 | Cross-service 통신 + 권한 통합 (12a/b/c) |
| Plan 13 | 8 시나리오 구현 (13a/b/c/d) |
| Plan 14 | §5 marginal density + 통합 회귀 (14a/b) |

## 부팅 절차 (Plan 09 완료 후)

1. **qa-sdk 본체 인프라 부팅** (다른 터미널)
   ```bash
   cd packages/infra-engine && docker compose -f docker-compose.infra.yaml up -d qa-sdk-db
   pnpm --filter @qa-sdk/ingest-server dev
   ```

2. **시뮬 환경 변수 설정**
   ```bash
   cd simulations/enterprise-pm
   sops decrypt .env.sim.enc > .env.sim   # Plan 09d로 추가될 sops 파일
   ```

3. **시뮬 컨테이너 부팅**
   ```bash
   pnpm sim:up      # docker compose -f docker-compose.sim.yaml up -d
   pnpm sim:ps      # 9 서비스 + sim-redis healthy 확인
   ```

4. **seed 데이터 적용**
   ```bash
   pnpm sim:seed    # 7 부서, 50 사용자, 7 역할, role_assignments
   ```

5. **시나리오 실행** (Plan 13 완료 후)
   ```bash
   pnpm sim:scenario -- 1   # 시나리오 1: 로그인 → bitmap 발행 → 프로젝트 list
   ```

6. **종료**
   ```bash
   pnpm sim:down
   ```

## 서비스 토폴로지 + 포트

| 서비스 | 포트 | 역할 |
|---|---|---|
| sim-gateway | 8888 | Hono — JWT bitmap embed + traceparent 주입 |
| sim-auth-api | 4400 | User/Role/Department + bitmap 발행 |
| sim-pm-api | 4500 | Project/Task/Member |
| sim-approval-api | 4600 | Budget/Resource/Time-off/Expense workflow |
| sim-notification-api | 4700 | 알림·구독 |
| sim-reporting-api | 4800 | 분석·대시보드 (marginal density) |
| sim-document-api | 4900 | 첨부·코멘트·버전 |
| sim-audit-browser-api | 5100 | audit trace explorer API |
| sim-metrics-collector | 5200 | Prometheus exporter |
| sim-redis | 6379 | bitmap pub/sub + event broadcast |

자세한 포트 할당: `docs/specs/infra-engine/infra-port-allocation.spec.md` (Plan 09b로 갱신).

## 외부 의존 (qa-sdk 본체 컨테이너)

- `qa-sdk-db` (5434) — `sim` schema (Plan 09b로 추가)
- `ingest-server` (3200) — IngestForwarder 수신
- `host.docker.internal:4318` — OTEL collector (Tempo/Jaeger)

## 라이선스 / 정책

본 시뮬은 qa-sdk 검증용 test harness이며 실제 제품이 아니다. 진짜 ERP의 HR·재무·인벤토리 모듈은 의도적으로 제외한다.
````

- [ ] **Step 2: README 링크 검증**

```bash
cd /Users/junwoobang/workflow/qa-sdk && ls docs/proposals/auth-model-implementation-backlog/sim-erp-pm-design.md docs/specs/infra-engine/infra-port-allocation.spec.md 2>&1
```

Expected: 두 파일 모두 존재. README의 상대 경로가 깨지지 않음.

---

## Task 5: pnpm-workspace.yaml 갱신

**Files:**
- Modify: `pnpm-workspace.yaml`

- [ ] **Step 1: simulations 패턴 추가**

`pnpm-workspace.yaml`을 다음으로 교체:

```yaml
packages:
  - "packages/*"
  - "simulations/enterprise-pm"
  - "simulations/enterprise-pm/services/*"

# 모노레포 전체에서 공유하는 버전은 여기에 catalog로 선언하고
# 각 package.json은 `"catalog:"`로 참조한다.
catalog:
  drizzle-orm: 1.0.0-beta.22
  drizzle-kit: 1.0.0-beta.22
  better-sqlite3: ^12.8.0
  "@types/better-sqlite3": ^7.6.13
```

**선택 근거 — 두 패턴 분리**:
- `simulations/enterprise-pm` — sim root (orchestration only)
- `simulations/enterprise-pm/services/*` — Plan 10이 추가할 9 NestJS 서비스 (개별 workspace member)
- 단일 glob `simulations/**/*`는 사용하지 않음 (seed/, scripts/ 등 비-패키지 디렉토리도 매칭하기 때문)

- [ ] **Step 2: pnpm install로 workspace 인식 검증**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm install 2>&1 | tail -20
```

Expected:
- 새 packages 발견 메시지에 `@qa-sdk-sim/enterprise-pm` 포함
- 에러 없음
- 기존 32개 패키지 영향 없음 (lockfile 변경 최소)

만약 `Conflicting package name` 등 에러 발생 → 본 plan의 name 충돌 의심 → 작업 중지.

- [ ] **Step 3: workspace member 검증**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm -r list --depth -1 2>&1 | grep -E "(qa-sdk-sim|simulations)" | head -10
```

Expected: `@qa-sdk-sim/enterprise-pm` 1건 출력. services는 아직 비어있어 0건.

- [ ] **Step 4: 시뮬 root에서 `pnpm exec` 동작 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk/simulations/enterprise-pm && pnpm exec tsc --version 2>&1
```

Expected: TypeScript 5.6.3 출력 (devDependencies가 정상 설치됨).

---

## Task 6: 회귀 점검

- [ ] **Step 1: 기존 패키지 typecheck 영향 없음 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter @qa-sdk/core --filter @qa-sdk/cli typecheck 2>&1 | tail -10
```

Expected: 모두 에러 없음. workspace 추가는 기존 패키지에 영향 없어야 한다.

- [ ] **Step 2: workflow-smoke 회귀 (sim root는 무관해야)**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter @qa-sdk/cli test 2>&1 | tail -5
```

Expected: 12+ smoke 통과 유지 (sim 폴더 추가는 CLI smoke와 무관).

- [ ] **Step 3: def gate (스펙 변경 없음 → 영향 없음)**

```bash
cd /Users/junwoobang/workflow/qa-sdk && node packages/cli/dist/index.js def validate 2>&1 | head -5
```

Expected: errors=0 유지.

- [ ] **Step 4: pnpm-lock.yaml diff 검토**

```bash
cd /Users/junwoobang/workflow/qa-sdk && git diff pnpm-lock.yaml 2>&1 | head -50
```

Expected: `@qa-sdk-sim/enterprise-pm` workspace entry + tsx + typescript devDep 추가만. 기존 패키지의 lockfile 변경 없음.

---

## Self-Review

- [ ] `simulations/enterprise-pm/` 디렉토리 + 6 placeholder/config 파일 생성
- [ ] sim root `package.json` — `@qa-sdk-sim/enterprise-pm`, sim:* 스크립트 6개
- [ ] `tsconfig.base.json` — ES2023 + NestJS decorator 호환
- [ ] README — 디자인 문서 링크 + 6단계 부팅 절차 + 9 서비스 포트 표
- [ ] `pnpm-workspace.yaml` — `simulations/enterprise-pm` + `simulations/enterprise-pm/services/*` 두 패턴 추가
- [ ] `pnpm install` 성공 + 기존 패키지 영향 없음
- [ ] 모노레포 root `package.json`에 `sim:*` 추가하지 않음 (격리 유지)
- [ ] Plan 09b/c/d가 본 plan 산출물 위에 올라갈 수 있도록 디렉토리 골격 완성

---

## Defer (본 plan 범위 외)

| 작업 | 이유 | 후속 plan |
|---|---|---|
| 9 NestJS 서비스 스캐폴딩 | 서비스 코드는 도메인 모델과 함께 추가하는 것이 응집도 높음 | Plan 10a/b/c |
| docker-compose.sim.yaml | 인프라 컨테이너 정의는 별도 plan | Plan 09c |
| .env.sim sops 암호화 | 환경 변수 + seed scaffolding은 별도 plan | Plan 09d |
| seed/seed.ts runner | 본 plan은 디렉토리만, 실제 seed runner는 별도 plan | Plan 09d |
| sim-doctor.sh | 통합 헬스체크는 시뮬 완성 후 | Plan 14b |
| 모노레포 root `package.json`에 `sim:up` proxy 추가 | sim 격리 원칙 — 사용자가 `cd simulations/enterprise-pm` 후 실행 | (defer 영구) |

---

## 의존·후속

- **선행**: 없음 (Phase 4 시뮬 시리즈의 첫 plan)
- **병렬 가능**: Plan 09b (DB schema + SERVICE_PORTS) — workspace 추가와 독립
- **후속**:
  - Plan 09c (docker-compose.sim.yaml) — 본 plan의 `simulations/enterprise-pm/` 디렉토리 위에 올림
  - Plan 09d (.env.sim + seed) — 본 plan의 `seed/.gitkeep` 자리에 추가
  - Plan 10 (NestJS 서비스 스캐폴딩) — `services/*` workspace 패턴 활용
