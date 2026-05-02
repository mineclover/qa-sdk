#!/usr/bin/env bash
# sync-skills.sh — repo skills/ → ~/.claude/skills/, ~/.codex/skills/ 단방향 동기화
#
# 사용:
#   ./scripts/sync-skills.sh                    # 전체 동기화
#   ./scripts/sync-skills.sh --dry-run          # 변경 사항만 표시
#   ./scripts/sync-skills.sh --target codex     # Codex만 동기화
#   ./scripts/sync-skills.sh --target claude    # Claude만 동기화
#
# 원칙:
#   - repo skills/ 가 SSOT (Single Source of Truth)
#   - ~/.claude/skills/, ~/.codex/skills/ 는 실행 위치
#   - 동기화 방향: repo → home (역방향 금지)
#   - home 쪽에만 있는 skill은 건드리지 않음 (다른 프로젝트용 사용자 skill 보존)

set -euo pipefail

REPO_SKILLS="$(cd "$(dirname "$0")/.." && pwd)/skills"
DRY_RUN=false
TARGET="all"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --)
      shift
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --target)
      TARGET="${2:-}"
      if [[ -z "$TARGET" ]]; then
        echo "--target 값 필요: all | claude | codex"
        exit 1
      fi
      shift 2
      ;;
    *)
      echo "알 수 없는 옵션: $1"
      echo "사용법: ./scripts/sync-skills.sh [--dry-run] [--target all|claude|codex]"
      exit 1
      ;;
  esac
done

if [[ ! -d "$REPO_SKILLS" ]]; then
  echo "repo skills/ 디렉토리 없음: $REPO_SKILLS"
  exit 1
fi

TARGETS=()
case "$TARGET" in
  all)
    TARGETS+=("claude:$HOME/.claude/skills")
    TARGETS+=("codex:$HOME/.codex/skills")
    ;;
  claude)
    TARGETS+=("claude:$HOME/.claude/skills")
    ;;
  codex)
    TARGETS+=("codex:$HOME/.codex/skills")
    ;;
  *)
    echo "지원하지 않는 target: $TARGET"
    echo "사용 가능한 값: all | claude | codex"
    exit 1
    ;;
esac

sync_target() {
  local label="$1"
  local home_skills="$2"
  local synced=0
  local skipped=0
  local created=0

  mkdir -p "$home_skills"

  for skill_dir in "$REPO_SKILLS"/*/; do
    local skill_name src dst dst_dir
    skill_name=$(basename "$skill_dir")
    src="$skill_dir/SKILL.md"
    dst_dir="$home_skills/$skill_name"
    dst="$dst_dir/SKILL.md"

    if [[ ! -f "$src" ]]; then
      continue
    fi

    if [[ ! -d "$dst_dir" ]]; then
      if $DRY_RUN; then
        echo "[$label][create] $skill_name"
      else
        mkdir -p "$dst_dir"
        cp "$src" "$dst"
        echo "[$label][create] $skill_name"
      fi
      created=$((created + 1))
    elif ! cmp -s "$src" "$dst"; then
      if $DRY_RUN; then
        echo "[$label][update] $skill_name"
        diff --color=auto "$dst" "$src" | head -20 || true
        echo ""
      else
        cp "$src" "$dst"
        echo "[$label][update] $skill_name"
      fi
      synced=$((synced + 1))
    else
      skipped=$((skipped + 1))
    fi
  done

  echo ""
  echo "[$label] 동기화 완료: created=$created updated=$synced unchanged=$skipped"
}

for entry in "${TARGETS[@]}"; do
  IFS=":" read -r label path <<< "$entry"
  sync_target "$label" "$path"
done

if $DRY_RUN; then
  echo "(dry-run — 실제 변경 없음)"
fi
