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

## 2. STC 4-Tier 아키텍처 ^defines
설계 자산(`type: design`)은 ECS 패턴을 기반으로 한 4단계 계층으로 조직된다.

| Tier | 역할 | 핵심 규칙 |
|:---:|:---|:---|
| **Layout** | 도메인 조직 및 배치 | `refs`를 통해 System을 조직하며, 내부 인라인 정의를 금지한다. |
| **System** | 기능 및 로직 집합 | 독립 운용 가능한 단위로, 상태 관리 시 meta-semantic에 위임한다. |
| **Component** | 데이터 진입점 | 공유되는 데이터의 Shape, Enum, 역할을 정의하며 Breaking Change를 관리한다. |
| **Entry** | 고유 식별 인스턴스 | 유일한 싱글톤 ID나 고정된 좌표의 인스턴스를 서술한다. (희소 사례) |

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
