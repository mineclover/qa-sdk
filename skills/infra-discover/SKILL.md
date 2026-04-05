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
cd packages/infra-engine

# 전체 서비스 URL (env별)
pnpm exec tsx scripts/discover.ts --all dev
pnpm exec tsx scripts/discover.ts --all staging
pnpm exec tsx scripts/discover.ts --all prod

# 서비스 목록
pnpm exec tsx scripts/discover.ts --list

# 단일 서비스 조회
pnpm exec tsx scripts/discover.ts ingest-server dev
pnpm exec tsx scripts/discover.ts gate-service staging

# 심층 조회 (registry + definition 통합)
pnpm exec tsx scripts/discover.ts --deep ingest-server dev
# → URL + 문서(48건) + 테스트 건강도 + 소유 prefix 상세 + 환경별 URL

# 연결 코드 생성
pnpm exec tsx scripts/discover.ts --code ingest-server,gate-service dev
# → TypeScript export const + connectXxx() 함수 생성
```

## 출력 해석

### URL fallback 경고

```
URL: http://localhost:3400  ⚠ staging URL 미등록 — 기본 URL 사용 중
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

1. **다른 서비스에 연결할 때**: `discover.ts ingest-server staging` → staging URL 확인
2. **서비스 스펙 확인**: `discover.ts --deep gate-service dev` → 문서 17건, prefix 상세
3. **코드에 연결 정보 넣을 때**: `discover.ts --code ingest-server,gate-service dev` → import 가능한 코드
4. **전체 현황 파악**: `discover.ts --all prod` → prod 배포된 서비스 URL 맵
