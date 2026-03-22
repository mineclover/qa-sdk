#!/bin/bash
# ═══════════════════════════════════════════════════════
#  전체 데모 파이프라인 실행
#
#  registry-service(3300) + ingest-server(3200) + shop-web(5220) + monitor(5176)
#
#  사용법:
#    ./scripts/serve-demo.sh
#    ./scripts/serve-demo.sh --persist   # SQLite 영속화
# ═══════════════════════════════════════════════════════

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

PERSIST=false
for arg in "$@"; do
  case $arg in --persist) PERSIST=true ;; esac
done

PIDS=()
cleanup() {
  echo ""
  echo "🛑 서비스 종료 중..."
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null
  done
  wait 2>/dev/null
  echo "✅ 모든 서비스 종료"
}
trap cleanup EXIT

# ── registry-service (3300) ──
export DEV_DASHBOARD_ENABLED=true
if [ "$PERSIST" = true ]; then
  export SQLITE_PATH="${ROOT_DIR}/data/registry-service.sqlite"
  mkdir -p "$(dirname "$SQLITE_PATH")"
fi

echo "🚀 registry-service (3300)..."
node "${ROOT_DIR}/packages/registry-service/dist/server.js" &
PIDS+=($!)
sleep 2

# ── ingest-server (3200, in-memory) ──
echo "🚀 ingest-server (3200, in-memory)..."
node "${ROOT_DIR}/packages/ingest-server/dist/server.js" &
PIDS+=($!)
sleep 2

# ── shop-web (5220) ──
echo "🚀 shop-web (5220)..."
cd "${ROOT_DIR}/packages/shop-web" && npx serve public -p 5220 -s &
PIDS+=($!)
cd "$ROOT_DIR"
sleep 1

# ── platform-demo / monitor (5176) ──
echo "🚀 monitor (5176)..."
cd "${ROOT_DIR}/packages/platform-demo" && npx serve public -p 5176 -s &
PIDS+=($!)
cd "$ROOT_DIR"
sleep 1

echo ""
echo "═══════════════════════════════════════════"
echo "  QA SDK 데모 파이프라인 실행 중"
echo "═══════════════════════════════════════════"
echo ""
echo "  🛒 쇼핑 데모:     http://localhost:5220"
echo "  📊 3D 모니터:     http://localhost:5176/monitor.html"
echo "  📈 Dev Dashboard: http://localhost:3300/dev/"
echo "  🔧 Registry API:  http://localhost:3300/api/endpoints"
echo "  📡 Ingest Health: http://localhost:3200/health"
echo ""
echo "  Ctrl+C 로 전체 종료"
echo ""

# 포그라운드 대기
wait
