---
def:
  id: review-ledger-spec
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: mediation
  tags: [observability, entry-point]
  links:
    - target: system-root
      type: refines
---

# Review Ledger — 리뷰 원장 + AI 피드백 요청

## 목적 ^purpose

파일별 리뷰 완료 상태를 커밋 기준으로 추적하고, 그 상태를 `FeedbackRequest`와 `EvidenceBundle`로 묶어 AI 피드백 요청의 일관된 입력으로 제공한다.

## 구성 ^overview

- `review_entries`: 파일별 리뷰 완료 기록. append-only 원장.
- `feedback_requests`: 리뷰 상태 스냅샷을 목적별로 묶은 AI 피드백 요청 artifact.
- `EvidenceBundle`: 요청 생성 시점의 파일 상태(`reviewed/stale/unreviewed`)와 최신 커밋, 마지막 리뷰 메타데이터를 보존하는 스냅샷.
- `relatedDocs`: 각 파일이 어떤 definition 문서와 관련되는지 자동 추론한 후보 목록.
- `prompt`: AI에 그대로 전달할 수 있는 일관된 텍스트 입력. purpose, scope, evidence summary, 파일 목록을 포함한다.

## 핵심 모델

### review_entries

기존 원장. 파일 단위로 다음 정보를 저장한다.

- `file_path`
- `reviewed_commit`
- `reviewed_at`
- `reviewer`
- `ai_model`
- `service_scope`
- `notes`

이 레코드는 “이 파일이 어떤 커밋까지 어떤 주체에 의해 리뷰되었는가”를 표현한다.

### feedback_requests

새로운 1급 artifact. AI에 대한 피드백 요청을 저장한다.

- `id`
- `created_at`
- `requested_by`
- `purpose`
- `target_model`
- `service_scope`
- `status`
- `notes`
- `prompt`
- `evidence_bundle`

`evidence_bundle`은 생성 시점 스냅샷이므로, 이후 파일 상태가 바뀌어도 요청 당시의 근거를 그대로 보존한다.

## EvidenceBundle

```ts
interface EvidenceBundle {
  total: number;
  reviewed: number;
  stale: number;
  unreviewed: number;
  items: EvidenceBundleItem[];
}
```

각 item은 파일별 상태와 최신 커밋, 마지막 리뷰 메타데이터를 담는다.
필요하면 `relatedDocs`로 definition 문서 후보를 함께 담아 문서/코드/피드백을 같은 좌표 맥락에서 읽게 한다.

이 구조는 다음 질문에 바로 답할 수 있게 한다.

- 지금 AI에게 무엇을 보여줄 것인가
- 이 요청의 근거 파일은 무엇인가
- stale/unreviewed가 얼마나 섞여 있는가
- 어떤 사람/모델이 마지막으로 봤는가

## CLI

```bash
qa-sdk review mark <glob|file...> --reviewer <name> [--model <ai>]
qa-sdk review status [--service <scope>] [--stale] [--unreviewed]
qa-sdk review dashboard
qa-sdk review log <file>

qa-sdk review request [glob|file...] --reviewer <name> --purpose <text> [--model <ai>] [--service <scope>]
  [--dkg-target <node-id>] [--decision-id <id>]
  [--decision-type <type> --title <text> --rationale <text>]
qa-sdk review requests [--service <scope>] [--limit N]
qa-sdk review show-request <id> [--json]
qa-sdk review bridge-request <id> --target <node-id> [--decision-id <id>]
```

## DKG 브릿지

`FeedbackRequest`는 선택적으로 DKG observation 루프에 연결할 수 있다.

- `review bridge-request <id> --target <node-id>` → `ObservationNode(source=review)` 생성
- `--decision-id <id>` → 기존 `DecisionNode`와 `prompts` 엣지 연결
- `--decision-type/--title/--rationale` → 새 `DecisionNode`를 만들고 observation과 연결
- `review request ... --dkg-target <node-id>` → 요청 생성과 동시에 bridge 수행

이 브릿지는 “AI 피드백 요청”을 단순 메모가 아니라 관측 루프의 입력으로 승격한다.

## Definition 문서 연동

`qa-sdk def get <doc-id>` 와 `qa-sdk def context <doc-id>` 는 `relatedDocs`가 연결된 `FeedbackRequest`를 최근 이력으로 노출할 수 있다.
이로써 문서 관점에서 “최근 어떤 피드백 요청이 이 문서를 근거로 생성되었는가”를 바로 확인할 수 있다.

`qa-sdk def impact <doc-id>` 와 `qa-sdk def bottomup <doc-id>` 는 synthetic `Feedback Trace` 섹션으로 해당 문서 또는 영향 범위에 걸린 최근 요청을 함께 보여줄 수 있다.
`qa-sdk def incoming <doc-id>` 는 일반 문서 링크와 함께 `feedback_request` pseudo incoming source를 함께 보여줄 수 있다.

## 설계 의도

- 리뷰 기록과 AI 요청을 분리한다.
  리뷰는 파일 단위 사실 기록이고, 요청은 여러 사실을 목적에 맞게 묶은 artifact다.
- 요청은 실행 로그가 아니라 재사용 가능한 컨텍스트여야 한다.
  그래서 `prompt`와 `evidence_bundle`을 함께 저장한다.
- 요청 생성 시점의 근거를 보존해야 한다.
  그래야 나중에 “왜 이런 피드백을 요청했는가”를 추적할 수 있다.
