---
def:
  id: system-narrative
  type: knowledge
  knowledge_kind: narrative
  level: module
  address: def_document:v2:137232
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: approved
  layer: domain
  tags: [cross-scope, entry-point]
  links:
    - target: msa-architecture
      type: contains
    - target: realization-catalog-mgmt
      type: contains
    - target: realization-coord-promotion
      type: contains
    - target: realization-coverage
      type: contains
    - target: realization-observability
      type: contains
    - target: realization-pipeline
      type: contains
    - target: package-implementation-review
      type: contains
    - target: realization-registry
      type: contains
    - target: realization-spec-core
      type: contains
    - target: system-root
      type: refines
sources:
  - docs/specs/system/system-root.md
  - docs/specs/system/system-libraries.md
  - docs/specs/system/system-infra.md
  - docs/specs/system/system-design-tools.md
  - docs/specs/system/system-support.md
  - docs/specs/system/system-packages.spec.md
  - scripts/package-surfaces.mjs
  - scripts/verify-analysis-os.ts
---
# QA-SDK 시스템 서술

## 목적 ^purpose

문서 구조 기반으로 전체 시스템을 계층적으로 서술한다. 8개 영역 × 그룹 문서 → 하위 문서 → 50자 이내 요약.

---

## 시스템이 하는 일

**system-root**: 이벤트를 좌표로 인코딩하여 분기점에 추적성을 부여하는 SDK+인프라.

이 시스템은 8개 하위 영역으로 구성된다.

---

## 1. 좌표 인코딩 라이브러리 (system-libraries)

좌표 시스템의 수학적 기반과 인코딩/디코딩 엔진.

**indexing-core-system** (weighted-index): mixed-radix 인코딩의 핵심 수학 라이브러리.
- **wi-system**: WeightedIndex — 다차원 좌표를 정수 하나로 압축.
- **wi-pack-format-system**: 바이너리 직렬화 6종 포맷 (u8~f64).
- **dim-ops-system**: 차원 연산 — stride, capacity, headroom 계산.
- **conventions-system**: DimRef 3종, ColumnRef, 좌표 컨벤션.
- **benchmark-system**: 인코딩 성능 벤치마크 기준선.

**index-meta-system** (index-meta): prefix 레지스트리 + 코덱 + 스키마 컴파일.
- PrefixRegistry로 버전/DAG 관리, PrefixDecoder로 독립 디코딩.
- DecodeMap 번들로 런타임 배포, SchemaSnapshot으로 drift 감지.

**cq-system** (query-service): 관계형 질의 + 정책 해소 + gate 통합.
- 교차 인덱스 조회, 정책 규칙 매칭, gate 상태 합성.

---

## 2. 런타임 인프라 (system-infra)

좌표 시스템을 운영하는 6개 서비스.

**ingest-system** (ingest-server): 이벤트 수집 → 좌표 인코딩 → 저장.
- **pipeline-system**: 수집 파이프라인 7단계 (수신→검증→인코딩→저장→재구성→판정→시각화).
- **storage-system**: InMemory/PostgreSQL/D1/ClickHouse 4종 드라이버.
- **admin-api-system**: 관리 API (세션, 트레이스, 판정 조회).

**registry-system** (registry-service): prefix DAG, 버전 lifecycle, axis 프로필 중앙 관리.
- **registry-service-modules**: NestJS 9모듈 — catalog/prefix/version/axis/service/event/workspace/dashboard/seed.

**gate-system** (gate-service): 주소 공간 유효성 — active/inactive/open/reserved 4-state.
- **gate-engine-group**: recompute + cascade + gate-aware-query.

**decode-system** (decode-service): DecodeMap 번들로 독립 디코딩하는 경량 서비스.
- startup 시 registry에서 fetch, 이후 순수 인메모리.

**query-system** (query-service): 정책 해소 + gate 통합 질의 엔드포인트.

**definition-service-system** (definition-service): 문서 메타데이터 DB 관리 + 그래프 분석.
- data/domain_data: documents + document_links + FTS5.
- feature/func_def: CRUD, 계층 탐색, 원자적 link/tag 변경.
- flow/process_flow: file↔DB 양방향 동기화.
- state/domain_state: lifecycle 전이, version 자동 증가.
- constraint/tech_constraint: scope×aspect 검증, DB가 메타데이터 SSOT.
- interface/api_contract: REST 20+ 엔드포인트 + GraphQL.

