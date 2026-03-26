---
def:
  id: df-narrative-group
  scope: feature
  aspect: func_def
  depth: overview
  lifecycle: approved
  layer: domain
  svc: decision-flow
  tags: [structural, decision]
  links:
    - target: df-narrative-structure
      type: contains
    - target: df-narrative-proofs
      type: contains
    - target: df-narrative-context
      type: contains
---

# Decision Flow — 서사 그룹

## 목적 ^purpose

decision-flow 서사 문서. 질문 → 증명 → 결론이 쌓이는 누적적 서사 구조.

## 구성 ^overview

- `df-narrative-structure`: 서사의 구조: 배경(context) → 여정(journey) → 도달(destination) → 산출(outcome) → 회고(reflection).
- `df-narrative-proofs`: 서사 증명 10장.
- `df-narrative-context`: ContextProvider — 결정 시작 시 이전 맥락을 표면화하여 같은 조사를 반복하지 않게 만드는 기능.

| 문서 | 내용 |
|------|------|
| [df-narrative-structure.spec.md](df-narrative-structure.spec.md) | 서사의 5단계 구조 + 코어 전환점 + 서사 비교 |
| [df-narrative-proofs.spec.md](df-narrative-proofs.spec.md) | 서사 증명 10장 (축 압축 ~ 실제 판단) |
| [df-narrative-context.spec.md](df-narrative-context.spec.md) | ContextProvider — 컨텍스트 축적과 표면화 |
