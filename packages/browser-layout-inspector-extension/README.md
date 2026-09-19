# Browser Layout Inspector Extension

`browser-layout-inspector`를 Manifest V3 **Side Panel**로 제공한다. 브라우저 툴바의 확장 프로그램 아이콘을 누르면 현재 탭의 Side Panel이 열리고, 페이지를 클릭해도 패널은 닫히지 않는다. 기본 흐름은 **요소 선택**, **자동 선택**, **요소 간격 (A → B)** 또는 **Ruler**다. A → B는 기준 요소와 대상 요소를 차례로 클릭해 상대 좌표·방향성 edge gap을 확인한다. Ruler는 페이지의 아무 지점에서나 드래그해 영역의 폭·높이·대각선 거리를 잰다. 선택한 요소는 CSS source 후보, final computed style, geometry와 함께 자동 갱신되며, Side Panel에서 inline CSS를 즉시 적용하거나 숨기고 다시 원복할 수 있다.

```bash
corepack pnpm --filter browser-layout-inspector-extension build
```

Chrome/Edge의 `chrome://extensions` 또는 `edge://extensions`에서 Developer mode를 켜고 `packages/browser-layout-inspector-extension/dist`를 unpacked extension으로 로드한다.

테스트 전용 페이지는 다음으로 실행한다.

```bash
corepack pnpm --filter browser-layout-inspector-extension demo
```

