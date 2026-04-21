---
def:
  id: viz-system-root-cases
  type: spec
  tier: component
  scope: flow
  aspect: user_scenario
  depth: validation
  lifecycle: approved
  layer: experience
  svc: viz
  tags: [scenario, viz, integration]
  links:
    - target: viz-system-root
      type: refines
    - target: viz-system
      type: depends_on
---

# Viz System Root — 소비자 기대 시나리오

## 목적 ^purpose

`viz-system-root`(시각화 전체 시스템의 umbrella entry)가 `viz-system`에 의존할 때 기대하는 통합 계약. root 는 viz-surface / viz-language / viz-roleplay 3개 하위 그룹을 조합해 "2D/3D 시각화 스택" 을 단일 진입점으로 관장한다. 각 하위 그룹의 단독 계약은 이미 Wave 2 에서 다뤘으며, 본 문서는 그 조합에서만 드러나는 umbrella 계약을 담는다.

## 시나리오 1: 3개 하위 그룹의 단일 entry 노출 ^overview

**전제**: `viz-system`이 viz-surface-system, viz-language-system, viz-roleplay-system 3개 하위 시스템을 `contains`/`depends_on` 으로 관장한다.

**동작**: 외부 서비스(예: platform-demo)가 시각화 스택을 소비할 때 viz-system-root 를 entry 로 참조.

**기대**:
- root 는 3개 하위 그룹에 각각 접근 가능한 ref 를 노출 (surface/language/roleplay)
- 하위 그룹 하나가 삭제되면 root 의 `refs` 중 하나가 broken-link 로 검출
- root 자체는 구현을 포함하지 않고 라우팅/조합만 담당 (level: layout)

**실패 시 수정 대상**: `viz-system.md`의 `^overview` — 3개 하위 그룹이 root 에서 동등하게 노출된다는 선언이 없으면 root 가 단일 그룹만 통과시켜 나머지 2개가 orphan 이 된다.

## 시나리오 2: viz-surface ↔ viz-roleplay iframe 조합 ^overview

**전제**: `viz-system`의 `iframe-protocol-spec` 이 surface(부모) 와 roleplay(자식 iframe) 의 통신 규약을 고정하고, root 가 둘을 함께 노출한다.

**동작**: surface 패널이 roleplay iframe 에 form-builder 를 embed, `postMessage` 로 상태 공유.

**기대**:
- root 를 통해 surface/roleplay 양쪽이 같은 iframe-protocol 버전을 로드 (버전 drift 금지)
- root 가 조합 실패(예: surface 버전 ↔ roleplay 버전 mismatch) 를 handshake 에서 차단
- root 하위에서 surface 단독 또는 roleplay 단독 로드도 가능 (조합이 필수는 아님)

**실패 시 수정 대상**: `viz-system.md`의 `iframe-protocol-spec` — 프로토콜 버전 규약이 root 레벨에서 일관성 보증되지 않으면 surface/roleplay 가 독립 버전 bump 로 drift.

## 시나리오 3: motion-editor + viz-language 의 의미 계약 조합 ^overview

**전제**: `viz-system`이 `motion-editor-component` 와 viz-language-system(motion-content-contract 포함) 을 함께 관장한다.

**동작**: motion-editor 가 viz-language 의 계약을 로드하여 편집 상태를 DOM 으로 렌더.

**기대**:
- root 레벨에서 motion-editor 가 viz-language 계약 없이 build 실패 (암묵 의존 금지)
- viz-language 의 용어집 변경은 motion-editor build 에 warning 전파
- platform-demo-api 가 root 를 경유하여 motion-editor 와 viz-language 를 동일 소스에서 소비

**실패 시 수정 대상**: `viz-system.md`의 motion-editor + viz-language 관계 선언 — root 에서 의존 명시가 없으면 motion-editor 가 viz-language 를 번들에서 missing 한 채 배포.

## 시나리오 4: 3D/2D 렌더러 선택 경로 ^overview

**전제**: `viz-system`이 `viz-3d-spec` + `canvas-viewport-spec` + `weighted-ui-spec` 을 통해 2D/3D 렌더러를 제공.

**동작**: 사용자가 데이터 규모/인터랙션 요구에 따라 2D → 3D 로 전환.

**기대**:
- root 에서 2D/3D 렌더러가 같은 데이터 소스(api-client) 를 공유
- 렌더러 전환 시 동일 좌표계 결과 (결정론)
- 3D fallback → 2D 경로가 root 레벨에서 graceful (WebGL 미지원 브라우저)

**실패 시 수정 대상**: `viz-system.md`의 `viz-3d-spec` + `canvas-viewport-spec` 계약 — 렌더러 간 좌표 규약이 불일치하면 root 가 사용자 전환 시 위치 drift 노출.
