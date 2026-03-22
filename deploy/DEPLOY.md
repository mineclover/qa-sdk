# QA-SDK 배포 가이드

## 아키텍처 개요

```
┌─ 정적 프론트엔드 ──────────────────────────┐
│  shop-web        (데모 쇼핑몰)       :8080  │
│  platform-demo   (모니터링 + 다이어그램) :8081│
└─────────────────────────────────────────────┘
         │ CORS / API 호출
         ▼
┌─ 백엔드 서비스 ────────────────────────────┐
│  ingest-server    (이벤트 수집)      :3200  │  ← PostgreSQL + Redis(선택)
│  registry-server  (스키마 메타데이터)  :3100  │  ← PostgreSQL
│  registry-service (카탈로그 관리)     :3300  │  ← SQLite(선택)
│  gate-service     (권한 체크)        :3400  │  ← SQLite(선택)
│  query-service    (권한 질의)        :3500  │  ← SQLite(선택)
│  decode-service   (주소 디코딩)      :3600  │  ← stateless
│  worker           (비동기 처리)       —     │  ← Redis
└─────────────────────────────────────────────┘
         │
┌─ 데이터 ───────────────────────────────────┐
│  PostgreSQL 16   (이벤트 + 스키마 저장)      │
│  Redis 7         (태스크 큐, 선택)           │
└─────────────────────────────────────────────┘
```

## 관리 포인트 요약

배포 시 관리해야 할 설정은 **3가지 종류**로 분류된다.

### A. 프론트엔드 — `config.js` (2개 파일)

| 파일 | 대상 | 관리 항목 |
|------|------|----------|
| `shop-web/public/config.js` | 데모 쇼핑몰 | `INGEST_URL`, `REGISTRY_URL`, `ENV`, `REGION` |
| `platform-demo/public/config.js` | 모니터링 툴 | `INGEST_URL`, `REGISTRY_URL`, `WS_URL`, `DASHBOARD_URL` |

- 프로덕션 템플릿: `deploy/config.shop-web.prod.js`, `deploy/config.platform-demo.prod.js`
- 교체 방법: Docker 볼륨 마운트 또는 Cloudflare Pages 빌드 시 파일 교체
- query parameter (`?ingest=...`) 가 config.js보다 우선
- **nginx에서 캐싱 제외** — 배포 후 즉시 반영

### B. 백엔드 — 환경변수 (서비스별 `.env`)

#### 필수 (데모 최소 구성)

| 변수 | 서비스 | 설명 |
|------|--------|------|
| `TRACE_DATABASE_URL` | ingest-server | PostgreSQL 연결 URL (미설정 시 in-memory, 데모용) |
| `DATABASE_URL` | registry-server | PostgreSQL 연결 URL |
| `CORS_ORIGIN` | 전체 백엔드 | 허용 origin (`*` 또는 프론트엔드 도메인) |

#### 선택 (기능 활성화 시)

| 변수 | 서비스 | 조건 |
|------|--------|------|
| `REDIS_URL` | ingest-server | `TASK_QUEUE_ENABLED=true` 시 필수 |
| `CONVERGENCE_ENABLED` | ingest-server | 관측 루프 활성화 |
| `DEV_DASHBOARD_ENABLED` | registry-service | 개발자 대시보드 활성화 |
| `CONSTRAINT_GATE_ENABLED` | registry-service | 활성화 게이트 사용 |
| `SQLITE_PATH` | registry-service, gate, query | 영구 저장 (기본: `:memory:`) |

### C. 인프라 — Docker / 플랫폼 설정

| 항목 | 파일 | 설명 |
|------|------|------|
| 포트 매핑 | `.env` | `*_PORT` 변수들 |
| 볼륨 | `docker-compose.yml` | `pgdata`, `*-data` (SQLite 영속) |
| 프로필 | `docker compose --profile` | `frontend`, `backup` |
| 헬스체크 | 각 Dockerfile | `/health/live` 또는 `/health` |

---

## 배포 시나리오별 가이드

### 시나리오 1: Docker Compose 단일 호스트 (가장 간단)

