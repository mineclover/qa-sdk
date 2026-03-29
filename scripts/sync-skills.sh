#!/usr/bin/env bash
# sync-skills.sh — repo skills/ → ~/.claude/skills/ 단방향 동기화
#
# 사용:
#   ./scripts/sync-skills.sh          # 전체 동기화
#   ./scripts/sync-skills.sh --dry-run # 변경 사항만 표시
#
# 원칙:
#   - repo skills/ 가 SSOT (Single Source of Truth)
#   - ~/.claude/skills/ 는 실행 위치 (Claude Code가 읽는 곳)
#   - 동기화 방향: repo → home (역방향 금지)
#   - ~/.claude/skills/ 에만 있는 skill은 건드리지 않음 (e2e-test, ralph-* 등)

set -euo pipefail

REPO_SKILLS="$(cd "$(dirname "$0")/.." && pwd)/skills"
HOME_SKILLS="$HOME/.claude/skills"
DRY_RUN=false

if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=true
fi

if [[ ! -d "$REPO_SKILLS" ]]; then
  echo "repo skills/ 디렉토리 없음: $REPO_SKILLS"
  exit 1
fi

mkdir -p "$HOME_SKILLS"

synced=0
skipped=0
created=0

for skill_dir in "$REPO_SKILLS"/*/; do
  skill_name=$(basename "$skill_dir")
  src="$skill_dir/SKILL.md"
  dst="$HOME_SKILLS/$skill_name/SKILL.md"

  if [[ ! -f "$src" ]]; then
    continue
  fi

  if [[ ! -d "$HOME_SKILLS/$skill_name" ]]; then
    # 새 skill — 디렉토리 생성 + 복사
    if $DRY_RUN; then
      echo "[create] $skill_name"
    else
      mkdir -p "$HOME_SKILLS/$skill_name"
      cp "$src" "$dst"
      echo "[create] $skill_name"
    fi
    created=$((created + 1))
  elif ! diff -q "$src" "$dst" > /dev/null 2>&1; then
    # 불일치 — 덮어쓰기
    if $DRY_RUN; then
      echo "[update] $skill_name"
      diff --color=auto "$dst" "$src" | head -20 || true
      echo ""
    else
      cp "$src" "$dst"
      echo "[update] $skill_name"
    fi
    synced=$((synced + 1))
  else
    skipped=$((skipped + 1))
  fi
done

echo ""
echo "동기화 완료: created=$created updated=$synced unchanged=$skipped"
if $DRY_RUN; then
  echo "(dry-run — 실제 변경 없음)"
fi
