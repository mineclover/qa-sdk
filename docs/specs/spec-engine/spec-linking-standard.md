---
def:
  id: spec-linking-standard
  scope: flow
  aspect: relation
  depth: specification
  lifecycle: deprecated
  tags: [tier-system]
  links:
    - target: convergence-layer-spec
      type: refines
---
# Spec Linking Standard — 문서 간 참조 규칙

## 목적 ^purpose

스펙 문서, Decision, prefix, axis 간의 참조를 표준화한다.

---

## 참조 형식

### 문서 → 문서

```
기반: [문서이름](상대경로)

예:
  기반: [design-knowledge-graph.md](design-knowledge-graph.md)
  기반: [../indexing/foundation.md](../indexing/foundation.md)
```

### 문서 → prefix

```
prefix 참조: `prefix_id`:`version` 형식.

예:
  이 문서는 `permission:v4` prefix의 설계 근거를 정의한다.
  `endpoint:v1` prefix는 service_ref를 통해 `service:v1`을 참조한다.
```

### 문서 → axis

```
axis 참조: `axis_id` 형식.

예:
  `role` 축은 시스템 전역의 역할 어휘를 정의한다.
  `resource_type` 축은 5Q(axis-decision-guide.md) 판정에 의해 추가되었다.
```

### 문서 → Decision

```
Decision 참조: DEC-XXX 형식.

예:
  DEC-HEADROOM-role: role 축 capacity를 32로 설정한 근거.
  DEC-SEP-initiator-channel: initiator와 channel 분리 유지 근거.
```

---

## 문서 유형별 필수 참조

### prefix 정의 문서

반드시 포함:
- **기반 spec**: 이 prefix가 어떤 spec에서 정의되었는가
- **축 참조**: 어떤 axis를 사용하는가 (dims 목록)
- **Decision**: 이 prefix가 생성된 의사결정
- **Domain**: 어떤 domain에 속하는가

```yaml
# 예: endpoint prefix 정의
prefix: endpoint:v1
spec: spec-engine/axis-boundary.md
axes: [resource_type, http_method, api_version]
refs: [service (prefix_ref)]
decision: DEC-ENDPOINT-001
domain: observation-domain
```

### axis 추가 문서

반드시 포함:
- **5Q 판정**: axis-decision-guide.md의 5개 질문 답변
- **Decision**: 축 추가 의사결정
- **사용 prefix**: 이 축을 사용하는 prefix 목록

```yaml
# 예: resource_type 축 추가
axis: resource_type
5Q: [true, true, true, true, 32]
decision: DEC-AXIS-RESOURCE-TYPE
used_by: [endpoint]
guide: guides/axis-decision-guide.md
```

### Decision 문서

반드시 포함:
- **대상**: 어떤 axis/prefix에 대한 결정인가
- **근거**: rationale
- **대안**: alternatives
- **역전 조건**: reversalConditions
- **관련 Observation**: 이 결정을 유발한 관찰 (있으면)

---

## 문서 관계 방향

```
Spec ──governs──→ prefix/axis     "이 스펙이 이 구조를 정의"
Decision ──justifies──→ prefix/axis  "이 결정이 이 구조를 정당화"
Observation ──prompts──→ Decision    "이 관찰이 이 결정을 유발"
prefix ──composes──→ axis           "이 prefix가 이 축을 사용"
prefix ──references──→ prefix        "이 prefix가 다른 prefix를 참조"
```

이 관계들은 DKG 엣지와 동일하다. 문서 참조와 DKG 엣지가 1:1 대응.

---

## 현재 스펙 문서 연결 맵

```
spec-engine/
  README.md                      ← 시스템 정체성
    → decision-standard.md       ← 의사결정 표준 (7Q)
    → prefix-guide.md            ← prefix 실용 가이드
    → axis-boundary.md           ← 축 경계 정의 + endpoint 재설계
    → design-knowledge-graph.md  ← DKG (노드 12종, 엣지 18종)
      → dkg-skills.md            ← DKG skills (4개 핵심 함수)
      → convergence-layer.md     ← 수렴 레이어 (5개 서비스)
    → spec-propagation.md        ← 전파 파이프라인
    → spec-linking-standard.md   ← 이 문서 (참조 규칙)
    → next-phase-plan.md         ← 다음 단계 계획

guides/
  quickstart.md                  → spec-engine/README.md (시스템 개요)
  cookbook.md                     → spec-engine/decision-standard.md (의사결정)
  axis-decision-guide.md         → spec-engine/axis-boundary.md (축 판단 기준)

indexing/weighted-index/
  traceability.spec.md           → spec-engine/design-knowledge-graph.md (DKG 연결)
```

---

## 새 문서 추가 시 체크리스트

1. **상위 문서에 링크 추가** — 관련 README나 인덱스 문서에 추가
2. **기반 문서 명시** — 첫 줄에 `기반:` 링크
3. **관련 prefix/axis 참조** — 어떤 좌표 구조에 대한 것인가
4. **Decision 연결** — 이 문서가 어떤 의사결정과 관련되는가
5. **DKG 엣지 대응** — 문서 참조가 DKG의 어떤 엣지에 해당하는가