```bash
# 1. 환경변수 준비
cp .env.example .env
# .env에서 POSTGRES_PASSWORD 등 변경

# 2. 프론트엔드 config.js 프로덕션용 준비
cp deploy/config.shop-web.prod.js deploy/config.shop-web.live.js
cp deploy/config.platform-demo.prod.js deploy/config.platform-demo.live.js
# *.live.js에서 URL을 실제 도메인으로 수정

# 3. .env에서 config 경로 지정
# SHOP_WEB_CONFIG=./deploy/config.shop-web.live.js
# PLATFORM_DEMO_CONFIG=./deploy/config.platform-demo.live.js

# 4. 전체 기동
docker compose --profile frontend up --build -d

# 5. 헬스체크 확인
curl http://localhost:3002/health/live   # ingest-server
curl http://localhost:3001/health/live   # registry-server
curl http://localhost:3300/health/live   # registry-service
curl http://localhost:8080/health        # shop-web
curl http://localhost:8081/health        # platform-demo
```

### 시나리오 2: Cloudflare Pages (프론트엔드) + Railway (백엔드)

#### 프론트엔드 — Cloudflare Pages

```bash
# shop-web: 정적 파일 직접 배포
# Pages 프로젝트 생성 → Build command: (없음) → Output directory: packages/shop-web/public

# platform-demo: Vite 빌드 후 배포
# Pages 프로젝트 생성 → Build command: pnpm install && pnpm --filter platform-demo build
# Output directory: packages/platform-demo/dist
```

관리 포인트:
- `config.js` — 각 패키지의 `public/config.js`를 프로덕션 URL로 수정 후 커밋
- `_redirects` — `platform-demo/public/_redirects`에서 API 프록시 URL 수정

#### 백엔드 — Railway

각 서비스를 별도 Railway 서비스로 배포:

```
# ingest-server
Railway Service → Dockerfile: Dockerfile.ingest-server
Environment:
  TRACE_DATABASE_URL=<Railway PostgreSQL URL>
  PORT=3200
  CORS_ORIGIN=https://shop.your-domain.com
  TASK_QUEUE_ENABLED=false   # Redis 미사용 시

# registry-server
Railway Service → Dockerfile: Dockerfile.registry-server
Environment:
  DATABASE_URL=<Railway PostgreSQL URL>
  PORT=3100
  CORS_ORIGIN=https://demo.your-domain.com

# registry-service
Railway Service → Dockerfile: Dockerfile.services, Start command: node packages/registry-service/dist/server.js
Environment:
  PORT=3300
  CORS_ORIGIN=https://demo.your-domain.com
  DEV_DASHBOARD_ENABLED=true
```

### 시나리오 3: 최소 데모 구성

모니터링 데모 목적이라면 전체 서비스가 불필요:

```bash
# 필수 서비스만 기동
docker compose up postgres ingest-server registry-service --build -d

# 프론트엔드
docker compose --profile frontend up shop-web platform-demo --build -d
```

| 서비스 | 필수 | 이유 |
|--------|------|------|
| PostgreSQL | 필수 | ingest-server 이벤트 저장 |
| ingest-server | 필수 | shop-web 이벤트 수집 |
| registry-service | 필수 | platform-demo API (다이어그램, 카탈로그) |
| registry-server | 선택 | 스키마 검증 (없어도 warn 모드로 통과) |
| gate/query/decode | 선택 | 권한 체크 (데모에 불필요) |
| Redis | 선택 | TASK_QUEUE_ENABLED=false면 불필요 |
| worker | 선택 | Redis 없으면 불필요 |

---

## 파일 구조

```
deploy/
├── DEPLOY.md                         # 이 문서
├── nginx.conf                        # 정적 사이트 nginx 설정
├── config.shop-web.prod.js           # shop-web 프로덕션 config 템플릿
└── config.platform-demo.prod.js      # platform-demo 프로덕션 config 템플릿

Dockerfile.ingest-server              # ingest-server 컨테이너
Dockerfile.registry-server            # registry-server 컨테이너
Dockerfile.services                   # registry-service, gate, query, decode 공용
Dockerfile.static                     # shop-web, platform-demo 정적 사이트 공용
docker-compose.yml                    # 전체 오케스트레이션
.env.example                          # 환경변수 템플릿
.dockerignore                         # Docker 빌드 제외 패턴
```

---

## 프론트엔드 config.js 상세

