---
def:
  id: infra-auth-integration-todo
  tier: component
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: draft
  layer: mediation
  tags: [cross-scope]
  links:
    - target: infra-auth-integration
      type: refines
---

# AuthN/AuthZ 통합 — TODO

## 목적 ^purpose

인증/권한 통합의 잔여 작업을 추적한다. 설계는 `infra-auth-integration.spec.md`, 시나리오는 `infra-auth-usecases.cases.md` 참조.

> **원칙**: 설계는 spec, 시나리오는 usecases, 작업 추적은 todo로 분리한다. todo에 설계나 시나리오를 혼합하지 않는다.

---

## 완료 요약

| Phase | 소속 | 내용 |
|-------|------|------|
| P0 | gateway | JWKS RS256/HS256 서명 검증 + route-level bitmask 판정 |
| P1 | infra-engine, permission-engine | enrichment server + Zitadel Action + bitmask |
| P2~P2.7 | infra-engine | K8s DNS, 고급 시나리오 16건, OIDC 브라우저 |
| P3-0 | infra-engine | PAT 캡처 + Login V2 안정화 + IAM_LOGIN_CLIENT |
| P3-1 | infra-engine | Google OAuth IdP 연동 |
| P3-2 | permission-engine, infra-engine | 세션 종료 연동 (revokeZitadelSessions) |

---

## 잔여 작업

### GitHub OAuth IdP `[infra-engine]`

- [ ] Zitadel Console → Identity Providers → GitHub 등록
- [ ] GCP와 동일 패턴: OAuth App 생성 → redirect URI → Zitadel IdP 등록

### CI/CD `[infra-engine]`

- [ ] GitHub Actions 활성화 — OIDC, SOPS, config 변경 감지 → 자동 배포

---

## Zitadel 운영 참조

### 초기화 절차 (2026-04-08)

DB 리셋 후 재구축 전체 순서:

```bash
# 1. Zitadel 컨테이너 + DB 볼륨 삭제
docker compose -f docker-compose.infra.yaml down zitadel zitadel-login zitadel-nginx zitadel-db
docker volume rm infra-engine_zitadel-db-data infra-engine_zitadel-pat

# 2. PAT 볼륨 생성 + 권한 설정 (distroless 이미지는 non-root)
docker volume create infra-engine_zitadel-pat
docker run --rm -v infra-engine_zitadel-pat:/data alpine chmod 777 /data

# 3. DB → Zitadel 순서로 기동 (start-from-init이 PAT/MachineKey를 볼륨에 출력)
docker compose -f docker-compose.infra.yaml up -d zitadel-db
# DB healthy 대기 후
docker compose -f docker-compose.infra.yaml up -d zitadel
# "setup completed" 로그 확인 후 PAT 읽기
docker run --rm -v infra-engine_zitadel-pat:/data alpine cat /data/pat.txt

# 4. .env에 PAT 설정 → Login V2 + Nginx 기동
echo "ZITADEL_LOGIN_TOKEN=<PAT값>" > .env
docker compose -f docker-compose.infra.yaml up -d zitadel-login zitadel-nginx

# 5. machine user에 IAM_LOGIN_CLIENT 부여 (Login SPA 세션 API 권한)
curl -s -X PUT "http://localhost:8085/admin/v1/members/<MACHINE_USER_ID>" \
  -H "Authorization: Bearer <PAT>" \
  -H "Content-Type: application/json" \
  -d '{"roles": ["IAM_OWNER", "IAM_LOGIN_CLIENT"]}'

# 6. admin 비밀번호 리셋 (초기 비밀번호는 변경 강제됨 → API로 우회)
curl -s -X POST "http://localhost:8085/zitadel.user.v2.UserService/SetPassword" \
  -H "Authorization: Bearer <PAT>" \
  -H "Content-Type: application/json" \
  -d '{"userId": "<ADMIN_USER_ID>", "newPassword": {"password": "<새비밀번호>", "changeRequired": false}}'

# 7. Console 로그인 확인
#    http://localhost:8085/ui/console/
#    Username: admin@zitadel.localhost
```

### 주요 ID/토큰 (2026-04-08 리셋 기준)

| 항목 | 값 |
|------|-----|
| instance_id | 367611487822282756 |
| org_id | 367611487822348292 |
| machine user (qa-service) | 367611487822872580 |
| admin user | 367611487823069188 |
| PAT | `.env` 파일의 ZITADEL_LOGIN_TOKEN |
| admin username | admin@zitadel.localhost |

### 트러블슈팅 기록

| 증상 | 원인 | 해결 |
|------|------|------|
| PAT 볼륨 비어있음 | docker-compose에 PATPATH/MACHINEKEYPATH 미설정 | env var + 볼륨 마운트 추가 |
| machinekey.json permission denied | distroless 컨테이너가 non-root | 볼륨 chmod 777 |
| Login V2 unhealthy | ZITADEL_LOGIN_TOKEN 비어있음 | .env 파일에 PAT 설정 |
| "No matching permissions found" | machine user에 IAM_LOGIN_CLIENT 없음 | admin API로 role 추가 |
| "Could not create session" | 비밀번호 불일치 (초기 비밀번호 변경 강제) | v2 API SetPassword(changeRequired: false) |
| Google IdP redirect URI | Login V2는 `/idps/callback`, V1은 `/ui/login/login/externalidp/callback` | V2 경로 사용 |
