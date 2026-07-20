---
def:
  id: document-governance-guideline
  type: design
  tier: system
  owner_system: definition-catalog
  projection_plane: intent
  intent_hierarchy: core
  scope: constraint
  aspect: tech_constraint
  depth: specification
  lifecycle: approved
  links:
    - target: system-support
      type: refs
    - target: service-definition-standard
      type: depends_on
    - target: architecture-revealing-code-convention
      type: depends_on
sources:
  - packages/definition-catalog/src/frontmatter.ts
  - packages/definition-catalog/src/validate.ts
  - packages/definition-catalog/src/domain-root.ts
  - packages/definition-catalog/src/frontmatter.test.ts
  - packages/definition-catalog/src/domain-root.test.ts
  - packages/cli/src/lib/def-tier-classify.ts
---

# 문서 거버넌스 가이드라인 — 일관된 지식 관리 체계

## 목적 ^purpose
시스템의 지식 자산을 일관된 텍소노미로 분류하고, 생애주기를 추적하여 설계 의도와 실제 구현 간의 정합성을 보장하는 거버넌스 가이드를 제공한다.

## 1. 최상위 문서 분류 (D-19) ^defines
모든 문서는 `type` 필드를 통해 설계 자산(`design`)과 맥락 지식(`knowledge`)으로 엄격히 분리된다.

### 1.1 설계 평면 (Design Plane)
- **성격**: 시스템 구조에 직접 편입되는 실행 가능한(Actionable) 명세.
- **필수 조건**:
    - `tier` (STC 4-tier: layout, system, component, entry)
    - `owner_system` (소유 시스템 ID)
    - `scope`, `aspect`, `depth` (정밀 좌표)
- **확장자**: `.spec.md`, `.rule.md`, `.test.md` 등.

### 1.2 지식 평면 (Knowledge Plane)
- **성격**: 결정의 배경, 철학, 마일스톤 등 시스템의 맥락(Contextual) 정보.
- **필수 조건**:
    - `knowledge_kind` (philosophy, adr, proposal, template 등)
    - `tier` 면제.
- **확장자**: `.md`, `.memo.md`, `.plan.md` 등.

---

## 2. E/C/I/S + L/P 아키텍처 ^defines

설계 자산(`type: design`)은 Entry, Component, Interface/DSL, System, Layout/Pack 책임을 분리한다. frontmatter `tier` 값은 `layout`, `system`, `component`, `entry` 4종이며, Interface는 별도 tier가 아니라 `scope: interface`와 rule/spec 계약 평면으로 표현한다. Pack은 배포/문서 묶음 이름이며 보통 Layout과 같은 조직 평면이다.

서비스 하나를 실제로 정의할 때의 표준 슬롯은 `service-definition-standard` rule이 소유한다. 이 문서는 governance 관점에서 그 표준을 소비한다.

| 구분 | frontmatter 표현 | 역할 | 핵심 규칙 |
|:---:|:---|:---|:---|
| **Layout / Pack** | `tier: layout` | 도메인 조직 및 배치 | `refs`를 통해 System을 조직하며, 내부 인라인 정의를 금지한다. |
| **System (S)** | `tier: system` | 기능 및 로직 집합 | 독립 운용 가능한 단위로, 상태 관리 시 meta-semantic에 위임한다. |
| **Interface / DSL (I)** | `scope: interface`, rule/spec contract | 소비 계약 평면 | System을 어떻게 호출/소비할지 정의하며 runtime behavior와 data shape를 소유하지 않는다. |
| **Component (C)** | `tier: component` | 데이터/상태/증거 vocabulary | 공유되는 데이터의 Shape, Enum, 역할을 정의하며 Breaking Change를 관리한다. |
| **Entry / Identity (E)** | `tier: entry` | 고유 식별 인스턴스 | 유일한 싱글톤 ID나 고정된 좌표의 인스턴스를 서술한다. (희소 사례) |

### 2.1 행동과 이벤트 정의

| 대상 | 소유 위치 | 설명 |
|------|-----------|------|
| operation | Interface / DSL | public command/query/event input |
| behavior | BDD contract + System | Given/When/Then으로 검증 가능한 결정론적 결과 |
| event | Event vocabulary / mapping pack | 발생/관측 fact key와 taxonomy |
| state/data | Component | 상태 enum, data shape, evidence shape |
| id/value | Entry / Identity | 안정 식별자와 유한 값 |

---

## 3. 이중 평면 거버넌스 ^defines
의도(`intent`)와 실재(`execution`)를 분리 관찰하여 시스템의 드리프트를 제어한다.

### 3.1 계획에서 실재로의 전이
1. **Plan (`.plan.md`)**: 미래의 지향점 선언. `lifecycle: draft`.
2. **Intent (`.spec.md`)**: 구현된 시스템의 규범적 약속. `projection_plane: intent`.
3. **Reality (Code/IR)**: 실제 작동하는 기술적 사실. `projection_plane: execution`.

### 3.2 분석 셀렉터 활용
- **Lineage**: 데이터의 유입(`ingress`)부터 안착(`egress`)까지의 흐름 추적.
- **Intent**: 비즈니스 제약 및 논리적 약속의 무결성 검증.
- **Implementation**: 코드에서 추출된 실제 동작 사실과 부수효과 분석.
- **Verification**: 테스트 커버리지 및 증거 품질 분석.
- **Impact**: 변경 발생 시 계보를 타고 전파되는 파급 범위 분석.

---

## 4. 운영 규칙 ^defines

### 4.1 소유권 및 좌표
- 모든 설계 문서는 반드시 `owner_system`을 가져야 하며, 이는 해당 시스템의 책임 한계를 나타낸다.
- 동일한 `(type, tier, scope, aspect, depth)` 좌표를 가진 문서는 유일해야 한다.

### 4.2 주석 및 추론
- 코드 내 마커(`@def`, `@facet`)는 LLM 추론보다 우선하는 최상위 SSOT다.
- 파일 경로는 투영 평면의 자동 추론 근거가 된다 (`docs/` -> `intent`, `packages/` -> `execution`).

### 4.3 계보 압축
- 계보는 모든 지엽적 변수를 기록하지 않으며, 의미 있는 전이 지점(Transformation)과 안착지(`egress`)만을 압축하여 기록한다.

### 4.4 코드 구조 컨벤션
- 설계 문서는 코드 구조와 따로 존재하지 않는다. 코드는 E/C/I/S + L/P 책임이 드러나게 작성하고, 문서는 그 책임을 좌표화한다.
- `architecture-revealing-code-convention`이 코드 작성 규칙의 owner다. 이 문서는 governance 관점에서 해당 규칙을 소비한다.
- code split은 문서 분할의 자동 결과가 아니라 책임 경계가 코드에서 숨을 때 수행한다.

## 검증

```bash
corepack pnpm --filter definition-catalog exec vitest run src/frontmatter.test.ts src/domain-root.test.ts src/validate-semantic.test.ts
node packages/cli/dist/index.js def validate
```
