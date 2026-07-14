---
name: infra-discover
description: "서비스 디스커버리 — 서비스 연결정보, 문서, 테스트 상태, prefix 상세를 조회한다. 트리거: /infra-discover, '서비스 찾기', '서비스 URL', '연결 정보', 'service discovery'."
---

# Infra Discover — 서비스 디스커버리

서비스의 연결 정보(URL, port, env별 엔드포인트)와 문서/테스트/prefix 상세를 조회한다.

## 사전 조건

- registry-service 실행 중 (localhost:3300)
- definition-service 실행 중 (localhost:3700) — `--deep` 모드에 필요

## 명령

```bash
# 전체 서비스 URL (env별)
corepack pnpm --filter infra-engine infra discover --all dev
corepack pnpm --filter infra-engine infra discover --all stage
corepack pnpm --filter infra-engine infra discover --all prod

# 서비스 목록
corepack pnpm --filter infra-engine infra discover --list

# 단일 서비스 조회
corepack pnpm --filter infra-engine infra discover ingest-server dev
corepack pnpm --filter infra-engine infra discover gate-service stage

# 심층 조회 (registry + definition 통합)
corepack pnpm --filter infra-engine infra discover --deep ingest-server dev
# → URL + 문서(48건) + 테스트 건강도 + 소유 prefix 상세 + 환경별 URL

# 연결 코드 생성
corepack pnpm --filter infra-engine infra discover --code ingest-server,gate-service dev
# → TypeScript export const + connectXxx() 함수 생성

# 로컬 port 확인 (K3s port-forward + ad-hoc dev server)
corepack pnpm --filter infra-engine infra pf list
corepack pnpm --filter infra-engine infra pf register viz-web 5201 --service viz-web --kind dev-server
```

통합 CLI가 현재 SSOT 진입점이다. `packages/infra-engine/scripts/discover.ts`를 직접 실행하는 예전 방식은 새 명령 트리와 옵션이 어긋날 수 있으므로 사용하지 않는다.

## 출력 해석

### URL fallback 경고

```
URL: http://localhost:3400  ⚠ stage URL 미등록 — 기본 URL 사용 중
```

해당 env의 URL이 registry에 없어서 기본 URL을 반환. registry-service에서 해당 env URL 등록 필요.

### 테스트 건강도 (--deep)

| 표시 | 의미 |
|------|------|
| ✅ pass | 모든 테스트 통과 |
| ❌ fail | 실패 테스트 존재 |
| ⬜ 데이터 없음 | definition-service에 테스트 결과 미등록 |

### 소유 Prefix (--deep)

서비스가 생산하는 이벤트 prefix와 차원 정보:
```
pipeline_point  파이프라인 관측 포인트 (observation [svc_ref, pipeline_phase, ...])
```

## 활용 시나리오

1. **다른 서비스에 연결할 때**: `infra discover ingest-server stage` → stage URL 확인
2. **서비스 스펙 확인**: `infra discover --deep gate-service dev` → 문서 17건, prefix 상세
3. **코드에 연결 정보 넣을 때**: `infra discover --code ingest-server,gate-service dev` → import 가능한 코드
4. **전체 현황 파악**: `infra discover --all prod` → prod 배포된 서비스 URL 맵
5. **로컬 UI 포트 확인**: `infra pf list` → 현재 활성 local endpoint 확인
