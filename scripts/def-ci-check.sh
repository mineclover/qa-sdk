#!/bin/bash
# def-ci-check — CI/CD 문서 정합성 자동 검증
#
# Usage:
#   ./scripts/def-ci-check.sh                    # 전체 검증
#   ./scripts/def-ci-check.sh gate-state-model   # 특정 문서 변경 체크
#   ./scripts/def-ci-check.sh $(git diff --name-only docs/specs/ | sed 's/.*\///' | sed 's/\..*//') # git diff 기반

set -e

CLI="node packages/cli/dist/index.js"
EXIT_CODE=0

echo "=== 문서 정합성 검증 ==="
$CLI def validate 2>/dev/null
echo ""

# 변경 대상이 있으면 각각 check
if [ $# -gt 0 ]; then
  echo "=== 변경 대상 영향 분석 ==="
  for doc in "$@"; do
    echo "--- $doc ---"
    $CLI def check "$doc" 2>/dev/null
    $CLI def impact "$doc" 2>/dev/null
    echo ""
  done
fi

echo "=== 완료 ==="
