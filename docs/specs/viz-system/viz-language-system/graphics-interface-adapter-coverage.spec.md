---
def:
  tier: component
  id: graphics-interface-adapter-coverage
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  layer: mediation
  svc: platform-demo
  tags: [structural, runtime]
  links:
    - target: viz-language-system
      type: refines
    - target: rlsc-integration
      type: depends_on
---

# Graphics Interface Adapter Coverage

## 목적 ^purpose

RLSC graphics interface를 CSS/DOM, Figma, Pencil, Photoshop, Stitch 사이의 중앙 레이아웃 스펙으로 관리하기 위해 각 시스템의 레이아웃 표현법과 손실 가능한 변환 지점을 정리한다.

## 구성 ^overview

중앙 스펙은 특정 도구의 속성명을 그대로 복제하지 않는다. `GraphicsInterfaceNode`와 `GraphicsLayoutSpec`은 `geometry`, `stack`, `grid`, `absolute`, `group`, `padding`, `gap`, `alignment`, `sizing`, `position` 같은 도구 중립 어휘를 소유하고, 외부 시스템은 adapter에서 변환한다.

```
CSS/DOM computed style
Figma auto layout
Pencil .pen
Photoshop layer/group
Stitch generated screen/code
        ↓↑
GraphicsInterfaceNode / GraphicsLayoutSpec
```

## Source Model Review

| 시스템 | 레이아웃 원천 | 중앙 스펙 대응 | 방향성 |
|--------|---------------|----------------|--------|
| CSS/DOM | computed style, DOM tree, `getBoundingClientRect()` | raw `StandardStyleStack` → canonical `GraphicsLayoutSpec` | 양방향 가능. CSS는 가장 세밀하지만 cascade/auto sizing 재현은 추론 필요 |
| Figma | Frame/Auto layout, node bounds, component/instance | `stack` + `padding` + `gap` + `alignment` + `sizing` | 양방향 1차 타깃. Auto layout을 중앙 stack의 하위호환 대상으로 본다 |
| Pencil | `.pen` JSON object tree, top-level absolute canvas, nested relative positioning, flexbox-style layout | `stack`, `geometry`, `component/ref`, `slot`, `script-derived` | 양방향 가능성이 높음. `.pen`은 Git-friendly JSON이므로 중앙 스펙과 가장 직접적으로 연결 가능 |
| Photoshop | layer/group/text/vector bounds, transform, effects | `group`, `absolute`, `geometry`, `paint`, `typography`, `effect` | 주로 degrade/export. Native auto layout이 없으므로 stack/grid intent는 group/layer positions로 펼친다 |
| Stitch | MCP screen generation + screen/code retrieval | generated HTML/CSS 또는 screen metadata를 CSS/DOM adapter로 흡수 | 간접 양방향. Stitch 자체 layout schema보다 output code/design artifact를 canonical input으로 본다 |

## Pencil Mapping

Pencil `.pen`은 JSON object tree이며, 각 object는 infinite 2D canvas 위의 graphical entity다. Top-level object는 `x`, `y`가 top-left 위치이고, nested object는 parent top-left 기준으로 배치된다. Parent는 `layout`, `justifyContent`, `alignItems` 등 flexbox-style layout으로 children sizing/positioning을 맡을 수 있고, child는 parent fill 또는 fixed width/height를 선택할 수 있다.

중앙 스펙 매핑:

| Pencil 개념 | Graphics Interface |
|-------------|--------------------|
| `type: "frame"` | node kind `frame`, children owner |
| top-level `x`, `y`, `width`, `height` | `geometry` in canvas coordinate |
| nested object position | `position.mode: "auto"` or `"absolute"` with parent-relative geometry |
| `layout` + `justifyContent` + `alignItems` | `layout.mode: "stack"`, `axis`, `alignment` |
| child fill/fixed width/height | `sizing.width/height: "fill" \| "fixed" \| "hug"` |
| `type: "group"` | `layout.mode: "group"` candidate, or no layout with children |
| `type: "ref"` + `ref` | component instance identity |
| `slot` | component child insertion contract |
| script node output | derived children; preserve as generated source metadata when possible |

