#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════
#  QA-SDK Local Development Setup
#
#  사용법: pnpm setup
#  또는:   bash scripts/setup.sh
# ═══════════════════════════════════════════════════════
set -e

G='\033[0;32m' Y='\033[0;33m' R='\033[0;31m' C='\033[0;36m' N='\033[0m'
ok() { echo -e "  ${G}✓${N} $1"; }
warn() { echo -e "  ${Y}⚠${N} $1"; }
fail() { echo -e "  ${R}✕${N} $1"; }
info() { echo -e "  ${C}→${N} $1"; }

echo ""
echo -e "${C}═══ QA-SDK Development Setup ═══${N}"
echo ""

# ── 1. Prerequisites ──
echo -e "${Y}[1/5]${N} Prerequisites"
command -v node >/dev/null 2>&1 && ok "Node.js $(node -v)" || { fail "Node.js not found"; exit 1; }
command -v pnpm >/dev/null 2>&1 && ok "pnpm $(pnpm -v)" || { fail "pnpm not found — npm i -g pnpm"; exit 1; }

# ── 2. Dependencies ──
echo -e "${Y}[2/5]${N} Dependencies"
if [ -d "node_modules" ]; then
  ok "node_modules exists (skip install)"
else
  info "Installing dependencies..."
  pnpm install --frozen-lockfile 2>&1 | tail -1
  ok "Dependencies installed"
fi

# ── 3. Environment files ──
echo -e "${Y}[3/5]${N} Environment"
if [ ! -f ".env" ] && [ -f ".env.example" ]; then
  cp .env.example .env
  ok ".env created from .env.example"
elif [ -f ".env" ]; then
  ok ".env exists"
else
  warn "No .env.example found"
fi

# Per-package .env
for pkg in packages/ingest-server packages/store; do
  if [ -f "$pkg/.env.example" ] && [ ! -f "$pkg/.env" ]; then
    cp "$pkg/.env.example" "$pkg/.env"
    ok "$pkg/.env created"
  fi
done

# ── 4. Build ──
echo -e "${Y}[4/5]${N} Build"
info "Building all packages..."
pnpm build 2>&1 | tail -3
ok "Build complete"

# ── 5. Verify ──
echo -e "${Y}[5/5]${N} Verify"
# Check key packages built
for pkg in core logger codec context demo-snapshot; do
  if [ -d "packages/$pkg/dist" ]; then
    ok "$pkg → dist/"
  else
    warn "$pkg has no dist/ (may not need build)"
  fi
done

echo ""
echo -e "${G}═══ Setup Complete ═══${N}"
echo ""
echo -e "  Next steps:"
echo -e "  ${C}pnpm demo${N}          — Start full dev stack (4 servers)"
echo -e "  ${C}pnpm health${N}        — Check all service health"
echo -e "  ${C}pnpm dev:registry${N}  — Registry service only"
echo -e "  ${C}pnpm dev:ingest${N}    — Ingest server only"
echo ""
echo -e "  URLs:"
echo -e "  ${C}http://localhost:3300${N}      — Registry Service"
echo -e "  ${C}http://localhost:3200${N}      — Ingest Server"
echo -e "  ${C}http://localhost:5220${N}      — Shop Web Demo"
echo -e "  ${C}http://localhost:5176${N}      — Platform Demo"
echo -e "  ${C}http://localhost:5176/debugger.html${N} — Dev Debugger"
echo ""
