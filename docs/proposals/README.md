# Proposals (RFC)

이 디렉토리는 **정규 spec이 되기 전의 설계 제안**을 담는다. 기존 `docs/specs/` 트리의 규칙이나 좌표계 자체를 재설계하는 작업은 여기에서 먼저 성숙한 뒤 수락(accepted)되면 정규 spec으로 이식된다.

## 왜 격리하는가

- 메타-설계는 기존 규칙(def frontmatter/level/depth 등)을 **재정의 대상**으로 삼는다
- 재정의 대상이 되는 규칙을 스스로 따르면 재귀적 오염 발생
- 제안 단계 동안 규칙에 묶이지 않고 자유롭게 탐색할 surface가 필요

## 규칙

- 본 디렉토리의 모든 문서는 `def:` frontmatter를 **사용한다**. `def sync` 그래프에 포함되어 시스템적으로 관리된다.
- 최상위 문서 분류(D-19) 관점에서는 본 디렉토리의 모든 제안 문서는 `type: knowledge` 및 `knowledge_kind: proposal`로 분류된다.
- Frontmatter는 `def:` 블록과 함께 기존 메타데이터(`status`, `date` 등)를 유지한다.
- 내부 cross-ref는 **상대 경로 prose 링크**로 표기 (`[document](./01-doc.md)`)
- 정규 docs(`docs/specs/**`, `docs/plan/**`)에서 제안을 참조할 때도 **prose 링크만** 사용, `depends_on` 등 구조 링크 금지
- **실증 의무 (Empirical Validation):** 제안이 `accepted`로 넘어가기 전 (또는 Phase 3 Pilot 단계에서), 반드시 기존 시스템의 코드를 최소 1건 이상 섀도우(Shadow) 리팩토링하여 실제 적용 가능성을 증명해야 한다. (가상 예시만으로 검증 종료 금지)

## 제안 상태

| status | 의미 |
|--------|------|
| `draft` | 작성 중 |
| `under-review` | 검토 요청됨 |
| `accepted` | 수락됨 — 정규 spec으로 이식 대기 |
| `implemented` | 정규 spec으로 이식 완료, 본 문서는 역사 기록 |
| `superseded` | 다른 제안으로 대체됨 |
| `rejected` | 기각됨 |

## 수락 → 이식 패턴

```
[draft/under-review]   docs/proposals/<topic>/
                       - 자유로운 탐색, 정규 spec 영향 없음
                             ↓ (accepted)
[implementation]       docs/specs/<area>/<rule>.spec.md 신규
                       + 기존 문서 점진 전환 PRD
                             ↓ (implemented / rejected)
[archive]              docs/proposals/archive/<topic>/
                       - 물리적 아카이빙 폴더로 이동하여 루트 혼잡 방지
                       - superseded_by: <정규 spec 경로> 표기
                       - 본문 수정 금지 (역사 기록 고정)
```

## 현재 열린 제안

| 제안 | 상태 | 요약 |
|------|------|------|
| [bdd-contract-system](./bdd-contract-system/) | `draft` | BDD Given/When/Then을 AI-DLC 행동 계약으로 정의하고 test unit / implementation unit / ScenarioSpec / PipeGraph / docs CLI 소비 표면을 기계화 |
| [ai-dlc-dspy-harness](./ai-dlc-dspy-harness/) | `draft` | DSPy를 시스템 단위로 탈부착 가능한 sidecar harness로 도입하고, 계약/증거/게이트만 기존 문서 시스템에 편입 |
| [tier-redesign](./tier-redesign/) | `under-review` | 4-tier(Component/Entry/System/Layout) 좌표계 및 이중 평면(Intent/Execution) 거버넌스 재설계 |
| [domain-hierarchy](./domain-hierarchy/) | `under-review` | 시스템의 도메인 소속을 링크 그래프에서 파생해 duplicate-coordinate 경고 해소 + proposals 문서 관리체계 편입 |
| [aspect-vocab-split](./aspect-vocab-split/) | `under-review` | aspect 어휘 분할 RFC — 잔여 Class D duplicate-coordinate 그룹 해소 (func_def / process_flow / api_contract / domain_data 세분화) |