### 우선순위 (높은 순)

```
query parameter (?ingest=...)  >  config.js  >  하드코딩 기본값
```

### shop-web config.js

```javascript
window.__QA_CONFIG__ = {
  INGEST_URL: "https://ingest.example.com",   // 이벤트 전송 대상
  REGISTRY_URL: "https://registry.example.com", // (현재 미사용, 향후 확장)
  ENV: "prod",                                 // 서비스 환경 (좌표 차원)
  REGION: "asia",                              // 서비스 리전 (좌표 차원)
};
```

### platform-demo config.js

```javascript
window.__QA_CONFIG__ = {
  INGEST_URL: "https://ingest.example.com",        // 트레이스 API
  REGISTRY_URL: "https://registry.example.com",     // 카탈로그/다이어그램 API
  WS_URL: "wss://ingest.example.com/v1/ws",         // 모니터 실시간 WebSocket
  DASHBOARD_URL: "https://registry.example.com/dev/", // Dev Dashboard 링크
};
```

### 교체 방법

| 방법 | 사용 시점 |
|------|----------|
| Docker 볼륨 마운트 | `docker run -v ./config.prod.js:/usr/share/nginx/html/config.js` |
| CI 파일 교체 | 빌드 파이프라인에서 `cp deploy/config.*.prod.js → config.js` |
| 직접 수정 후 커밋 | Cloudflare Pages 등 git 기반 배포 |

---

## CORS 설정 상세

### 환경변수

```bash
CORS_ORIGIN=*                                    # 개발: 모든 origin 허용
CORS_ORIGIN=https://shop.example.com             # 프로덕션: 단일 도메인
```

### 적용 서비스

| 서비스 | env.ts | app.ts | 비고 |
|--------|--------|--------|------|
| ingest-server | `CORS_ORIGIN` | `cors({ origin })` | |
| registry-server | `CORS_ORIGIN` | `cors({ origin })` | 신규 추가 |
| registry-service | `CORS_ORIGIN` | `cors({ origin })` | |
| gate/query/decode | — | `cors()` 그대로 | 내부 서비스, 외부 노출 안 함 |

---

## 헬스체크 엔드포인트

| 서비스 | 엔드포인트 | 응답 |
|--------|-----------|------|
| ingest-server | `GET /health/live` | `{ status: "ok" }` |
| registry-server | `GET /health/live` | `{ status: "ok" }` |
| registry-service | `GET /health/live` | `{ status: "ok" }` |
| gate-service | `GET /health` | `{ status: "ok" }` |
| query-service | `GET /health` | `{ status: "ok" }` |
| decode-service | `GET /health` | `{ status: "ok" }` |
| shop-web (nginx) | `GET /health` | `ok` (plain text) |
| platform-demo (nginx) | `GET /health` | `ok` (plain text) |

---

## 서비스 기동 순서

```
1. PostgreSQL        (healthcheck: pg_isready)
2. Redis             (healthcheck: redis-cli ping) — 선택
3. migrations        (depends: postgres) — 1회 실행 후 종료
4. registry-server   (depends: postgres, migrations)
5. ingest-server     (depends: postgres, redis, migrations, registry-server)
6. worker            (depends: postgres, redis, migrations) — 선택
7. registry-service  (독립)
8. gate-service      (독립)
9. query-service     (depends: gate-service)
10. decode-service   (독립)
11. shop-web         (독립, profile: frontend)
12. platform-demo    (독립, profile: frontend)
```

---

## 체크리스트

### 배포 전

- [ ] `.env` 파일 생성 (`cp .env.example .env`)
- [ ] PostgreSQL 비밀번호 변경 (`POSTGRES_PASSWORD`)
- [ ] `CORS_ORIGIN`을 프론트엔드 도메인으로 제한
- [ ] 프론트엔드 `config.js`에 실제 백엔드 URL 기입
- [ ] `_redirects` (Cloudflare Pages 사용 시) URL 확인

### 배포 후

- [ ] 모든 헬스체크 엔드포인트 200 확인
- [ ] shop-web에서 이벤트 발생 → ingest-server 수신 확인
- [ ] platform-demo 모니터에서 WebSocket 연결 확인
- [ ] platform-demo 다이어그램에서 프리셋 로드 확인
