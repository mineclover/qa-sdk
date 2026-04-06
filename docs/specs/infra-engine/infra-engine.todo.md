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

infra-engine 패키지의 잔여 작업을 추적한다. 구현 완료 항목은 spec에 반영됨.

---

## 구현 완료 요약

- 코어: 파이프라인 5단계 + 어댑터 8포트 (registry, gate, infra-profile, service-profile, ingest, coordinate, definition)
- 프로바이더: Local K3s (Pulumi) + Cloudflare Workers + 스텁 4종
- 디스커버리: DiscoveryClient + EnhancedDiscovery + FleetManager + Export 3종
- CLI: cli-command 트리 기반 라우터 + 17개 handler 모듈 → 33개 리프 명령
- 운영: destroy, history, dry-run, audit, config, Docker Compose, SyncLoop, Dashboard, auto-recovery, CI 골격
- 보안: validation.ts — ID/경로/PID/URL 검증 유틸 13건 (validateId, assertPathContainment, assertNoTraversal, isSafePid, isValidServiceUrl, isLocalhost)
- Docker: Dockerfile.nestjs 공용화 + PORT 주입 + layer cache + scope guard
- K3s: 9서비스 K8s 배포 (6 백엔드 + gateway + enrichment + Zitadel) + CF 2서비스
- 운영 개선: health_path 통일, motion-workspace 네이밍, sdk_version 동적, kubectl context 검증
- env 공급 안정화: config JSON → env vars 변환 (SKIP_KEYS: depends_on, gates, health_path)
- post-deploy 자동화: codegen (TS 모듈 + .env 재생성), cascade (depends_on 역추적), version-manager (JSON 영속 + rollback)
- --sync 플래그: `infra deploy --sync`로 배포 후 codegen + cascade 자동 실행
- 좌표: CoordinateAdapter Catalog 기반 실인코딩 (service/deploy_event/health_event, 13 tests)
- cli-command 트리 마이그레이션: scripts/infra.ts에서 cli-command 기반 트리 라우팅으로 전환
- tsup 7서비스 전환: NestJS 서비스 빌드를 tsup 단일 번들로 통일
- 보안: gateway JWKS 서명 검증 + route-permissions + enrichment-server + K8s DNS 서비스명 고정
- 좌표 실인코딩: CoordinateAdapter demo-catalog WeightedIndex 기반 실인코딩
- K8s Service DNS: Pulumi 서비스명 고정 (metadata.name 직접 지정, 랜덤 해시 제거)
- 권한 판정: hasBit() 실판정 (route-permissions.ts FEATURE_INDEX)
- 인증: Zitadel OIDC + SSO 로컬 배포 + JWT enrichment (JWKS RS256 + HS256)
- Gateway: JWKS 서명 검증 + HS256 검증 + permission middleware + route-level bitmask O(1)
- Enrichment: enrichment server (3 roles × 12 features, POST /token JWT 발급)
- Secrets: 자동 관리 — secrets 명령 3종 (show/init/rotate)
- 고급 테스트: 동시 배포 충돌, K8s DNS 라우팅, 장애 복구, 멀티 환경 동시 운영
- OIDC 브라우저: test/oidc-login.html — Zitadel authorization_code + PKCE 플로우 테스트

### 현재 규모

- **71 소스**, **220+ 테스트** (unit 106 + cli-command 23 + auth 57 + demo 37 + gateway 12 + advanced 24 + resilience 28 + login-flow 30)
- **33 CLI 명령**, **4 skills**, **13 스펙**
- **8 설정 파일** (test/dev/local/stage/prod/cloudflare-prod/test-nginx/test-nginx-v2)
- **배포**: K3s dev 9서비스 + CF prod 2서비스 = 11서비스
- **인프라**: Docker Compose (MinIO + Zitadel + CockroachDB) + K3s 클러스터

---

## 잔여 작업

### Workers 호환 (차단됨)

- [ ] **gate-service Workers 호환** — index-meta Workers 호환 해결 필요
- [ ] **query-service Workers 호환** — index-meta Workers 호환 해결 필요
- [ ] **decode-service Workers 호환** — index-meta Workers 호환 해결 필요

### 운영 통합

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
