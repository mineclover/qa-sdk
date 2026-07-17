---
def:
  tier: component
  id: skill-arch-governance
  scope: constraint
  aspect: tech_constraint
  depth: specification
  lifecycle: approved
  layer: operation
  tags: [governance, architecture]
  links:
    - target: governance-skill-group
      type: refines
sources:
  - skills/arch-governance/SKILL.md
  - scripts/ai-feedback-loop.ts
  - scripts/check-dependency-boundaries.ts
  - scripts/api-impact-analyzer.ts
  - scripts/api-impact-collector.ts
  - scripts/api-impact-model.ts
  - scripts/api-impact-sources.ts
  - scripts/api-impact-ast.ts
  - scripts/api-impact-diff.ts
  - scripts/api-impact-consumers.ts
  - scripts/api-impact-policy.ts
  - scripts/api-impact-baseline.ts
  - scripts/api-impact-analyzer.test.ts
  - scripts/analyze-package-usage.ts
  - scripts/discover-event-flow.ts
  - scripts/verify-analysis-os.ts
---

# Skill — arch-governance

## 탐색 ^navigation

skill-catalog-system > governance-skill-group > **skill-arch-governance**

## 목적 ^purpose

모노레포의 계층 경계, API 영향도, package 사용성, 이벤트 신호 연결을 한 번에 점검하는 아키텍처 거버넌스 실행 정의를 가리킨다.

## 사용 맥락 ^context

package 추가, public API 변경, 의존성 방향 변경, 이벤트 연결 변경처럼 영향 범위가 넓은 작업의 전후에 사용한다. 통합 진입점은 `corepack pnpm arch:feedback`이다.

## 경계 ^boundary

실행 절차와 판단 기준은 `skills/arch-governance/SKILL.md`가 소유한다. 이 문서는 카탈로그 목적과 source authority만 기록하며, 각 분석기의 세부 출력 형식을 복제하지 않는다.

## 검증 ^validation

```bash
corepack pnpm skills:check
corepack pnpm arch:feedback
```
