---
name: arch-governance
description: "qa-sdk 모노레포의 아키텍처 계층 정합성, API 영향도, 패키지 사용성 및 이벤트 신호 연결을 관리하고 분석한다."
---

# Architectural Governance — 아키텍처 수호 가이드

108개 이상의 패키지로 구성된 거대 모노레포의 아키텍처 질서를 유지하고 변경의 파장을 예측하기 위한 도구 세트.

## 0. 통합 피드백 루프 (추천)

코드 변경(논리 수정, 패키지 추가, API 변경 등) 후에는 반드시 다음 통합 루프를 실행하여 시스템 영향을 자가 진단한다.

```bash
pnpm arch:feedback
```

이 명령은 **Lint → Architectural Boundaries → API Impact** 3단계를 순차적으로 검증한다.

## 핵심 도구 가이드

### 1. 의존성 경계 검사 (`arch:check`)

시스템의 5계층(Foundation → Kernel → Logic → Bridge → Consumer) 원칙을 준수하는지 검사한다.

```bash
pnpm arch:check          # 위반 사항 요약 리포트
pnpm arch:check --json   # 기계 읽기용 데이터 출력
```

**가드레일 정책**: 하위 계층은 상위 계층을 절대 참조할 수 없다. 위반 발견 시 즉시 리팩토링한다. (TD-003: 2026-06-17 해소 — `demo-dkg-config`, `dkg-enrichment` 분리 + classifier 정정)

### 2. 미세 입도 API 영향도 분석 (`arch:impact`)

OpenAPI 스펙을 지도로 삼아, 수정된 파일이 어떤 엔드포인트에 영향을 주며 이를 사용하는 소비자(Scenario 등)가 어디인지 역추적한다.

```bash
pnpm arch:impact          # 시각적 영향도 리포트
pnpm arch:impact --json   # 상세 데이터 출력
```

**사용 시나리오**: 도메인 서비스 로직 수정 시, 이로 인해 깨질 수 있는 타 프로젝트의 시나리오를 미리 파악하여 선별적 테스트를 수행할 때 사용한다.

### 3. 패키지 사용성 및 건강 상태 분석 (`arch:usage`)

패키지별 내부 의존성 수(Fan-In)를 계산하여 핵심 인프라와 정리 대상을 식별한다.

```bash
pnpm arch:usage
```

- **Critical Infrastructure**: Fan-In >= 3인 모듈. 수정 시 파급력이 크므로 극도의 주의 필요.
- **Dead Weight**: 의존자가 0인 패키지. 아카이빙 또는 통합 검토 대상.
- **Skeletons**: 엔트리 포인트(`index.ts`)가 없는 빈 패키지.

### 4. 이벤트 신호 연결 분석 (`arch:signals`)

이벤트 카탈로그의 심볼(event_key)을 기반으로 물리적 의존성 없는 패키지 간의 암묵적 연결망을 분석한다.

```bash
pnpm arch:signals
```

### 5. 식별자 정합성 맵핑 (`arch:identity`)

데이터, 이벤트, UI, API, 서비스 경계면 간의 고유 식별자(ID)가 잘 매핑되어 있는지 교차 분석하여 'Identity Drift(식별자 표류)' 현상을 감지한다.

```bash
pnpm arch:identity
```

- **OpenAPI**: `operationId`
- **Service**: `apiId` (Access Control Port)
- **Event**: `eventName` (Outbox/Domain Event)
- **UI**: `data-action-id` (추후 도입 예정)

### 6. 거버넌스 관리 (`archi` CLI)

아키텍처 결정 사항(ADR)을 기록하고 시스템 지도를 관리한다.

```bash
archi status      # 거버넌스 문서 정합성 및 검증 통계
archi find <txt>  # 모델 및 문서 통합 검색
archi explore     # 아키텍처 계층 구조 트리 뷰
archi new session # 설계 결정 기록 생성
archi timeline    # 아키텍처 진화 이력 동기화
```

## AI 에이전트 작업 지침

1. **임팩트 우선**: `index-meta`, `weighted-index` 등 Fan-In이 높은 패키지 수정 전에는 반드시 `arch:usage`로 영향 범위를 먼저 파악한다.
2. **정합성 강제**: 모든 유의미한 변경 후에는 `arch:feedback`을 실행하고, 위반 사항이 발생하면 즉시 해결책을 제시한다.
3. **거버넌스 기록**: 아키텍처 구조 변경(계층 이동, 신규 경계 정의) 시에는 `archi new session`으로 기록을 남긴다.

참조: `architecture/docs/rules/architectural-governance-handbook.md`
