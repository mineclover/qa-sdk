---
name: infra-status
description: "인프라 상태 조회 — Fleet 서비스 상태, 배포/실행 현황, tier별 그룹핑. 트리거: /infra-status, '인프라 상태', 'fleet status', '배포 현황'."
---

# Infra Status — Fleet 상태 조회

모든 서비스의 배포/실행 상태를 tier별로 한눈에 확인한다.

## 사전 조건

- registry-service 실행 중 (localhost:3300)

## 명령

```bash
cd packages/infra-engine

# dev 환경 상태
pnpm exec tsx scripts/export.ts status dev

# staging 환경 상태
pnpm exec tsx scripts/export.ts status staging

# prod 환경 상태
pnpm exec tsx scripts/export.ts status prod
```

## 출력

```
=== Fleet Status (dev) ===

  총: 23  배포됨: 0  실행중: 4

  [backend]
    ⬜ pending  platform-demo-api          http://localhost:8787
    🟢 running  motion-workspace-service   http://localhost:3710
  [infra]
    🟢 running  registry-service           http://localhost:3300
    🟢 running  definition-service         http://localhost:3700
    ⬜ pending  ingest-server              http://localhost:3200
  [frontend]
    ⬜ pending  shopping-web               http://localhost:5220
```

## 상태 아이콘

| 아이콘 | 의미 | 조건 |
|--------|------|------|
| ✅ | deployed | infra-engine으로 배포됨 (infra-profile에 기록) |
| 🟢 | running | 배포 기록 없지만 헬스체크 응답 (로컬 실행 중) |
| ⬜ | pending | 배포 안 됨 + 미실행 |

## 활용

1. **어떤 서비스가 떠있는지 확인**: `status dev` → 🟢 running 서비스 확인
2. **배포 필요한 서비스 파악**: `status staging` → ⬜ pending 서비스가 배포 대상
3. **환경별 비교**: `status dev` vs `status prod` → 환경 간 서비스 차이 확인
