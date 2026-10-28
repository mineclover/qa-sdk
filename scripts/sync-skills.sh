#!/usr/bin/env bash
# skills/ 원본에서 선택한 스킬만 프로젝트 실행 위치로 복제한다. 전역에는 쓰지 않는다.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"
REPO_SKILLS="$REPO_ROOT/skills"
DRY_RUN=false
TARGET=all
SELECTED=()

usage() {
  echo "사용법: ./scripts/sync-skills.sh [--dry-run] [--target all|claude|codex|antigravity] [--skill <name>]"
  echo "기본: scripts/project-skills.txt → .agents/skills/, .claude/skills/"
  echo "--skill은 해당 작업의 추가 스킬이며, 다음 기본 동기화에서 실행 복제본만 해제된다."
}

while IFS= read -r skill || [[ -n "$skill" ]]; do
  [[ -z "$skill" || "$skill" == \#* ]] && continue
  SELECTED+=("$skill")
done < "$REPO_ROOT/scripts/project-skills.txt"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --) shift ;;
    --dry-run) DRY_RUN=true; shift ;;
    --target|--skill)
      [[ $# -ge 2 && -n "$2" ]] || { usage; exit 1; }
      if [[ "$1" == --target ]]; then TARGET="$2"; else SELECTED+=("$2"); fi
      shift 2
      ;;
    --help|-h) usage; exit 0 ;;
    *) echo "지원하지 않는 옵션: $1 (전역 배포는 지원하지 않는다.)" >&2; usage; exit 1 ;;
  esac
done

TARGETS=()
case "$TARGET" in
  all) TARGETS=(.agents/skills .claude/skills) ;;
  codex|antigravity) TARGETS=(.agents/skills) ;;
  claude) TARGETS=(.claude/skills) ;;
  *) usage; exit 1 ;;
esac

# 잘못된 선택이나 검색 루트 링크가 있어도 부분 적용하지 않도록 쓰기 전에 검사한다.
[[ ${#SELECTED[@]} -gt 0 ]] || { echo "프로젝트 기본 스킬 목록이 비어 있다." >&2; exit 1; }
for skill in "${SELECTED[@]}"; do
  [[ "$skill" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ && -f "$REPO_SKILLS/$skill/SKILL.md" ]] || {
    echo "유효하지 않은 repo 스킬: $skill" >&2; exit 1;
  }
done
[[ ! -L "$REPO_ROOT/.skill-sync-backups" ]] || { echo "백업 루트가 링크이므로 중단" >&2; exit 1; }
for target in "${TARGETS[@]}"; do
  [[ ! -L "$REPO_ROOT/${target%%/*}" && ! -L "$REPO_ROOT/$target" ]] || {
    echo "프로젝트 검색 루트가 링크이므로 중단: $target" >&2; exit 1;
  }
done

is_selected() {
  local wanted="$1" selected
  for selected in "${SELECTED[@]}"; do [[ "$selected" == "$wanted" ]] && return 0; done
  return 1
}

BACKUP_ROOT="$REPO_ROOT/.skill-sync-backups/$(date -u +%Y%m%dT%H%M%SZ)-$$"
archive_runtime() {
  local target="$1" skill="$2"
  mkdir -p "$BACKUP_ROOT/$target"
  mv "$REPO_ROOT/$target/$skill" "$BACKUP_ROOT/$target/$skill"
}

for target in "${TARGETS[@]}"; do
  for source in "$REPO_SKILLS"/*; do
    [[ -d "$source" && -f "$source/SKILL.md" ]] || continue
    skill="${source##*/}"
    destination="$REPO_ROOT/$target/$skill"
    if is_selected "$skill"; then
      if [[ -L "$destination" ]] || ! diff -qr "$source" "$destination" >/dev/null 2>&1; then
        echo "[$target][sync] $skill"
        if ! $DRY_RUN; then
          if [[ -e "$destination" || -L "$destination" ]]; then archive_runtime "$target" "$skill"; fi
          mkdir -p "$REPO_ROOT/$target"
          cp -pR "$source" "$destination"
        fi
      fi
    elif [[ -e "$destination" || -L "$destination" ]]; then
      echo "[$target][deactivate] $skill (원본 skills/$skill 보존)"
      if ! $DRY_RUN; then archive_runtime "$target" "$skill"; fi
    fi
  done
done

if $DRY_RUN; then
  echo "dry-run: 실제 변경 없음"
elif [[ -d "$BACKUP_ROOT" ]]; then
  echo "실행 복제본 백업: $BACKUP_ROOT"
fi
echo "프로젝트 스킬 확인 완료: $REPO_ROOT (target=$TARGET)"
