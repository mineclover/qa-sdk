---
name: system-review
description: "시스템 전체 상태를 리뷰하고 평가. 트리거: '시스템 리뷰', '시스템 평가', 'self-check', '전체 진단', '시스템 상태', '건강 진단', 'system review'"
---

# 시스템 리뷰

DKG self-check + converge + metrics + overview를 종합 실행하고 결과를 요약한다.

## 실행 순서

### 1. Self-Check (빌드 + 테스트 + 커버리지 + 불변조건)

```bash
node packages/cli/dist/index.js dkg self-check
```

확인 항목:
- 빌드: 전 패키지 빌드 성공 여부
- 테스트: 전 패키지 테스트 통과 여부
- 커버리지: build_event/test_event entry 관측 비율
- 불변조건: DSL invariant 위반 여부
- 계약: export surface 검증

### 2. Convergence (수렴 분석)

```bash
node packages/cli/dist/index.js dkg converge
```

확인 항목:
- 배포 스큐 (critical/warning)
- 축 중복 (merge 후보)
- 시스템 건강 (constraint, domain, observation)

### 3. Metrics (지표 대시보드)

```bash
node packages/cli/dist/index.js dkg metrics
```

확인 항목:
- ok/warning/critical 분포
- 도메인별 건강 상태
- 스키마 위반

### 4. Overview (종합 대시보드)

```bash
node packages/cli/dist/index.js dkg overview
```

확인 항목:
- 서비스별 소유/소비 prefix
- 도메인 건강
- Hot Spots

### 5. Decision Flow 상태

```bash
pnpm --filter decision-flow typecheck && pnpm --filter decision-flow test
```

확인 항목:
- 테스트 전부 통과 (proof + evaluation + dev-decisions + monitor + context-provider)
- 자동 정책 동작 확인 (autoplan 6 principles + dev-decision policies)
- 모니터 알림 이상 여부

## 평가 프레임워크

| 영역 | 지표 |
|------|------|
| 정의 완성도 | axes + prefixes + DSL + constraints 통과율 |
| 테스트 신뢰도 | 전체 테스트 통과 + E2E 포함 |
| 관측 인프라 | 커버리지 % + 건전성 % |
| 폐루프 동작 | Observation → Decision 해소 비율 |
| 설계 추적성 | DKG 노드/엣지 수 + Obsidian 노트 수 |
| 의사결정 품질 | decision-flow 평균 confidence + 자동화 비율 + 컨텍스트 축적량 |

## 문제 발견 시

```bash
# 미해결 observation 확인
node packages/cli/dist/index.js dkg timeline --open

# 특정 문제 역추적
node packages/cli/dist/index.js dkg trace <nodeId>

# 문제 해소
node packages/cli/dist/index.js dkg resolve <obsId> --decision <decId> --outcome accepted
```
