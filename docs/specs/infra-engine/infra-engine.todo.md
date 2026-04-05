---
def:
  id: infra-engine-todo
  level: leaf
  scope: system
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

### 현재 규모
- **42 소스**, **21 테스트**, **107 테스트** (infra-engine 93 + cli-command 14)
- **15 CLI**, **4 skills**, **10 스펙**

---

## 잔여 작업

### 운영 통합

- [ ] **ingest-server K3s 실배포** — Docker 이미지 빌드 완료, K3s 배포 + 헬스체크 검증
- [ ] **CoordinateAdapter 좌표 인코딩** — demo-catalog WeightedIndex로 실인코딩 (현재 fail-open)
- [ ] **SOPS age 키 설정** — 키 생성 → sops.yaml → YAML 설정 암호화
- [ ] **webhook 알림** — Slack/Discord POST (OutOfSync/Unknown)

### 프로바이더 실구현

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
