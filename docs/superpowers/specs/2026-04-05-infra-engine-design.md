---
status: source-backed
sources:
  - docs/specs/infra-engine/infra-engine-pipeline.spec.md
  - docs/specs/infra-engine/infra-config-stage.spec.md
  - docs/specs/infra-engine/infra-provision-stage.spec.md
  - docs/specs/infra-engine/infra-register-stage.spec.md
  - docs/specs/infra-engine/infra-verify-stage.spec.md
  - docs/specs/infra-engine/infra-observe-stage.spec.md
  - packages/infra-engine/src/core/pipeline.ts
  - packages/infra-engine/src/config/config-stage.ts
  - packages/infra-engine/src/stages/provision-stage.ts
  - packages/infra-engine/src/stages/register-stage.ts
  - packages/infra-engine/src/verify/verify-stage.ts
  - packages/infra-engine/src/stages/observe-stage.ts
---

# 인프라 엔진 설계 문서

> 2026-04-05 작성

## 요약

qa-sdk 모노레포 내 `packages/infra-engine` 패키지로 구현하는 GitOps 기반 하이브리드 클라우드 배포 엔진.

## 핵심 결정

| 항목 | 결정 | 사유 |
|------|------|------|
| 위치 | `packages/infra-engine` | 모노레포 내 패키지로 기존 빌드/테스트 체계 활용 |
| 범위 | 애플리케이션 배포 중심 | VM/네트워크 프로비저닝은 별도 가이드 |
| 아키텍처 | 5단계 파이프라인 (접근법 C) | 범용 코어 + qa-sdk 어댑터로 깔끔한 경계 |
| 엔진 | Pulumi Automation API | 6개 프로바이더 통합 추상화 |
| 설정 SSOT | SOPS + KMS | 시크릿 + 일반설정 + 서비스 연결정보 통합 관리 |
| 모니터링 | ArgoCD 스타일 sync-loop | qa-sdk ingest/logging과 결합 |
| 품질 게이트 | 배포 라이프사이클 내 검증 | 필수/선택 게이트 분리, fail → rollback |

## 상세 스펙

파이프라인 중심 인덱스 구조로 `docs/specs/infra-engine/`에 배치:

| 스펙 | 역할 |
|------|------|
| [pipeline](../../../docs/specs/infra-engine/infra-engine-pipeline.spec.md) | **중심 인덱스** — 5단계 파이프라인 + 패키지 구조 |
| [config-stage](../../../docs/specs/infra-engine/infra-config-stage.spec.md) | SOPS 복호화 + zod 검증 |
| [provision-stage](../../../docs/specs/infra-engine/infra-provision-stage.spec.md) | Pulumi 실행 + S3 state |
| [register-stage](../../../docs/specs/infra-engine/infra-register-stage.spec.md) | registry-service 등록 + service-profile |
| [verify-stage](../../../docs/specs/infra-engine/infra-verify-stage.spec.md) | 헬스체크 + 품질 게이트 |
| [observe-stage](../../../docs/specs/infra-engine/infra-observe-stage.spec.md) | 배포 이벤트 emit + 모니터링 등록 |
| [providers](../../../docs/specs/infra-engine/infra-providers.spec.md) | 6개 프로바이더 추상화 |
| [adapters](../../../docs/specs/infra-engine/infra-adapters.spec.md) | qa-sdk 연동 어댑터 |
| [monitoring](../../../docs/specs/infra-engine/infra-monitoring.spec.md) | ArgoCD 스타일 모니터링 |
