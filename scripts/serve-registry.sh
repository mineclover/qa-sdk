#!/bin/bash
# ═══════════════════════════════════════════════════════
#  registry-service 실행 + Tailscale serve 설정
#
#  사용법:
#    ./scripts/serve-registry.sh              # 로컬 개발 (localhost:3300)
#    ./scripts/serve-registry.sh --tailscale  # Tailscale VPN 노출
#    ./scripts/serve-registry.sh --persist    # SQLite 영속화
# ═══════════════════════════════════════════════════════

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# ── 옵션 파싱 ──
USE_TAILSCALE=false
PERSIST=false
for arg in "$@"; do
  case $arg in
    --tailscale) USE_TAILSCALE=true ;;
    --persist) PERSIST=true ;;
  esac
done

# ── 환경 설정 ──
export DEV_DASHBOARD_ENABLED=true

if [ "$PERSIST" = true ]; then
  export SQLITE_PATH="${ROOT_DIR}/data/registry-service.sqlite"
  mkdir -p "$(dirname "$SQLITE_PATH")"
  echo "📦 SQLite 영속화: $SQLITE_PATH"
else
  echo "📦 In-memory 모드 (재시작 시 seed로 초기화)"
fi

# ── 빌드 확인 ──
if [ ! -f "${ROOT_DIR}/packages/registry-service/dist/server.js" ]; then
  echo "🔨 빌드 필요..."
  cd "$ROOT_DIR" && pnpm --filter @qa-sdk/registry-service build
fi

# ── 서버 시작 ──
echo "🚀 registry-service 시작 (port 3300)..."
node "${ROOT_DIR}/packages/registry-service/dist/server.js" &
SERVER_PID=$!
sleep 2

# 상태 확인
if curl -s http://localhost:3300/health | grep -q '"ok":true'; then
  echo "✅ registry-service 실행 중 (PID: $SERVER_PID)"
else
  echo "❌ registry-service 시작 실패"
  kill $SERVER_PID 2>/dev/null
  exit 1
fi

# ── Tailscale serve ──
if [ "$USE_TAILSCALE" = true ]; then
  TAILSCALE="/Applications/Tailscale.app/Contents/MacOS/Tailscale"

  # Tailscale 상태 확인
  if ! "$TAILSCALE" status &>/dev/null; then
    echo "⚠ Tailscale이 꺼져있습니다. Tailscale 앱을 먼저 실행하세요."
    echo "  1. Tailscale 앱 실행 (메뉴바 아이콘)"
    echo "  2. 로그인 완료 후 다시 실행"
    kill $SERVER_PID 2>/dev/null
    exit 1
  fi

  echo ""
  echo "🔒 Tailscale serve 설정..."
  "$TAILSCALE" serve --bg 3300

  # Tailscale 호스트 이름 가져오기
  TS_HOSTNAME=$("$TAILSCALE" status --json | python3 -c "import sys,json; print(json.load(sys.stdin)['Self']['DNSName'].rstrip('.'))" 2>/dev/null)

  if [ -n "$TS_HOSTNAME" ]; then
    echo "✅ Tailscale serve 활성화"
    echo ""
    echo "   VPN 내부 접속: https://${TS_HOSTNAME}/"
    echo "   로컬 접속:     http://localhost:3300"
    echo "   Dashboard:     https://${TS_HOSTNAME}/dev/"
    echo ""
    echo "   registry URL 업데이트:"
    echo "   curl -X PUT 'http://localhost:3300/api/endpoints/shop/registry/prod/asia' \\"
    echo "     -H 'Content-Type: application/json' \\"
    echo "     -d '{\"url\": \"https://${TS_HOSTNAME}\"}'"
  fi
fi

echo ""
echo "📊 엔드포인트 목록: http://localhost:3300/api/endpoints"
echo "🔍 URL resolve:     http://localhost:3300/api/endpoints/resolve?namespace=shop&name=shopping-web&env=dev&region=asia"
echo "📈 Dev Dashboard:   http://localhost:3300/dev/"
echo ""
echo "종료: kill $SERVER_PID"

# 포그라운드에서 대기
wait $SERVER_PID
