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

이 명령은 **Lint → Architectural Boundaries → API Impact → Analysis OS Accuracy** 4단계를 순차적으로 검증한다. 어떤 단계든 실패하면 non-zero로 종료한다.

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
pnpm arch:usage -- --json
```

- **Critical Infrastructure**: Fan-In >= 3인 모듈. 수정 시 파급력이 크므로 극도의 주의 필요.
- **Zero Fan-In**: repo 내부 의존자가 0인 패키지. 독립 앱, CLI/tool, contract/test suite, public library, archive 후보를 `disposition`으로 먼저 분리한다.
- **Archive Decision Candidates**: `zeroFanIn` 중 `archive-candidate` 항목이다. 이미 `no-promotion` surface로 격리된 quarantine/archive 결정 큐로 보고, 제품 core로 승격하지 않는다.
- **Dead Weight Candidates**: `zeroFanIn` 중 `needs-evidence` 항목이다. 유지 근거를 추가하거나 package boundary를 재판정한다. 0 fan-in 자체를 삭제 지시로 해석하지 않는다.
- **Missing Entrypoints**: conventional `src/index.ts`류 entrypoint가 없는 패키지. runtime service, browser app, test/contract suite, wasm package를 `disposition`으로 분리한다.
- **Entrypoint Gaps**: public/library surface인데 conventional entrypoint 근거가 약한 실제 조치 후보. 이 항목이 남을 때만 entrypoint 추가 또는 boundary 재판정이 필요하다.

판정 순서:

1. `arch:surfaces`로 모든 workspace package가 정확히 하나의 surface에 배정됐는지 확인한다.
2. `arch:usage -- --json`에서 `archiveCandidates`, `deadWeight`, `entrypointGaps`를 먼저 본다.
3. `zeroFanIn`과 `missingEntrypoints`는 사실 신호다. `disposition`을 확인한 뒤 독립 boundary 근거 또는 실제 정리 후보를 구분한다.
4. 예전 보조 스크립트인 `scripts/find-unused-candidates.ts`도 `arch:usage`에 위임되어야 하며, 별도 heuristics를 추가하지 않는다.

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

### 6. 분석 시스템 정확도 검증 (`arch:verify`)

분석 도구 자체가 현재 baseline을 제대로 증명하는지 확인한다.

```bash
pnpm arch:verify
```

- `arch:surfaces`: 전체 workspace package가 정확히 하나의 surface에 배정됐는지, taxonomy/profile 기능 surface가 다시 합쳐지지 않았는지 확인한다.
- `arch:signals`: 핵심 이벤트 연결이 유지되는지 확인한다.
- `arch:usage`: `zeroFanIn`, `archiveCandidates`, `deadWeight`, `missingEntrypoints`, `entrypointGaps` 분리가 현재 baseline과 맞는지 확인한다.
- `arch:check --json`: tier violation이 0건인지 확인한다.

### 7. 거버넌스 관리 (`archi` CLI)

아키텍처 결정 사항(ADR)을 기록하고 시스템 지도를 관리한다.

```bash
archi status      # 거버넌스 문서 정합성 및 검증 통계
archi find <txt>  # 모델 및 문서 통합 검색
archi explore     # 아키텍처 계층 구조 트리 뷰
archi new session # 설계 결정 기록 생성
archi timeline    # 아키텍처 진화 이력 동기화
```

## AI 에이전트 작업 지침

1. **임팩트 우선**: `index-meta`, `weighted-index` 등 Fan-In이 높은 패키지 수정 전에는 반드시 `arch:usage`로 영향 범위를 먼저 파악한다. 단, `zeroFanIn` 또는 `missingEntrypoints`는 그 자체로 정리 대상이 아니라 disposition 기반 후속 판정의 입력이다.
2. **정합성 강제**: 모든 유의미한 변경 후에는 `arch:feedback`을 실행하고, 위반 사항이 발생하면 즉시 해결책을 제시한다.
3. **거버넌스 기록**: 아키텍처 구조 변경(계층 이동, 신규 경계 정의) 시에는 `archi new session`으로 기록을 남긴다.

참조: `architecture/docs/rules/architectural-governance-handbook.md`
