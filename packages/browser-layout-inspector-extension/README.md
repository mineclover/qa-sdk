# Browser Layout Inspector Extension

`browser-layout-inspector`를 Manifest V3 **Side Panel**로 제공한다. 브라우저 툴바의 확장 프로그램 아이콘을 누르면 현재 탭의 Side Panel이 열리고, 페이지를 클릭해도 패널은 닫히지 않는다. 기본 흐름은 **요소 선택**, **요소 간격 (A → B)** 또는 **Ruler**다. A → B는 기준 요소와 대상 요소를 차례로 클릭해 상대 좌표·방향성 edge gap을 확인한다. Ruler는 페이지의 아무 지점에서나 드래그해 영역의 폭·높이·대각선 거리를 잰다. 선택한 요소는 CSS source 후보, final computed style, geometry와 함께 자동 갱신되며, Side Panel에서 inline CSS를 즉시 적용하거나 숨기고 다시 원복할 수 있다.

```bash
corepack pnpm --filter browser-layout-inspector-extension build
```

Chrome/Edge의 `chrome://extensions` 또는 `edge://extensions`에서 Developer mode를 켜고 `packages/browser-layout-inspector-extension/dist`를 unpacked extension으로 로드한다.

권한은 `activeTab`, `scripting`, `sidePanel`뿐이다. 사용자가 Side Panel을 여는 현재 탭에만 content script를 주입하며, 모든 사이트에 대한 영구 host permission은 요청하지 않는다. cross-origin CSS stylesheet의 CSSOM은 브라우저가 계속 차단할 수 있으며 결과의 `inaccessibleStylesheets`로 보인다.

`선택 원복 / 다시 보이기`와 `전체 원복`은 이 확장이 현재 탭에서 추가한 inline property만 되돌린다. 페이지를 새로고침하면 측정·편집 상태도 사라진다. 기존 selector 입력 검사는 보조 기능으로 남아 있다.

Side Panel의 **CSS 출력**은 바로 복사할 수 있다. 첫 CSS rule은 현재 브라우저가 계산한 최종 값이고, Grid/Flex layout 속성도 포함한다. 뒤의 `Matched author CSS candidates` rule은 매칭된 source 후보이며, property별 cascade winner라고 주장하지 않는다.

외부 도구와 측정 결과를 주고받을 때는 **JSON 복사** 또는 **JSON 저장**을 사용한다. 이 명시적 export는 `browser-layout-inspector.exchange.v1` 형식이며, export 시각과 URL, viewport·scroll CSS px, DPR/visual viewport, 선택·검사·A → B·Ruler·guide 상태를 담는다. 기본 화면 출력은 계속 CSS이고, JSON은 자동 생성·업로드되지 않는다.

Ruler는 기본 자유 측정이며, **8px snap**을 켜면 드래그 시작·끝점이 8px grid에 맞춰진다. 완료한 Ruler에서 **Ruler 가이드 고정**을 누르면 네 edge가 magenta guide로 현재 탭에 남고, **가이드 지우기**로 제거할 수 있다. `Viewport PNG`는 화면에 보이는 범위(overlay 포함)만 저장하며 전체 페이지 캡처나 외부 업로드를 하지 않는다.
