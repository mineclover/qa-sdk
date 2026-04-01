#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════
#  QA-SDK 라이브러리 링크 — 외부 프로젝트에서 사용
#
#  사용법:
#    bash /path/to/qa-sdk/scripts/link-sdk.sh [target-dir]
#
#  target-dir의 node_modules에 @qa-sdk/* 패키지를 symlink.
#  npm/pnpm install 없이 바로 import 가능.
# ═══════════════════════════════════════════════════════
set -e

QA_SDK_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="${1:-.}"

echo "QA-SDK root: $QA_SDK_ROOT"
echo "Target: $TARGET"
echo ""

mkdir -p "$TARGET/node_modules/@qa-sdk"
mkdir -p "$TARGET/node_modules/@msgpack"

# @qa-sdk/* 패키지
for pkg in core logger codec context sdk apm browser-codec registry-client pino; do
  ln -sfn "$QA_SDK_ROOT/packages/$pkg" "$TARGET/node_modules/@qa-sdk/$pkg"
  echo "  ✅ @qa-sdk/$pkg"
done

# 인코딩 라이브러리
for pkg in weighted-index bit-index permission-engine index-meta demo-snapshot; do
  ln -sfn "$QA_SDK_ROOT/packages/$pkg" "$TARGET/node_modules/$pkg"
  echo "  ✅ $pkg"
done

# 런타임 의존성 (pnpm store에서)
PNPM_MODULES="$QA_SDK_ROOT/node_modules/.pnpm"
for dep in zod ulid pino; do
  DEP_DIR=$(find "$PNPM_MODULES" -maxdepth 2 -name "$dep" -path "*/node_modules/$dep" | head -1)
  if [ -n "$DEP_DIR" ]; then
    ln -sfn "$DEP_DIR" "$TARGET/node_modules/$dep"
    echo "  ✅ $dep (from pnpm store)"
  fi
done

MSGPACK_DIR=$(find "$PNPM_MODULES" -maxdepth 3 -name "msgpack" -path "*/@msgpack/msgpack" | head -1)
if [ -n "$MSGPACK_DIR" ]; then
  ln -sfn "$MSGPACK_DIR" "$TARGET/node_modules/@msgpack/msgpack"
  echo "  ✅ @msgpack/msgpack"
fi

echo ""
echo "✅ 링크 완료. 사용법:"
echo ""
echo '  import { DEMO_CATALOG } from "demo-snapshot";'
echo '  import { encodePrefix, decodePrefixAsResult } from "@qa-sdk/core";'
echo '  import { createRegistryConfigClient } from "@qa-sdk/registry-client";'
echo ""
