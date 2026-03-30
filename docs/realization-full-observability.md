---
def:
  id: realization-observability
  type: knowledge
  knowledge_kind: narrative
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: approved
  tags: [observability, runtime, cross-scope]
  links:
    - target: system-narrative
      type: refines
---
# Realization Plan: 완전 관측 — CLI + DKG + 시스템 이벤트의 좌표화

## 목적 ^purpose

완전 관측성 실현 계획. 이벤트 수집→convergence→insights 파이프라인 완성 로드맵을 기술한다.


> Status: **completed**
> Created: 2026-03-21
> Completed: 2026-03-22
>
> **달성**: cli_event prefix + 3축(cli_intent/cli_domain/cli_subject) + CLI_COMMAND_MAP 75개 명령 → 50 고유 좌표.
> emitCliEvent() 전 CLI 명령에 통합. analyzeCliCoverage() → dormant 감지. dsl-dev DSL에 배정.

## 1. 핵심 원칙

**CLI 명령어는 교체 가능한 UI다. 좌표가 안정적인 식별자다.**

`dkg claim`이라는 명령어 이름은 바뀔 수 있다. 하지만 "누군가가 어떤 노드에 작업 선점 의도를 표현했다"는 좌표는 불변이다. 모든 시스템 활동이 좌표로 기록되면:

1. CLI 명령어를 교체해도 관측 데이터의 연속성이 유지된다
2. CLI가 아닌 API, SDK, 자동화에서 같은 작업을 해도 같은 좌표로 기록된다
3. 시스템 자체가 자기 동작을 관측하여 이상을 감지한다

## 2. 현재 상태

| 구분 | 명령 수 | 이벤트 기록 | 커버리지 |
|------|---------|-----------|---------|
| dkg write | 8개 | 8개 (emitDkgEvent) | 100% |
| dkg read | 24개 | 0개 | 0% |
| dkg analyze | 5개 | 1개 (promote) | 20% |
| 비-dkg | 23개 | 0개 | 0% |
| **합계** | **60개** | **9개** | **15%** |

## 3. 설계

### 축 설계 — 의도(intent) 기반

CLI 명령어 이름이 아닌 **의도**를 축으로 정의한다. 명령어가 교체되어도 의도는 불변.

```
cli_intent 축:
  query           — 데이터 조회/탐색 (read-only, 부작용 없음)
  analyze         — 분석/진단 (read-only, 계산 수행)
  mutate          — DKG 상태 변경 (write)
  publish         — 외부 시스템에 발행
  lifecycle       — 버전 lifecycle 전이
  init            — 초기화/동기화
  backup          — 데이터 백업/복원

cli_domain 축:
  dkg-graph       — DKG 그래프 조회/변경
  dkg-skill       — 스킬 실행
  convergence     — 수렴 분석
  spec            — 스펙 문서 관리
  coordinate      — 주소 인코딩/디코딩
  registry        — registry-service 연동
  catalog         — 카탈로그 관리
  self-ref        — 자기참조 (self-check, promote)
  system          — 시스템 관리 (export, import, init)

cli_subject 축 (기존 dkg_target_kind 확장):
  axis, prefix, domain, dsl-bundle, decision, observation
  constraint, skill, intent-link, system
  version, spec, schema, catalog
```

### prefix 설계

```
cli_event: cli_intent × cli_domain × cli_subject
  — 모든 CLI 명령 실행을 기록하는 단일 prefix
  — 3D 좌표로 "무슨 의도로 어떤 도메인의 어떤 대상에 작업했는가"

예시:
  dkg trace permission   → cli_event(query, dkg-graph, prefix)
  dkg decide permission  → cli_event(mutate, dkg-graph, decision)
  dkg self-check         → cli_event(analyze, self-ref, system)
  encode permission      → cli_event(query, coordinate, prefix)
  dkg publish            → cli_event(publish, registry, catalog)
  dkg version activate   → cli_event(lifecycle, registry, version)
```

### 매핑 테이블

CLI 명령어 → (intent, domain, subject) 매핑. 명령어가 바뀌어도 이 매핑만 수정.

