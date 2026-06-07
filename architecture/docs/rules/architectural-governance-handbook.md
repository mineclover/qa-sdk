---
id: RULE-GOV-HANDBOOK
type: InterfaceDefinitionDocument
title: "Architectural Governance Handbook"
date: 2026-06-04
scope: SCOPE-GOVERNANCE
lifecycle:
  state: active
  created_at: 2026-06-04
tags: ["handbook", "cli", "guide", "workflow"]
---

# Architectural Governance Handbook

이 핸드북은 `qa-sdk` 프로젝트의 아키텍처 건전성을 유지하고 관리하기 위한 표준 도구와 워크플로우를 정의합니다.

## 👤 사용자 페르소나 (User Personas)

| 페르소나 | 주요 관심사 | 핵심 도구 |
|---|---|---|
| **아키텍트** | 시스템 계층 구조, 패키지 다이어트, 거버넌스 기록 | `archi status`, `arch:usage` |
| **개발자** | 신규 API 추가, 기능 리팩토링 영향도, 의존성 허용 여부 | `arch:impact`, `arch:check` |
| **AI 에이전트** | 코드 변경 시 즉각적인 아키텍처 정합성 피드백 | `arch:feedback` |

---

## 🛠️ 핵심 명령어 가이드 (Command Reference)

### 1. 통합 검증 및 피드백
| 명령어 | 용도 | 핵심 플래그 |
|---|---|---|
| `pnpm arch:feedback` | (추천) 변경 후 즉시 실행하는 통합 피드백 루프 | - |
| `pnpm arch:check` | 5계층 의존성 원칙 위반 여부 단독 검사 | `--json` |

### 2. 영향도 및 사용량 분석
| 명령어 | 용도 | 핵심 플래그 |
|---|---|---|
| `pnpm arch:impact` | 파일 변경이 미치는 API 및 소비자(Scenario) 역추적 | `--json` |
| `pnpm arch:usage` | 패키지별 사용량(Fan-In) 및 관리 상태 리포트 | - |
| `pnpm arch:signals` | 이벤트 심볼 기반의 암묵적 연결망 분석 | `--json` |
| `pnpm arch:identity` | UI, API, Service, Event 간의 식별자(ID) 정합성 맵핑 및 누락 감지 | `--json` |

### 3. 거버넌스 및 문서화 (`archi` CLI)
| 명령어 | 용도 |
|---|---|
| `archi status` | 아키텍처 거버넌스 문서 정합성 및 통계 리포트 |
| `archi find <p>` | 모델 요소 및 거버넌스 문서 통합 검색 |
| `archi explore` | 아키텍처 계층 구조 트리 뷰 탐색 |
| `archi new session` | 새로운 설계 결정(ADR) 기록 생성 |
| `archi timeline` | 아키텍처 진화 이력 동기화 |

---

## 📋 표준 유저 시나리오 (User Scenarios)

### 시나리오 A: 신규 패키지를 추가할 때
1.  **설계 검색**: `archi find`를 통해 유사한 기능의 패키지가 이미 있는지 확인합니다.
2.  **계층 결정**: `pkg-classifier.ts` 규칙에 따라 계층을 선정하고 `@def.boundary` 태그를 삽입합니다.
3.  **의존성 검증**: `pnpm arch:check`를 실행하여 선정한 계층에서 참조 가능한 패키지만 의존성으로 추가했는지 확인합니다.
4.  **등록**: `pnpm arch:manifest`를 실행하여 시스템 지도에 새 패키지를 등재합니다.

### 시나리오 B: 기존 도메인 로직을 리팩토링할 때
1.  **영향도 파악**: `pnpm arch:impact`를 실행하여 해당 파일을 수정했을 때 깨질 위험이 있는 API와 연결된 시나리오들을 파악합니다.
2.  **핵심도 확인**: `pnpm arch:usage`를 통해 이 패키지가 얼마나 많은 곳에서 쓰이는지 확인하여 테스트 강도를 결정합니다.
3.  **검증**: 수정 완료 후 `pnpm arch:feedback`이 모든 게이트를 통과하는지 확인합니다.

### 시나리오 C: 이벤트 기반 신호를 추가하거나 변경할 때
1.  **연결망 분석**: `pnpm arch:signals`를 실행하여 해당 이벤트 키를 사용 중인 모든 패키지 목록을 확보합니다.
2.  **커뮤니케이션**: 리스트업된 패키지 담당자들과 영향도를 공유합니다.

---

## 🛡️ 가드레일 정책 (Guardrail Policies)

1.  **Strict Tier Flow**: Foundation(1) → Kernel(2) → Logic(3) → Bridge(4) → Consumer(5) 순의 의존성만 허용합니다.
2.  **Zero Drift**: `arch:check` 위반 사항이 발생한 상태로 머지할 수 없습니다. (피치 못할 경우 TD-xxx로 등록 필수)
3.  **Always Tracked**: 모든 유의미한 설계 변경은 `archi new session`으로 기록되어야 합니다.
