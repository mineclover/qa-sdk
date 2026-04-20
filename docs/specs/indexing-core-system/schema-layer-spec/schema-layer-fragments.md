---
def:
  tier: component
  id: schema-layer-fragments-spec
  scope: data
  aspect: domain_data
  depth: specification
  svc: weighted-index
  lifecycle: approved
  layer: domain
  tags: [data, structural, runtime]
  links:
    - target: schema-layer-spec
      type: refines
---

# Schema Layer — Fragment 조합과 구조적 제약

## 목적 ^purpose

스키마의 재사용 단위인 Fragment 시스템과 구조적 제약(constraint) 규칙을 정의한다.
상속(inheritance) 대신 조합(composition)으로 스키마를 구성하는 원칙을 명시한다.

## Fragment: 상속이 아니라 조합

공통 구조를 fragment로 추출하고 조합한다.

```typescript
fragment("Identified", {
  identity: { required: true, type: "ref" },
});

fragment("HasActor", {
  actor_ref: { required: false, type: "ref" },
});

fragment("HasTarget", {
  target_ref: { required: false, type: "ref" },
});

fragment("HasOutcome", {
  outcome: { required: false, type: "vocabulary" },
});

// 조합으로 스키마 구성
schema("event.base", {
  category: "event",
  use: ["Identified", "HasActor", "HasTarget", "HasOutcome"],
  axes: {
    event_kind: { required: true, type: "vocabulary" },
    action:     { required: true, type: "vocabulary" },
  },
});
```

**inheritance가 아니라 composition.**

## 구조적 제약 (Schema가 가져가는 것)

| 허용 (구조적 제약) | 금지 (의미적 규칙 → Layer 3) |
|---|---|
| actor는 최대 1개 | owner면 edit 권한 자동 부여 |
| relation은 source/target 필수 | published 이후 archived만 가능 |
| action은 vocabulary에 속해야 함 | employee는 org member의 subtype |
| policy.effect는 allow/deny 중 하나 | manager면 팀 문서를 모두 읽을 수 있음 |
