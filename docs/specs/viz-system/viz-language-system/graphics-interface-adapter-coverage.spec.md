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
sources:
  - packages/rlsc-analysis/src/graphics-interface.ts
  - packages/rlsc-analysis/src/graphics-interface.test.ts
  - packages/rlsc-analysis/src/index.ts
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

## Adapter Source Authority

각 adapter는 자체 구현 판단보다 외부 시스템의 기준 문서, MCP surface, type declaration package를 우선한다. 중앙 스펙은 외부 스펙을 복사해 소유하지 않고, 어느 source authority를 기준으로 어떤 필드를 canonical로 승격했는지를 기록한다.

| Adapter | 1차 기준 | 2차 기준 | 중앙화 방식 | Drift 관리 |
|---------|----------|----------|-------------|------------|
| `css-dom` | Web platform computed style + DOM geometry | TypeScript `lib.dom.d.ts`, browser smoke fixtures | `StandardStyleStack` raw fact + canonical mapper | 브라우저 수집 테스트와 real Chromium accuracy smoke |
| `figma` | Figma Plugin API docs | `@figma/plugin-typings` package | Figma enum/property를 adapter output type으로 제한 | typings version 갱신 시 adapter compile/test |
| `pencil` | Pencil `.pen` format docs | `.pen` fixture files | Pencil object tree를 canonical tree로 import/export | live docs 변경 시 fixture와 mapping table 갱신 |
| `photoshop` | Adobe Photoshop UXP docs | UXP/Photoshop type declarations when installed | group/layer/text/effect subset을 adapter contract로 제한 | native capability가 약한 layout은 degrade marker 테스트 |
| `stitch` | Stitch MCP setup and exposed MCP tools | generated screen code/artifacts | MCP output을 CSS/DOM 또는 screen artifact importer로 흡수 | MCP tool list/schema가 바뀌면 adapter manifest 갱신 |

중앙 스펙 문서에는 source authority의 현재 URL 또는 package name을 남기고, 구현 package에는 가능하면 adapter별 type-only dependency 또는 fixture를 둔다. 예를 들어 Figma adapter는 공식 docs 설명보다 `@figma/plugin-typings`의 TypeScript shape를 compile-time boundary로 삼는 편이 drift를 빨리 감지한다. Pencil adapter는 `.pen` 문서가 live format임을 전제로 fixture 기반 regression을 둔다.

## Adapter Contract Shape

각 adapter는 다음 contract를 갖는다.

| 단계 | 함수 형태 | 책임 |
|------|-----------|------|
| import | `from<System>(source, options) -> GraphicsInterfaceNode` | 외부 스펙을 중앙 스펙으로 흡수 |
| export | `to<System>(node, options) -> SystemArtifact` | 중앙 스펙을 외부 스펙으로 변환 |
| inspect | `get<System>Coverage() -> AdapterCoverage` | 지원 필드, 손실 필드, source authority 노출 |
| verify | fixture roundtrip 또는 degrade test | 양방향 보존 범위와 손실 범위 고정 |

`AdapterCoverage`는 최소한 다음 정보를 가져야 한다.

```typescript
interface AdapterCoverage {
  readonly id: 'css-dom' | 'figma' | 'pencil' | 'photoshop' | 'stitch';
  readonly sourceAuthority: readonly {
    readonly kind: 'docs' | 'mcp' | 'types' | 'fixture';
    readonly name: string;
    readonly locator: string;
    readonly checkedAt?: string;
  }[];
  readonly supported: readonly string[];
  readonly degraded: readonly string[];
  readonly unsupported: readonly string[];
}
```

이 contract를 두면 중앙 스펙은 “모든 외부 스펙을 직접 구현한 문서”가 아니라 “외부 스펙별 adapter가 어떤 근거로 어떤 범위를 보장하는지 관리하는 registry”가 된다.

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
6. Adapter 구현은 가능하면 외부 type declaration package 또는 MCP schema를 compile/test boundary로 삼는다.
7. 외부 source authority가 바뀌면 중앙 canonical type을 즉시 넓히지 않고 adapter coverage의 `degraded` 또는 `unsupported` 목록을 먼저 갱신한다.

## 검증 기준

- CSS flex row/column/wrap/gap/alignment → canonical stack → Figma auto layout adapter 테스트
- CSS grid → canonical grid → Figma auto layout 제외 테스트
- Pencil `.pen` frame/group/ref fixture → canonical tree fixture 테스트
- Photoshop layer/group fixture → canonical absolute/group tree fixture 테스트
- Stitch generated HTML/CSS fixture → browser collector → canonical tree smoke
- Adapter coverage snapshot → source authority locator와 supported/degraded/unsupported 필드 drift 테스트
- Type package 또는 MCP schema가 있는 adapter는 compile-time boundary 테스트

## References

- Pencil `.pen` format: https://docs.pencil.dev/for-developers/the-pen-format
- Pencil interface: https://docs.pencil.dev/core-concepts/pencil-interface
- Pencil Code on Canvas: https://docs.pencil.dev/core-concepts/code-on-canvas
- Figma typings: https://developers.figma.com/docs/plugins/api/typings/
- Figma official typings package: `@figma/plugin-typings`
- Adobe Photoshop UXP: https://developer.adobe.com/photoshop/uxp/
- Stitch MCP setup: https://stitch.withgoogle.com/docs/mcp/setup
