#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════
#  QA-SDK → Verdaccio 로컬 배포
#
#  사용법:
#    1. corepack pnpm registry     (Verdaccio 시작)
#    2. corepack pnpm publish:local (이 스크립트 — 전 패키지 publish)
#
#  소비자:
#    npm install @qa-sdk/core --registry http://localhost:4873
# ═══════════════════════════════════════════════════════
set -e

REGISTRY="http://localhost:4873"
G='\033[0;32m' R='\033[0;31m' N='\033[0m'

echo ""
echo -e "═══ QA-SDK → Verdaccio ($REGISTRY) ═══"
echo ""

# Verdaccio 접근 확인
if ! curl -s "$REGISTRY/-/ping" > /dev/null 2>&1; then
  echo -e "${R}✕${N} Verdaccio가 실행 중이지 않습니다."
  echo "  먼저 실행: corepack pnpm registry"
  exit 1
fi

# 빌드
echo "빌드 중..."
corepack pnpm build 2>&1 | tail -1

echo ""

# 패키지 순서 (의존 관계)
PACKAGES=(
  "pino"
  "weighted-index"
  "bit-index"
  "permission-engine"
  "index-meta"
  "core"
  "demo-snapshot"
  "browser-codec"
  "logger"
  "codec"
  "context"
  "sdk"
  "apm"
  "registry-client"
)

for pkg in "${PACKAGES[@]}"; do
  DIR="packages/$pkg"
  if [ ! -d "$DIR" ]; then continue; fi

  NAME=$(node -e "console.log(require('./$DIR/package.json').name)")
  VER=$(node -e "console.log(require('./$DIR/package.json').version)")

  # 이미 배포됐는지 확인
  EXISTS=$(npm view "$NAME@$VER" version --registry "$REGISTRY" 2>/dev/null || echo "")
  if [ "$EXISTS" = "$VER" ]; then
    echo -e "  ⏭ $NAME@$VER (이미 배포됨)"
    continue
  fi

  cd "$DIR"
  npm publish --registry "$REGISTRY" --access public --no-git-checks 2>&1 | tail -1
  echo -e "  ${G}✓${N} $NAME@$VER"
  cd - > /dev/null
done

echo ""
echo -e "${G}═══ 배포 완료 ═══${N}"
echo ""
echo "  소비자 설치:"
echo "    npm install @qa-sdk/core --registry $REGISTRY"
echo "    npm install @qa-sdk/sdk --registry $REGISTRY"
echo ""
echo "  .npmrc 설정 (프로젝트별):"
echo "    echo 'registry=$REGISTRY' > .npmrc"
echo ""
