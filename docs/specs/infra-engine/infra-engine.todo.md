---
def:
  id: infra-engine-todo
  level: leaf
  tier: component
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: draft
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
- vitePfPlugin: Vite dev server pf-registry 자동 등록/해제 공식 플러그인
- pf-registry public API export (loadPfMap, registerPfEntry, removePfEntry)
- deployedWith: 부속 배포 관계 선언 (ServiceInfo.deployedWith) + FleetManager 상태 전파
- seed-config: shopping-web/platform-demo-api에 urls.prod CF 엔드포인트 등록
- CF 프로바이더 안정화: 비파괴적 롤백, 로컬 의존 스킵, warn-not-fail, --skip-verify, wrangler 경로 수정
- 엔드포인트 피드백 루프: resolve 체인 (config→profile→skip), 자동 config 피드백, 최초 배포 지원
- index-meta-workers: Workers/Edge 호환 서브셋 패키지 생성, 3서비스 마이그레이션 완료

### 현재 규모

- **65+ 소스** (infra-engine) + **7** (cli-command)
- **220+ 테스트** (unit 105 + demo 42 + auth 57 + advanced 16)
- **26 CLI 명령**, **4 skills**, **10+ 스펙**
- **배포**: 7 K8s pods + 3 Cloudflare Workers + Zitadel + MinIO
- **인프라**: Docker Compose (MinIO + Zitadel + CockroachDB) + K3s 클러스터

---

## 잔여 작업 (모두 외부 의존)

### Zitadel 운영 안정화 (해결됨)

- [x] **PAT 캡처** — docker-compose에 PATPATH/MACHINEKEYPATH 볼륨 마운트 추가
- [x] **Login V2 안정화** — .env에 ZITADEL_LOGIN_TOKEN 설정 → healthy
- [x] **admin 계정** — admin@zitadel.localhost (DB 리셋 2026-04-08)

### OAuth IdP

- [x] **Google OAuth 연동** — GCP 클라이언트 + Zitadel IdP 등록 + redirect URI(/idps/callback) 완료
- [ ] **GitHub OAuth 연동** — Zitadel Admin → Identity Providers

### Zitadel 세션 관리 (해결됨)

- [x] **ZitadelProvider 세션 종료** — enrichment /invalidate → revokeZitadelSessions() 연동 완료

### Workers 호환 (해결됨)

- [x] **index-meta-workers 패키지 생성** — Node.js 전용 드라이버 제외, D1 + 순수 로직만 포함
- [x] **gate-service Workers 호환** — worker.ts를 index-meta-workers로 마이그레이션
- [x] **query-service Workers 호환** — worker.ts를 index-meta-workers로 마이그레이션
- [x] **decode-service Workers 호환** — worker.ts를 index-meta-workers로 마이그레이션
- [x] **query-service migrationsFolder lazy init** — Workers URL 호환을 위한 지연 초기화
- [x] **CF Workers 3서비스 배포 완료** — decode(391 KiB), gate(292 KiB), query(810 KiB) gzip 포함

### CF 프로바이더 안정화 (해결됨)

- [x] **비파괴적 롤백** — CF provider `destroy()`가 verify 실패 시 Worker를 삭제하지 않고 유지. 명시적 삭제는 `explicitDestroyWorker()`로 분리
- [x] **로컬 의존 스킵** — `isRemoteEndpoint()` 체크로 localhost/127.0.0.1 의존을 verify에서 자동 스킵
- [x] **의존 warn-not-fail** — 원격 의존 서비스 미도달 시 fail 대신 warn 처리, 의존이 일시적으로 내려가도 배포 성공
- [x] **`--skip-verify` 옵션** — cmd-deploy.ts에 CF 배포용 verify 스킵 플래그 추가
- [x] **wrangler CLI 경로 수정** — validate()가 서비스 디렉토리(devDependency 위치)에서 wrangler 실행, `shell: true` 적용

### 엔드포인트 피드백 루프 (해결됨)

- [x] **엔드포인트 resolve 체인** — config.connections → service-profile → skip 순서로 해석
- [x] **자동 config 피드백** — 성공적 배포 후 발견된 endpoint를 cloudflare-prod.json에 자동 기록
- [x] **verify에서 service-profile 활용** — verify 단계가 serviceProfile을 받아 이전 배포의 의존 endpoint 해석
- [x] **최초 배포 지원** — 사전 설정 없는 서비스도 배포 후 자동 등록되어 다음 배포에서 참조 가능

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
