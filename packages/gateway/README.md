# QA-SDK API Gateway

단일 진입점. 인증 + 서비스 라우팅. ADR-001 구현.

## 실행 모드

### 1. Node.js + Tailscale (권장)

```bash
# 게이트웨이 시작
cd packages/gateway
pnpm dev                    # http://localhost:8787

# Tailscale로 VPN 노출
tailscale serve --bg 8787   # https://<machine-name>.<tailnet>.ts.net
# 또는 외부 노출
tailscale funnel --bg 8787  # https://<machine-name>.<tailnet>.ts.net (public)
```

Tailscale 인증:
```bash
AUTH_MODE=tailscale pnpm dev
# Tailscale serve가 Tailscale-User-Login 헤더 자동 주입
# 게이트웨이가 해당 헤더로 사용자 식별
```

### 2. CF Worker

```bash
cd packages/gateway
pnpm dev:worker             # wrangler dev
pnpm deploy                 # wrangler deploy
```

### 3. Docker

```bash
docker compose up gateway
```

## 환경변수

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `AUTH_MODE` | `bypass` | `bypass` / `api-key` / `tailscale` / `cf-access` |
| `AUTH_API_KEYS` | — | api-key 모드: 쉼표 구분 키 목록 |
| `GATEWAY_PORT` | `8787` | 게이트웨이 포트 |
| `REGISTRY_URL` | `http://localhost:3300` | registry-service URL |
| `INGEST_URL` | `http://localhost:3200` | 직접 지정 (registry fallback) |

## 라우팅

| Path | Service | 설명 |
|------|---------|------|
| `/v1/ingest/*` | ingest-server | 이벤트 수집 |
| `/v1/traces/*` | ingest-server | trace 조회 |
| `/v1/sessions/*` | ingest-server | 세션 관리 |
| `/api/*` | registry-service | 카탈로그/서비스 관리 |
| `/dev/*` | registry-service | Dev Dashboard |
| `/gate/*` | gate-service | 상태 게이트 |
| `/query/*` | query-service | 정책 질의 |
| `/decode/*` | decode-service | 주소 디코딩 |
| `/health` | 게이트웨이 자체 | 헬스체크 |

## Tailscale 접근 구조

```
개발자 PC (Tailscale)
  ↓ WireGuard (100.x.x.x)
서버 (Tailscale + Gateway)
  ↓ tailscale serve :8787
게이트웨이 (localhost:8787)
  ↓ 프록시
내부 서비스 (3200/3300/3400/3500/3600)
```

### ACL 설정 (tailscale admin)

```json
{
  "acls": [
    { "action": "accept", "src": ["group:dev"], "dst": ["tag:qa-gateway:8787"] }
  ],
  "tagOwners": {
    "tag:qa-gateway": ["group:admin"]
  }
}
```

## CLI 연동

```bash
# Tailscale 네트워크 내에서
qa-sdk ingest health --ingest https://server.tailnet.ts.net

# registry 기반 자동 탐색
qa-sdk ingest services --registry https://server.tailnet.ts.net/api
```
