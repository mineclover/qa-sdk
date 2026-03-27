#!/usr/bin/env bash
set -euo pipefail

PACKAGE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ROOT_DIR="$(cd "$PACKAGE_DIR/../.." && pwd)"
PREVIEW_ORIGIN="${MOTION_CONTENT_EDITOR_DEMO_ORIGIN:-http://localhost:4179}"
WORKSPACE_ID="${1:-demo/migration-qa}"

if [[ ! -f "$ROOT_DIR/packages/motion-content/dist/index.js" ]]; then
  echo "motion-content dist가 없습니다. 먼저 아래 빌드를 실행하세요."
  echo "  pnpm --filter motion-content build"
  exit 1
fi

SNIPPET="$(
  ROOT_DIR="$ROOT_DIR" PREVIEW_ORIGIN="$PREVIEW_ORIGIN" node --input-type=module <<'NODE'
import { pathToFileURL } from "node:url";

const rootDir = process.env.ROOT_DIR;
const previewOrigin = process.env.PREVIEW_ORIGIN ?? "http://localhost:4179";
const motionContent = await import(pathToFileURL(`${rootDir}/packages/motion-content/dist/index.js`).href);

const legacyState = {
  presetId: "brand-lift",
  document: motionContent.serializeMotionComposition(
    motionContent.createPromoGridComposition("lift"),
  ),
  savedAt: "2026-03-27T00:00:00.000Z",
};

const layoutState = {
  left: {
    size: 344,
    activeTabId: "properties",
    collapsed: false,
  },
  right: {
    size: 392,
    activeTabId: "selection-detail",
    collapsed: false,
  },
  bottom: {
    size: 296,
    activeTabId: "timeline",
    collapsed: false,
  },
};

console.log(`localStorage.setItem("mce-theme/v1", "dark");`);
console.log(`localStorage.setItem("mce-layout/v1", ${JSON.stringify(JSON.stringify(layoutState))});`);
console.log(`localStorage.setItem("qa-sdk.motion-content-editor-demo/v1", ${JSON.stringify(JSON.stringify(legacyState))});`);
console.log(`window.location.href = ${JSON.stringify(`${previewOrigin.replace(/\/+$/, "")}/`)};`);
NODE
)"

cat <<EOF
== Motion Editor Demo Migration QA ==

1. workspace service와 demo preview를 띄웁니다.
   pnpm --filter @qa-sdk/motion-workspace-service dev
   pnpm --filter @qa-sdk/motion-content-editor-demo build
   pnpm --filter @qa-sdk/motion-content-editor-demo preview

2. 브라우저 DevTools Console에 아래 snippet을 붙여 legacy local demo state를 심습니다.

$SNIPPET

3. preview가 다시 열리면 다음을 확인합니다.
   - import banner가 "기존 local demo 상태"를 감지한다.
   - Workspace ID 입력값이 비어 있지 않고, "기존 local draft 가져오기" 버튼이 보인다.
   - preset selector가 legacy document와 맞는 seed 또는 custom/import 상태를 반영한다.

4. import 버튼을 누른 뒤 다음을 확인합니다.
   - status에 workspace import 성공 메시지가 나온다.
   - source가 "legacy local demo state"로 표시된다.
   - localStorage의 qa-sdk.motion-content-editor-demo/v1 키가 제거된다.

5. headline 같은 parameter를 수정하고 페이지를 새로고침한 뒤 다음을 확인합니다.
   - URL의 ?workspace=... 값으로 같은 remote workspace가 다시 열린다.
   - 방금 저장한 문서 변경이 복원된다.
   - mce-theme/v1, mce-layout/v1 값은 그대로 남아 있다.

6. 확인용 콘솔 스니펫:
   localStorage.getItem("qa-sdk.motion-content-editor-demo/v1")
   localStorage.getItem("mce-theme/v1")
   JSON.parse(localStorage.getItem("mce-layout/v1") ?? "null")
   window.location.search

권장 workspace id: $WORKSPACE_ID
preview origin: $PREVIEW_ORIGIN
EOF
