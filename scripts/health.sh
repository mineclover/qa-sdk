#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════
#  QA-SDK Health Check — 전 서비스 상태 확인
#
#  사용법: pnpm health
# ═══════════════════════════════════════════════════════

G='\033[0;32m' R='\033[0;31m' Y='\033[0;33m' C='\033[0;36m' D='\033[0;90m' N='\033[0m'

check() {
  local name=$1 url=$2 port=$3
  local status
  status=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 2 "$url" 2>/dev/null)
  if [ "$status" = "200" ]; then
    echo -e "  ${G}●${N} ${name}  ${D}:${port}${N}  ${G}${status}${N}"
  else
    echo -e "  ${R}○${N} ${name}  ${D}:${port}${N}  ${R}${status:-timeout}${N}"
  fi
}

echo ""
echo -e "${C}═══ QA-SDK Service Health ═══${N}"
echo ""

echo -e "${Y}── Local Services ──${N}"
check "registry-service     " "http://localhost:3300/health"      3300
check "ingest-server        " "http://localhost:3200/health"      3200
check "gate-service          " "http://localhost:3400/health"      3400
check "query-service         " "http://localhost:3500/health"      3500
check "decode-service        " "http://localhost:3600/health"      3600
check "shop-web              " "http://localhost:5220"             5220
check "platform-demo         " "http://localhost:5176"             5176

echo ""
echo -e "${Y}── CF Workers (prod) ──${N}"
check "registry-service     " "https://qa-registry-service.astralclover.workers.dev/health"  "CF"
check "ingest-server        " "https://qa-ingest-server.astralclover.workers.dev/health"     "CF"
check "gate-service          " "https://qa-gate-service.astralclover.workers.dev/health"      "CF"
check "query-service         " "https://qa-query-service.astralclover.workers.dev/health"     "CF"
check "decode-service        " "https://qa-decode-service.astralclover.workers.dev/health"    "CF"
check "shopping-web          " "https://shop-web-7dq.pages.dev"                               "CF"
check "platform-demo         " "https://platform-demo-3v1.pages.dev"                          "CF"

echo ""
echo -e "${Y}── Infrastructure ──${N}"
# PostgreSQL
pg_status=$(pg_isready -h localhost -p 5432 2>/dev/null && echo "ready" || echo "down")
if [ "$pg_status" = "ready" ]; then
  echo -e "  ${G}●${N} PostgreSQL            ${D}:5432${N}  ${G}ready${N}"
else
  echo -e "  ${D}○${N} PostgreSQL            ${D}:5432${N}  ${D}not running${N}"
fi

# Redis
redis_status=$(redis-cli -h localhost -p 6379 ping 2>/dev/null)
if [ "$redis_status" = "PONG" ]; then
  echo -e "  ${G}●${N} Redis                 ${D}:6379${N}  ${G}PONG${N}"
else
  echo -e "  ${D}○${N} Redis                 ${D}:6379${N}  ${D}not running${N}"
fi

echo ""
