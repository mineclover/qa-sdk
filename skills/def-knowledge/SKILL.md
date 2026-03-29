---
name: def-knowledge
description: "definition-catalog 지식 문서 조회. 특정 스펙의 '왜'를 질문하면 관련 knowledge 문서를 찾고, 없으면 생성을 유도한다."
---

# Definition Knowledge — 지식 문서 조회/생성

스펙(무엇)에 대응하는 지식(왜) 문서를 찾거나 생성한다.

## 조회

```bash
# 모든 지식 문서
qa-sdk def list --type=knowledge

# 종류별
qa-sdk def list --type=knowledge --knowledge-kind=philosophy
qa-sdk def list --type=knowledge --knowledge-kind=adr
qa-sdk def list --type=knowledge --knowledge-kind=guide
qa-sdk def list --type=knowledge --knowledge-kind=pattern

# 서비스별 지식
qa-sdk def list --type=knowledge --svc=ingest-server
```

## "왜" 질문 흐름

1. 스펙 문서 ID 확인 → `qa-sdk def get <spec-id>`
2. 해당 스펙을 constrains하는 knowledge 문서 탐색 → `qa-sdk def incoming <spec-id>`
3. knowledge 문서가 없으면 → `/def-new` knowledge 템플릿으로 생성

## 6종 knowledge_kind

| kind | 핵심 질문 | 마커 |
|------|----------|------|
| **philosophy** | "이 시스템의 본질이 뭔가?" | ^insight, ^rationale |
| **adr** | "이 결정을 왜 내렸는가?" | ^rationale, ^alternatives |
| **guide** | "이걸 어떻게 쓰는가?" | ^steps, ^examples |
| **narrative** | "어떻게 여기까지 왔는가?" | ^timeline, ^lessons |
| **convention** | "뭘 따라야 하는가?" | ^rules, ^exceptions |
| **pattern** | "이 패턴이 왜 반복되는가?" | ^structure, ^when-to-use |

## spec ↔ knowledge 연결

```yaml
# knowledge → spec: constrains (이 지식이 이 스펙을 제약)
links:
  - target: definition-catalog-spec
    type: constrains

# spec → knowledge: depends_on (이 스펙이 이 지식에 의존)
links:
  - target: why-coordinate-system
    type: depends_on
```

## decision-flow → knowledge 승격

반복되는 의사결정 패턴을 발견하면:
1. `qa-sdk def list --type=knowledge --knowledge-kind=pattern` 에서 기존 패턴 확인
2. 없으면 `/def-new` knowledge/pattern으로 일반화
3. 관련 spec에 constrains 링크 연결
