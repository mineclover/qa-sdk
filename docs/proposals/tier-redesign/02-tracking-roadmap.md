---
def:
  id: tier-redesign-02-tracking-roadmap
  type: knowledge
  knowledge_kind: proposal
  lifecycle: review
  owner_system: definition-catalog
  projection_plane: intent
  scope: meta
  aspect: proposal_design
  tier: system
  depth: specification
  links:
    - target: tier-redesign-readme
      type: depends_on
status: under-review
date: 2026-04-19
part_of: tier-redesign
role: roadmap
supersedes: -
superseded_by: -
---

# 로드맵: 이중 평면 거버넌스 및 추적 자동화

> 근거: [taxonomy-catalog.spec.md](./integration/taxonomy-catalog.spec.md) Section 4, 5.
> 설계자의 **주권적 의도(Intent)**와 코드의 **실증적 사실(Execution)**을 분리하고, 그 사이의 괴리를 자동 감지하여 시스템의 정합성을 증명한다.

## 1. 배경 및 목적

현재 시스템은 정적 명세와 동적 실행 사실이 하나의 평면에 섞여 있어 다음과 같은 한계가 존재한다.
- **의도와 사실의 혼재**: "이래야 한다"는 설계와 "이러고 있다"는 코드가 구분되지 않음.
- **노이즈 과다**: 로깅, 보안 등 보조 로직(`auxiliary`)이 핵심 비즈니스 계보(`core`)를 가려 인지 부하 발생.
- **혈통의 단절**: 데이터 변환의 최종 안착지(`egress`)가 명확하지 않아 계보 추적이 파편화됨.

본 로드맵은 이를 해결하기 위해 **이중 평면 모델**을 도입하고 **추출 파이프라인**을 고도화하는 것을 목적으로 한다.

---

## 2. 핵심 개념 (Summary)

### 2.1 추적 메타-텍소노미 (Tracking Meta-Taxonomy)
- **`projection_plane`**: 의도(`intent`) vs 실행(`execution`)의 분리 관찰.
- **`intent_hierarchy`**: 본질(`core`) vs 지원(`auxiliary`)의 위계 관리.
- **`lineage_facet`**: 유입(`ingress`)부터 안착(`egress`)까지의 패싯 전이 추적.

### 2.2 필드 레벨 정밀 계보 (Field-level Precision)
- **변환의 원자성**: 모든 구현 로직은 반드시 `egress` 안착지를 증명해야 함.
- **불변 앵커**: `Structural Axis`를 계보의 불변 식별자로 사용.

---

## 3. 실행 단계 (Phases)

### Phase 1: 거버넌스 언어 이식 (Schema)
- [ ] `definition-catalog` 내 신규 추적 축(`projection_plane` 등) 등록.
- [ ] `type: design` 문서 작성 시 `owner_system` 필수 검증 로직 구현.

### Phase 2: IR 모델 고도화 (Models)
- [ ] `ModuleIR`에 `intentHierarchy` 메타데이터 필드 추가.
- [ ] `DataIR`에 `Structural Axis`와 `Finite Axis` 구분자 추가.
- [ ] `Spacetime UID` 생성 시 Structural Axis의 불변 앵커링 지원.

### Phase 3: 추출 인텔리전스 업그레이드 (Extraction)
- [ ] LLM 프롬프트 고도화: `core` vs `auxiliary` 로직 구분 및 패싯 라벨링 지시.
- [ ] 추출 파이프라인에서 코드 내 `@facet.intent` 주석 해석 로직 추가.

### Phase 4: 드리프트 분석 엔진 구축 (Alignment)
- [ ] `compareIntentWithExecution` 엔진 개발: 의도와 구현의 불일치(Drift) 자동 감지.
- [ ] **Alignment Score** (일치율) 산출 메트릭 정의.

### Phase 5: 실증 및 정착 (Validation)
- [ ] `definition-service` 대상 Shadow Refactoring 및 리포트 산출.
- [ ] 보조 로직 필터링 기능을 포함한 통합 계보 뷰어 프로토타입.

---

## 4. 실증 시나리오 (Verification)

**대상**: `definition-service.sync` 모듈
1. **의도 정의**: "마크다운 ID는 `ingress`되어 `core` 검증을 거쳐 DB `doc_id`에 `egress`된다."
2. **구현 추출**: "실제 코드는 로깅(`auxiliary`)과 암호화(`auxiliary`)를 거쳐 저장된다."
3. **분석 결과**: "비즈니스 흐름은 100% 정렬되었으며, 2건의 보조 구현이 사이드카로 존재함." (성공)

---

## 5. 기대 효과
- **아키텍처 증명 자동화**: 설계가 코드로 완벽히 구현되었음을 기계적으로 증명.
- **가독성 혁신**: 보조 로직을 제거한 "순수 비즈니스 지도" 상시 열람 가능.
- **데이터 신뢰성**: 모든 데이터의 출처와 흐름을 필드 단위로 100% 추적.