---

## 3. 설계 도구 (system-design-tools)

좌표 시스템의 설계와 의사결정을 지원하는 엔진.

**dkg-system**: 설계 지식 그래프 — 노드 15종, 엣지 18종, 성장 나선.
- 축/prefix/서비스/관측/의사결정을 그래프로 연결.

**df-system** (decision-flow): 의사결정을 직교 축으로 벡터 공간에 투영.
- **df-model-group**: 11개 축, 관측 공간, 상태 전이, 직렬화.
- **df-analysis-group**: 패턴 감지, 정책 후보, 자동화.
- **df-narrative-group**: 서사 증명 — 축 압축, 반복 패턴, 직교성 검증.

**spec-engine-system** (spec-core): prefix 설계 규칙 + convergence 분석.
- **analysis-system**: 공출현, IntentLink, 자기진단, prefix 분석.
- **dkg-skills-system**: 변경 전파, 마이그레이션 추론, 의사결정 템플릿.

---

## 4. 좌표 정의 (prefix-catalog-system)

57건의 prefix 정의 — 이벤트 좌표 공간의 실체.

- **event-prefix-group** (22건): auth_event, order_event, deploy_event 등 비즈니스/시스템 이벤트.
- **observation-prefix-group** (21건): page_view, endpoint, flow_point 등 관측 포인트.
- **entity-prefix-group** (5건): service, content, tracking 등 실체 정의.
- **policy-prefix-group** (2건): permission, rbac — 권한 좌표.
- **relation-prefix-group** (1건): relational — DKG 관계 모델.

---

## 5. 보조 시스템 (system-support)

**permission-system** (auth): bitmask 기반 권한 압축 + 계층 상속 + PolicyRule.
- 7개 하위 문서: 코덱, 마이그레이션, 외부 컨텍스트 등.

**apm-system** (qa-sdk-cli): 코드 → SchemaSnapshot → Registry 파이프라인.
- codegen, 런타임 스키마, 제약 조건.

**event-vocab-system**: 이벤트 어휘 + auto-track + prefix 매핑.

**guides-system**: 빠른 시작, 축 설계 가이드, 레시피 모음.

---

## 6. 프론트엔드 (system-frontend)

**browser-system** (shopping-web): 브라우저 SDK — 이벤트 수집, 세션, 자동 캡처.

**viz-system** (platform-demo): 시각화 — 패널, 그래프 렌더러, 모션 에디터.
- **viz-roleplay-system**: QA 브릿지 + 폼 빌더.
- **viz-surface-system**: 3D 좌표 시각화.
- **viz-language-system**: Mermaid 다이어그램 생성.

---

## 7. 문서 분류 체계 (definition-system)

**dual-coordinate-system**: prefix(이벤트)와 scope(문서) 두 좌표 공간의 동형 대응.
**definition-system-philosophy**: 좌표 기반 문서화 6원칙 — 반복 가능한 분류 체계.
**scope-classification-guide**: scope 7종 판별 트리 + aspect 선택 기준.

문서 482건, scope 7종 × aspect 22종, depth 4단계, layer 4계층.
DB가 메타데이터 SSOT, 파일이 본문 SSOT. GraphQL + REST + CLI 3채널 접근.

---

## 8. 경험 계층 (skill-catalog-system)

사용자가 시스템과 상호작용하는 모든 도구.

**claude-skill-group** (7종): def-new, def-topdown, def-bottomup, def-context, def-audit, def-link, def-split.
**dkg-skill-group** (5종): cascade, catalog, decision, migrator, version-event.
**cli-command-group** (4종): coord, def, dkg, flow CLI 명령 그룹.

---

## 요약

```
좌표 수학 (weighted-index)
  → 인코딩 엔진 (index-meta)
    → 런타임 서비스 6개 (ingest, registry, gate, decode, query, definition)
      → 설계 도구 (DKG + decision-flow + spec-engine)
        → 문서 분류 (482건, 좌표 기반)
          → 사용자 도구 (CLI + skill + GraphQL)
```

482건의 문서가 7 scope × 22 aspect × 4 depth의 좌표 공간에서 고유 주소를 가지며, 6종 링크로 연결되고, DB에서 검색/검증/전파 분석이 가능하다.
