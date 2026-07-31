# Feedback Register

## 목적 ^purpose

검토·운영·사용 중 발견한 피드백을 intake부터 triage, 후속 spec 승격까지 추적하는 운영 index다.

검토·운영·사용 중 발견한 피드백을 한 곳에서 intake와 triage로 관리한다. 이 폴더는
구현 또는 계약의 SSOT가 아니다. 승인된 변경의 설계·행동 계약은 `docs/specs/`와
코드·테스트로 승격한다.

## 운영 원칙

- 모든 feedback 파일은 이 `docs/feedback/` 폴더에만 둔다. 주제별 하위 폴더는 만들지 않는다.
- 파일명은 `YYYY-MM-DD-<topic>.feedback.md`를 사용한다.
- 각 항목은 상태, 우선순위, 근거, 다음 결정 또는 작업을 포함한다.
- `accepted`는 문제와 개선 방향에 합의했다는 뜻이며 구현 완료를 뜻하지 않는다.
- 해결 뒤에는 feedback 원문을 지우지 않고 `resolved` 또는 `superseded` 상태와 후속 spec/PR을 기록한다.
- speculative idea는 `proposed`, 구현 대상으로 확정한 문제는 `accepted`, 지금 하지 않기로 한 것은 `deferred` 또는 `rejected`로 둔다.

## 상태

| 상태 | 의미 |
|---|---|
| `proposed` | 관찰은 있으나 문제·범위 합의 전 |
| `accepted` | 개선 대상으로 채택, 설계 또는 구현 대기 |
| `in-progress` | 연결된 spec/plan/구현이 진행 중 |
| `deferred` | 필요성은 인정하지만 우선순위 또는 선행 조건 때문에 보류 |
| `resolved` | 후속 변경으로 해소됨 |
| `superseded` | 더 구체적인 feedback 또는 결정으로 대체됨 |
| `rejected` | 근거 검토 후 진행하지 않기로 결정 |

## 목록

| ID | 상태 | 우선순위 | 주제 |
|---|---|---|---|
| FB-2026-07-27-01 | accepted | P1 | [문서 검증 evidence 수집·판정 구조](./2026-07-27-definition-verification.feedback.md) |
| FB-2026-07-27-02 | in-progress | P0 | [spec-management platform의 qa-sdk 분리](./2026-07-27-spec-management-platform-extraction.feedback.md) |
| FB-2026-07-31-03 | deferred | P1/P2 | [self-check 잔여 metric의 실행 근거·설계 판단](./2026-07-31-analysis-runtime-evidence.feedback.md) |

## 승격 규칙

feedback이 다음 중 하나를 바꾸면 `docs/specs/`의 plan/cases/todo/spec으로 승격한다.

- public CLI 또는 API 계약
- 데이터 모델·저장소 스키마
- 검증 결과의 severity 또는 CI gate
- 문서 책임 경계 또는 source-map 의미

feedback 파일 자체는 발견과 추적을 위한 기록이며, 검증을 통과했다는 증거는 아니다.
