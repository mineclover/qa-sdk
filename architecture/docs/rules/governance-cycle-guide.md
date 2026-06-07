---
id: RULE-GOV-CYCLE
type: InterfaceDefinitionDocument
title: "Architecture Governance Operational Cycle Guide"
date: 2026-06-04
scope: SCOPE-GOVERNANCE
lifecycle:
  state: active
  created_at: 2026-06-04
tags: ["governance", "guide", "workflow"]
---

# Governance Cycle Guide

이 문서는 `Architecture Definition Operating System`을 운영하기 위한 주기적 점검 및 추적 워크플로우를 정의합니다.

## 1. 정기 점검 루프 (Maintenance Loop) ^purpose

모든 설계 세션 또는 패키지 변경 후에는 다음 사이클을 실행하여 아키텍처 정합성을 유지합니다.

1. **상태 검사**: `bash scripts/maintenance.sh` 실행
   * Lint, 의존성 경계, API 매니페스트 재생성을 일괄 수행합니다.
2. **위반 조치**: 발견된 Tier Violation 또는 Lint 에러를 수정합니다.
   * 의도된 위반인 경우 `PENDING_WORK.md`의 [TD-xxx] 항목으로 등록합니다.
3. **매니페스트 갱신**: `docs/generated-api-manifest.json` 변경 사항을 검토합니다.

## 2. 의사결정 추적 및 영향도 분석 (Decision & Impact)

아키텍처 구조를 변경하거나 재정렬할 때는 다음 도구를 활용하여 변경의 정당성을 확보하고 사이드 이펙트를 참조합니다.

```bash
# 1. 아키텍처 검색 (Search/Reference)
# - 특정 기능이나 경계(Boundary)가 이미 정의되어 있는지 확인
node packages/archi/dist/index.js find "<pattern>"

# 2. 영향도 분석 (Impact Analysis)
# - 특정 패키지 변경 시 상/하방 의존성 및 아키텍처 계층 위반 확인
node packages/archi/dist/index.js impact <package-id>

# 3. 새 세션 문서 생성 및 기록
node packages/archi/dist/index.js new session --title "구조 변경 사유"
```

## 3. 계층 정합성 및 구조 변경 규칙 (Structure Rules)

`scripts/check-dependency-boundaries.ts`에 정의된 5계층 원칙을 준수합니다.

| 계층 | 설명 | 허용되는 의존 대상 |
|---|---|---|
| **Consumer** | 최종 앱, 서비스, 테스트 | Bridge, Logic, Kernel, Foundation |
| **Bridge** | SDK, 코덱, 클라이언트 | Logic, Kernel, Foundation |
| **Logic** | 엔진, 시뮬레이션, 복잡 로직 | Kernel, Foundation |
| **Kernel** | 메타데이터, 스펙, 모델 | Foundation |
| **Foundation** | 코어, 타입, 저수준 유틸 | (최하위) |

## 4. 자가 진단 리포트

주기적으로 `node packages/archi/dist/index.js status`를 실행하여 거버넌스 문서의 수명 주기 분포와 검증 통계를 확인하고 보고합니다.