Pencil은 중앙 스펙 확장에 중요한 근거다. Figma처럼 visual editor지만 `.pen`이 공개 JSON tree라서, 중앙 스펙을 도구 중립 AST로 잡으면 Pencil adapter는 code-first design 파일을 직접 읽고 쓸 수 있다.

## Stitch Mapping

Stitch MCP는 AI assistant가 Stitch project/screen을 조작하도록 연결하는 표면이다. 공식 setup 문서는 원격 MCP 설정을 전제로 하며, 현재 세션에는 Stitch MCP tool이 연결되어 있지 않다. 따라서 중앙 스펙에서는 Stitch를 direct schema provider가 아니라 generated artifact provider로 취급한다.

중앙 스펙 매핑:

| Stitch artifact | Graphics Interface |
|-----------------|--------------------|
| generated HTML/CSS | CSS/DOM adapter 경유 |
| screen metadata | document/page identity, viewport/device profile |
| visual prompt/design DNA | non-authoritative design intent metadata |
| multi-screen project | `GraphicsDocument` 후보: pages/screens collection |

Stitch adapter의 첫 목표는 `get_screen_code` 같은 결과에서 HTML/CSS를 얻고, 기존 browser collector로 canonical tree를 만드는 것이다. Stitch screen 내부 schema가 안정적으로 노출되면 direct importer를 추가한다.

## Central Spec Updates

중앙 스펙은 다음 필드를 장기적으로 소유한다.

| 필드 | 이유 |
|------|------|
| `layout.mode: "none" \| "stack" \| "grid" \| "absolute" \| "group"` | Figma/Pencil/CSS/Photoshop을 같은 레이아웃 계층으로 묶기 위함 |
| `axis: "horizontal" \| "vertical"` | Figma auto layout, CSS flex, Pencil flexbox-style layout 공통축 |
| `wraps` | Figma `layoutWrap`, CSS `flex-wrap`, Pencil layout wrapping 대응 |
| `gap.main/cross` 또는 `rowGap/columnGap` | CSS/Figma/Pencil spacing 손실 방지 |
| `alignment.main/cross/content` | `justifyContent`, `alignItems`, `alignContent`, Figma primary/counter axis 대응 |
| `padding` | Figma/Pencil frame padding, CSS padding 대응 |
| `sizing.width/height` | fixed/hug/fill 변환의 핵심 |
| `position.mode` | auto/absolute/fixed 배치 구분 |
| `identity.component/ref/slot` | Figma components, Pencil reusable/ref/slot, DOM component metadata 대응 |
| `paint/typography/effects` | Photoshop/Pencil/Figma 그래픽 표현 확장 지점 |

## Adapter Policy

1. CSS/DOM adapter는 computed fact를 `StandardStyleStack`에 보존하고, canonical 변환은 pure helper에서 수행한다.
2. Figma adapter는 canonical `stack`만 auto layout으로 변환한다. `grid`는 별도 grid adapter가 생기기 전까지 auto layout으로 강제 변환하지 않는다.
3. Pencil adapter는 `.pen` tree를 가능한 한 직접 canonical tree로 변환한다. `ref`, `slot`, script node는 identity/source metadata를 보존한다.
4. Photoshop adapter는 layout intent를 native group/layer bounds로 degrade한다. 양방향 import 시 stack/grid 의도 복원은 heuristic으로 표시한다.
5. Stitch adapter는 우선 generated HTML/CSS를 canonical input으로 삼는다. Stitch native screen schema가 안정적으로 공개되기 전에는 중앙 스펙이 Stitch 내부 모델에 의존하지 않는다.

## 검증 기준

- CSS flex row/column/wrap/gap/alignment → canonical stack → Figma auto layout adapter 테스트
- CSS grid → canonical grid → Figma auto layout 제외 테스트
- Pencil `.pen` frame/group/ref fixture → canonical tree fixture 테스트
- Photoshop layer/group fixture → canonical absolute/group tree fixture 테스트
- Stitch generated HTML/CSS fixture → browser collector → canonical tree smoke

## References

- Pencil `.pen` format: https://docs.pencil.dev/for-developers/the-pen-format
- Pencil interface: https://docs.pencil.dev/core-concepts/pencil-interface
- Pencil Code on Canvas: https://docs.pencil.dev/core-concepts/code-on-canvas
- Stitch MCP setup: https://stitch.withgoogle.com/docs/mcp/setup
