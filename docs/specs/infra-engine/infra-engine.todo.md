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
- tsup 7서비스 전환: NestJS 서비스 빌드를 tsup 단일 번들로 통일 (tsup ^8.5.1)
- 보안: gateway JWKS 서명 검증 + route-permissions + enrichment-server + 보안 13건 수정
- 좌표 실인코딩: CoordinateAdapter demo-catalog WeightedIndex 기반 실인코딩
- K8s Service DNS: Pulumi 서비스명 고정 (metadata.name 직접 지정, 랜덤 해시 제거)
- 권한 판정: hasBit() 실판정 (route-permissions.ts FEATURE_INDEX 12종)
- 인증: Zitadel OIDC + SSO 로컬 배포 + JWT enrichment (JWKS RS256 + HS256)
- Zitadel Login V2: SPA 배포 (zitadel + zitadel-login + nginx 3-컨테이너)
- Gateway: JWKS 서명 검증 + HS256 이중 검증 + permission middleware + route-level bitmask O(1)
- Enrichment: enrichment server (3 roles × 12 features, POST /token — Zitadel 검증 → HS256 JWT 발급)
- Secrets: 자동 관리 — secrets 명령 3종 (show/init/rotate)
- 고급 테스트: 동시 배포 충돌, K8s DNS 라우팅, 장애 복구, 멀티 환경 동시 운영 (16건)
- OIDC 브라우저: test/oidc-login.html + test-oidc-browser.ts — Zitadel authorization_code + PKCE 플로우 테스트
- AuthZ 라이프사이클: grant/revoke/override/invalidate/explain 57건
- 운영 데모: 42건 E2E
- cli-command 패키지: 트리 마이그레이션 완료

### 현재 규모

- **65+ 소스** (infra-engine) + **7** (cli-command)
- **220+ 테스트** (unit 105 + demo 42 + auth 57 + advanced 16)
- **26 CLI 명령**, **4 skills**, **10+ 스펙**
- **배포**: 7 K8s pods + 2 Cloudflare + Zitadel + MinIO
- **인프라**: Docker Compose (MinIO + Zitadel + CockroachDB) + K3s 클러스터

---

## 잔여 작업 (모두 외부 의존)

### OAuth IdP

- [ ] **Google OAuth 연동** — Zitadel Admin → Identity Providers
- [ ] **GitHub OAuth 연동** — Zitadel Admin → Identity Providers

### Zitadel 세션 관리

- [ ] **ZitadelProvider 세션 종료** — 사용자 비활성화 시 세션 종료 + 토큰 무효화

### Workers 호환 (차단됨)

- [ ] **gate-service Workers 호환** — index-meta Workers 호환 해결 필요
- [ ] **query-service Workers 호환** — index-meta Workers 호환 해결 필요
- [ ] **decode-service Workers 호환** — index-meta Workers 호환 해결 필요

### 프로바이더 실구현

- [ ] **Railway** — `@pulumi/command` + Railway CLI
- [ ] **AWS** — `@pulumi/aws` ECS/Lambda + OIDC STS
- [ ] **GCP** — `@pulumi/gcp` Cloud Run + Workload Identity
- [ ] **Vultr** — `@ediri/vultr` K3s 컨테이너

### CI/CD

- [ ] **GitHub Actions 활성화** — OIDC, SOPS, config 변경 감지 → 자동 배포
- [ ] **S3 + DynamoDB 운영 State** — MinIO → AWS S3 전환

### 고도화

- [ ] **Grafana 연동** — dashboard export → Grafana 데이터소스
- [ ] **webhook 알림** — Slack/Discord POST (OutOfSync/Unknown)