브라우저에서 [http://127.0.0.1:4173](http://127.0.0.1:4173)를 연 뒤 확장 아이콘을 눌러 Side Panel을 연다. `#reference`와 `#demo-target`은 A → B 측정용이며, Grid/Flex 카드와 버튼은 CSS Inspector의 author declaration·computed 값·inline 편집을 시험하기 위한 fixture다. 다른 포트가 필요하면 `BLI_DEMO_PORT=4174`처럼 설정할 수 있다.

권한은 `activeTab`, `scripting`, `sidePanel`, `<all_urls>` host permission이다. Side Panel을 열면 모든 일반 웹 페이지에 content script를 주입해 검사할 수 있다. `chrome://`, 확장 프로그램 페이지, Chrome Web Store처럼 Chrome이 보호하는 페이지에는 주입할 수 없다. cross-origin CSS stylesheet의 CSSOM은 브라우저가 계속 차단할 수 있으며 결과의 `inaccessibleStylesheets`로 보인다.

Side Panel은 네 패널로 구성된다. **측정과 선택**은 picker·비교·Ruler와 작업 라벨을, **CSS Inspector**는 현재 선택 요소의 inline/author/computed CSS를, **화면 계층 구조**는 제한된 `body` DOM 트리와 노드 선택을, **페이지 스타일과 내보내기**는 현재 페이지의 읽을 수 있는 author stylesheet CSS 추출·복사·저장과 JSON/PNG export를 맡는다. 페이지 스타일 추출은 cross-origin CSSOM을 우회하지 않으며 읽을 수 없는 stylesheet는 CSS 주석 진단으로 남긴다.

`선택 원복 / 다시 보이기`와 `전체 원복`은 이 확장이 현재 탭에서 추가한 inline property만 되돌린다. 페이지를 새로고침하면 측정·편집 상태도 사라진다. 기존 selector 입력 검사는 보조 기능으로 남아 있다.

**현재 작업** 목록은 일반 선택, 비교 **A**, 비교 **B**, `Ruler box`를 서로 독립적으로 보관한다. 각 DOM 요소 행의 본문은 A/B가 아니라 현재 선택한 CSS selector이며, 드롭다운에서 후보를 바꿀 수 있다. 우선순위는 **현재 매칭된 CSS이면서 고유한 selector**, **고유한 `id`/지원 data attribute**, **매칭 CSS 후보**, 구조 fallback 순서다. 선택한 selector는 비교 box와 요약 라벨·복사 문자열에도 반영하지만 실제 선택한 DOM 요소는 바꾸지 않는다. 행을 누르면 CSS Inspector의 대상을 그 항목으로 전환하고, 행 옆의 **선택 해제**는 해당 항목만 제거한다. A를 해제하면 의존하는 B도 함께 해제하지만, 일반 선택과 Ruler는 유지된다. **자동 선택**은 hover한 요소를 일반 선택으로 계속 갱신한다. 이 mode가 활성화된 페이지에서 `Delete` 또는 `Backspace`를 누르면 현재 hover 선택 요소에 되돌릴 수 있는 `display: none !important` inline 선언을 적용한다. input, textarea, select, contenteditable 안에서는 기본 키 동작을 가로채지 않으며 `Escape`로 자동 선택을 끝낸다.

A → B 비교를 완료하면 두 box 주변에 대비가 높은 2px teal 치수선 네 개가 추가된다. `A.left → B.left`, `A.right → B.right`, `A.top → B.top`, `A.bottom → B.bottom`을 CSS px로 표시하며, 값의 `+`/`-` 부호를 유지한다. 따라서 B가 A의 안쪽에 있거나 서로 겹쳐도 치수선이 사라지거나 절댓값으로 바뀌지 않는다. 비교 box와 요약에는 선택한 selector를 표시하므로 A/B는 내부 비교 역할로만 남는다. A 또는 B를 선택 해제하면 해당 치수선도 즉시 사라진다.

두 요소가 실제로 떨어져 있고 반대 축의 투영이 겹치면, 그 빈 공간에는 별도 `gap` 치수선이 생긴다. 예를 들어 A 오른쪽과 B 왼쪽 사이가 비어 있으면 `A.right → B.left gap 24px`처럼 표시된다. 치수선의 라벨 또는 A→B 요약 라벨을 클릭하면 그 측정 문자열이 클립보드에 복사되고 잠시 `복사됨`으로 바뀐다. 선 자체는 페이지 포인터 이벤트를 막지 않으며 클릭 가능한 것은 라벨뿐이다.

치수 라벨에 mouse hover하면 더 어두운 배경·teal outline·그림자로 즉시 강조된다. `0px`인 대응 모서리는 정보량이 없으므로 치수선과 라벨을 표시하지 않는다. 라벨을 클릭하면 복사하고, 겹친 라벨은 클릭 후 드래그해 원하는 위치로 옮길 수 있다. 드래그 중에는 그 라벨에 대응하는 치수선과 양 끝 tick도 밝은 teal glow로 함께 강조된다. 이동한 라벨은 비교 overlay가 다시 그려져도 현재 탭 세션에서 그 위치 오프셋을 유지하며, 드래그한 동작은 복사를 실행하지 않는다.

**CSS Inspector**는 실제 DevTools와 같은 구분을 따른다. `Matched author declarations`에는 접근 가능한 stylesheet의 selector별 선언 후보가 나열되며 읽기 전용이다. `Computed`에는 property 이름순 최종 브라우저 값이 표시되고 필터로 찾을 수 있다. 수정 가능한 것은 `Element style`의 inline declaration뿐이다. 행에서 값을 바꾸거나 삭제하면 즉시 페이지에 반영되며, 삭제는 underlying author cascade를 다시 드러낸다. 속성·값은 브라우저가 검증하고, 원복은 이 확장이 기록한 변경에만 적용된다.

Side Panel의 **CSS 출력**은 바로 복사할 수 있다. 첫 CSS rule은 현재 브라우저가 계산한 최종 값이고, Grid/Flex layout 속성도 포함한다. 뒤의 `Matched author CSS candidates` rule은 매칭된 source 후보이며, property별 cascade winner라고 주장하지 않는다.

외부 도구와 측정 결과를 주고받을 때는 **JSON 복사** 또는 **JSON 저장**을 사용한다. 이 명시적 export는 `browser-layout-inspector.exchange.v1` 형식이며, export 시각과 URL, viewport·scroll CSS px, DPR/visual viewport, 선택·검사·현재 작업 목록·A → B·Ruler·guide 상태를 담는다. 기본 화면 출력은 계속 CSS이고, JSON은 자동 생성·업로드되지 않는다.

Ruler는 기본 자유 측정이며, **8px snap**을 켜면 드래그 시작·끝점이 8px grid에 맞춰진다. Ruler를 완료하면 네 edge가 magenta guide로 자동 표시되며, 다음 Ruler를 완료할 때까지 유지된다. 새 Ruler는 기존 guide를 누적하지 않고 교체한다. **Ruler 가이드 지우기**는 표시된 네 guide와 해당 상태를 즉시 제거한다. `Viewport PNG`는 화면에 보이는 범위(overlay 포함)만 저장하며 전체 페이지 캡처나 외부 업로드를 하지 않는다.