```typescript
const CLI_COMMAND_MAP: Record<string, { intent: string; domain: string; subject: string }> = {
  // dkg query
  "dkg report":    { intent: "query", domain: "dkg-graph", subject: "system" },
  "dkg axes":      { intent: "query", domain: "dkg-graph", subject: "axis" },
  "dkg prefixes":  { intent: "query", domain: "dkg-graph", subject: "prefix" },
  "dkg trace":     { intent: "query", domain: "dkg-graph", subject: "prefix" },
  // ...

  // dkg mutate
  "dkg decide":    { intent: "mutate", domain: "dkg-graph", subject: "decision" },
  "dkg observe":   { intent: "mutate", domain: "dkg-graph", subject: "observation" },
  "dkg claim":     { intent: "mutate", domain: "dkg-graph", subject: "prefix" },
  // ...

  // coordinate
  "encode":        { intent: "query", domain: "coordinate", subject: "prefix" },
  "decode":        { intent: "query", domain: "coordinate", subject: "prefix" },
  // ...
};
```

### emitCliEvent — 통합 이벤트 발행

모든 CLI 명령의 진입점에서 호출. `emitDkgEvent`를 대체.

```typescript
function emitCliEvent(command: string, args?: { target?: string }): void {
  const mapping = CLI_COMMAND_MAP[command];
  if (!mapping) return;

  encodePrefixByValue(DEMO_CATALOG, "cli_event", "v1", {
    cli_intent: mapping.intent,
    cli_domain: mapping.domain,
    cli_subject: mapping.subject,
  });
  // → snapshot 저장
}
```

### 기존 prefix와의 관계

```
cli_event       — CLI 명령 실행 (UI 레이어)
dkg_event       — DKG 그래프 변경 (도메인 레이어) — cli_event의 subset
dkg_decision_event — 의사결정 생성 (세부 레이어) — dkg_event의 subset
dkg_observation_event — 관측 생성 (세부 레이어) — dkg_event의 subset

계층:
  cli_event ⊃ dkg_event ⊃ dkg_decision_event
                         ⊃ dkg_observation_event
```

cli_event는 모든 CLI 실행을 포괄. dkg_event는 그중 그래프 변경만. decision/observation은 그중 특정 유형만.

## 4. Phase

### Phase A: 축 + prefix + 매핑 테이블 정의

- cli_intent (7), cli_domain (9), cli_subject (14) 축 추가
- cli_event prefix 추가
- CLI_COMMAND_MAP 정의 (60개 명령 매핑)

### Phase B: emitCliEvent 통합

- emitDkgEvent → emitCliEvent로 교체
- 모든 CLI 명령 진입점에 emitCliEvent 호출
- read 명령도 이벤트 기록 (query intent)

### Phase C: 기존 dkg_event와 정합

- dkg_event는 유지 (write 명령의 상세 기록)
- cli_event는 상위 레이어 (전체 활동 기록)
- 둘이 coOccurrence로 연결 (같은 record에 cli_event + dkg_event)

### Phase D: 자가 증명

- self-check에서 cli_event 커버리지 분석
- "실행된 적 없는 CLI 명령" = dormant entry = 테스트 안 된 경로
- CLI 명령 교체 시 매핑만 수정, 좌표는 유지됨을 검증

## 5. Fitness Criteria

| # | 기준 | Verify |
|---|------|--------|
| F1 | 60개 CLI 명령이 전부 CLI_COMMAND_MAP에 매핑됨 | 매핑 누락 0건 |
| F2 | 모든 CLI 실행이 cli_event로 기록됨 | self-check 후 cli_event 커버리지 > 0% |
| F3 | CLI 명령 이름을 바꿔도 좌표가 동일 | 매핑 수정 + 동일 좌표 확인 |
| F4 | dkg_event와 cli_event가 coOccurrence로 연결 | write 명령 실행 시 두 prefix 동시 기록 |
| F5 | dormant cli_event entry → "이 기능은 한 번도 사용 안 됨" 감지 | coverage 분석 |

## 6. 되돌림 조건

- cli_event 기록이 CLI 성능에 체감 영향 → 비동기 기록 또는 임계값 이하만 기록
- 60개 매핑 관리 오버헤드 → 자동 매핑 추론 (명령어 패턴 → intent/domain 자동 판정)
