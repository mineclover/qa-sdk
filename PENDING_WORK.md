# Pending Work — 2026-06-04

모노레포 상태 동기화 및 잔여 작업 정리. (Origin/main HEAD: `1894e331`)

## 1. 완료된 작업 (Completed)

- ✅ **PRD US-006~012 완료**: `tasks/prd-rlsc-screen-analysis-perspective-packages.json` 상의 당시 acceptance가 통과(`passes: true`)되었다. 이후 구현 소유권은 `pnpm-mcp`로 이동했으며, 현재 qa-sdk에는 `rlsc-analysis` public submodule과 `visbug-bridge` 통합만 유지한다. 현행 사용법은 `docs/guides/rlsc-usage-demo.md`를 따른다.
- ✅ **Lint debt sweep 완료**: `fix/ci-lint-error-sweep` 브랜치의 핵심 변경 사항(oxlint, unicorn, vi.mocked 등)이 이미 main에 머지 또는 체리픽됨. 현재 `pnpm run lint` 통과.
- ✅ **시나리오 9~17 sim-handles drift 해결**: `catalog-store` 핸들이 특정 버전(`v3`, `v4`)을 하드코딩하지 않고 토폴로지 내 모든 버전을 동적으로 반환하도록 수정됨.
- ✅ **시나리오 1~8 HTTP mode 구현 완료**: `wireSimHandles` 및 `createSimGatewayFetch`를 통한 HTTP shim 구현 완료. `SimHandle` 인터페이스 호환성 확보 및 유닛 테스트로 인증 전파/타임아웃 검증 완료.

## 2. 잔여 작업 (Pending)

### 2.1 Docker 컨테이너 Health 상태 복구 [Task #85]
- **상태**: 로컬 환경에 따라 Unhealthy 가능성 존재.
- **Unhealthy 케이스 (리포트 기준)**:
    - `infra-engine-qa-sdk-db-replica-1`: replication 검증 차단
    - `enterprise-pm-qa-sdk-ingest-1`: ingest 흐름 차단
- **조치**: Docker 데몬 접근 가능한 환경에서 로그 분석 및 재시작 필요.

### 2.3 로컬 브랜치 및 워크트리 정리 [Task #84]
- **정리 대상**:
    - 머지된 로컬 브랜치: `temp/pnpm-fix-clean`, `feat/rlsc-perspective-package`, `fix/sim-e2e-audit-recorder` 등 9건.
    - 작업 완료 워크트리: `.worktrees/sim-admin-endpoints`, `.worktrees/lint-sweep`.

## 3. 기술적 부채 (Technical Debt)

- **[TD-001] scenario 16/17 fault KIND 확장**: 현재 `perfWarn`, `pubsubInvalidate` fault가 controller `FaultKind` 정의에 부재하여 시뮬레이션 제약 존재.
- **[TD-002] evidence 멀티라인 처리**: commit 메시지 내 `evidence` 데이터의 줄바꿈 보존 로직 보강 필요.
- **[TD-003] 아키텍처 계층 정합성 개선** ✅ (2026-06-17): `arch:check` 9건 → 0건. `demo-dkg-config` / `dkg-enrichment` 분리, classifier 정정, spec-core convergence barrel 제거.
