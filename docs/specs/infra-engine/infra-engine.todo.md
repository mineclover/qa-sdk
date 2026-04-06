---
def:
  id: infra-engine-todo
  level: leaf
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: operation
  links:
    - target: infra-engine-pipeline
      type: refines
---

# Infra Engine — TODO

## 목적 ^purpose

infra-engine 패키지의 구현 현황과 잔여 작업을 추적한다.

---

## 구현 완료

### 코어
- [x] 파이프라인 실행기 (createPipeline, 순차+rollback)
- [x] 5단계 스테이지 (Config, Provision, Register, Verify, Observe)
- [x] 어댑터 6포트 실구현 (Registry, ServiceProfile, InfraProfile, Ingest, Coordinate, Gate)
- [x] IngestAdapter — TransmissionEnvelope + POST /v1/ingest 실호출
- [x] CoordinateAdapter — fail-open (축 데이터 미가용 → 빈 address_context)

### 프로바이더
- [x] Local K3s — Pulumi + K8s Deployment/Service + port-forward PID 관리
- [x] Cloudflare Workers — wrangler deploy 래핑 (registry-service, gateway 검증)
- [x] 프로바이더 스텁 4종 (Railway, AWS, GCP, Vultr)

### 디스커버리 + Fleet + Export
- [x] DiscoveryClient (resolve, resolveAll, generateConnectCode)
- [x] EnhancedDiscovery (registry + definition 통합, --deep)
- [x] DefinitionAdapter (서비스 문서/테스트/prefix 조회)
- [x] FleetManager (status, tier별 그룹핑, 헬스체크 실행 감지)
- [x] Export 3종 (env, ts, compose) + docs 요약
- [x] Fleet 일괄 배포 (deploy --all)

### CLI (cli-command 트리 기반)
- [x] 38줄 라우터 + 15개 handler 분리 (src/cli/cmd-*.ts)
- [x] cli-command 패키지 추출 (zero-dep, 14 tests)
- [x] 자동 help 생성 (트리 구조에서)

### 운영
- [x] destroy 명령 (Pulumi destroy + PF kill + 프로필 정리)
- [x] 배포 이력 (history, 최대 50건)
- [x] dry-run (Pulumi preview)
- [x] registry 감사 (infra audit)
- [x] 설정 프로필 관리 (infra config — local/local-s3/staging/prod)
- [x] Docker Compose 환경 (MinIO S3 + infra env up/down/status)
- [x] SyncLoop 모니터링 (monitor start/check/status)
- [x] DashboardData (dashboard summary/service/export)
- [x] 자동 복구 + SLA (auto-recovery, sla.ts)
- [x] CI/CD 워크플로우 골격 (.github/workflows/infra-deploy.yaml)

### 보안
- [x] 입력 검증 (serviceId, env, 경로) — src/lib/validation.ts
- [x] 경로 탐색 차단 (config 입력 + output 경로)
- [x] PID 검증 (isSafePid)
- [x] 원자적 JSON 쓰기 (write→tmp→rename)
- [x] minioadmin localhost 제한
- [x] URL 스키마 검증

### Docker 빌드
- [x] pino globalThis 타입 수정
- [x] core ir-audit/ir-bridge/test-tracking 타입 수정
- [x] Dockerfile pre-build 전략
- [x] k3d image import 성공

### K3s 실배포 (6서비스)
- [x] **ingest-server K3s 배포** — Docker 빌드 + k3d import + 배포 + 200 OK 검증 (:23200)
- [x] **decision-service K3s 배포** — Dockerfile.nestjs + NestJS 배포 + 200 OK 검증 (:23800)
- [x] **definition-service K3s 배포** — Dockerfile.nestjs + NestJS 배포 + 200 OK 검증 (:23700)
- [x] **motion-workspace-service K3s 배포** — Dockerfile.nestjs + NestJS 배포 + 200 OK 검증 (:23710)
- [x] **Dockerfile.nestjs 공용화** — SERVICE build-arg로 NestJS 3서비스 공유
- [x] **tsup 7서비스 전환** — 전 서비스 tsup 빌드 체인 통일
- [x] **6서비스 전체 200 OK 검증** — K3s 4 (ingest, decision, definition, motion-workspace) + CF 2 (registry, gateway)

### Dockerfile + 운영 개선 (2026-04-06)
- [x] **Dockerfile.nestjs PORT 주입** — `ARG PORT` + `ENV PORT` + `EXPOSE` 추가. HEALTHCHECK가 서비스 실제 포트 사용
- [x] **Docker layer cache 최적화** — lockfile/package.json 먼저 복사 → install → source 복사 순서
- [x] **Dockerfile scope guard** — `@qa-sdk/${SERVICE}` 실패 시 unscoped `${SERVICE}` fallback
- [x] **dev.json health_path 통일** — ingest-server에 `/health/live` 명시 (기본 `/health`과 불일치 해소)
- [x] **motion-workspace 네이밍 통일** — dev.json `motion-workspace-service` → `motion-workspace` (prod와 일치)
- [x] **sdk_version 동적 로드** — `adapters/ingest.ts` 하드코딩 `"1.0.0"` → `package.json` version 참조
- [x] **kubectl context 검증** — `local.ts validate()`에서 `k3d-qa-local` context 확인 추가

### 현재 규모
- **42 소스**, **93 테스트**, **107 테스트** (infra-engine 93 + cli-command 23)
- **15 CLI**, **4 skills**, **10 스펙**
- **배포 현황**: K3s dev 4서비스 + CF prod 2서비스 = 6서비스

---

## 잔여 작업

### Workers 호환 (차단됨)

- [ ] **gate-service Workers 호환** — index-meta Workers 호환 해결 필요
- [ ] **query-service Workers 호환** — index-meta Workers 호환 해결 필요
- [ ] **decode-service Workers 호환** — index-meta Workers 호환 해결 필요

### 운영 통합

- [ ] **CoordinateAdapter 좌표 인코딩** — demo-catalog WeightedIndex로 실인코딩 (현재 fail-open)
- [ ] **SOPS age 키 설정** — 키 생성 → sops.yaml → YAML 설정 암호화
- [ ] **webhook 알림** — Slack/Discord POST (OutOfSync/Unknown)

### 프로바이더 실구현

- [ ] **Cloudflare Pages** — 정적 사이트 배포 프로바이더
- [ ] **Railway** — `@pulumi/command` + Railway CLI
- [ ] **AWS** — `@pulumi/aws` ECS/Lambda + OIDC STS
- [ ] **GCP** — `@pulumi/gcp` Cloud Run + Workload Identity
- [ ] **Vultr** — `@ediri/vultr` K3s 컨테이너

### CI/CD

- [ ] **GitHub Actions 활성화** — OIDC, SOPS, config 변경 감지 → 자동 배포
- [ ] **S3 + DynamoDB 운영 State** — MinIO → AWS S3 전환
- [ ] **키 교체 스크립트** — rotate-keys.ts

### 고도화

- [ ] **Grafana 연동** — dashboard export → Grafana 데이터소스
