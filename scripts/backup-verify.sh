#!/usr/bin/env bash
set -euo pipefail

# ══════════════════════════════════════════════════════════════
#  qa-sdk 백업 무결성 검증 스크립트
#  사용법: ./scripts/backup-verify.sh
# ══════════════════════════════════════════════════════════════

BACKUP_DIR="${BACKUP_DIR:-/backup}"
BACKUP_MAX_AGE_HOURS="${BACKUP_MAX_AGE_HOURS:-24}"
ERRORS=0
WARNINGS=0
CHECKS=0

log()  { echo "[$(date +%H:%M:%S)] $*"; }
ok()   { echo "[$(date +%H:%M:%S)] ✓ $*"; CHECKS=$((CHECKS + 1)); }
warn() { echo "[$(date +%H:%M:%S)] ⚠ $*"; WARNINGS=$((WARNINGS + 1)); }
fail() { echo "[$(date +%H:%M:%S)] ✗ $*"; ERRORS=$((ERRORS + 1)); }

echo "═══════════════════════════════════════"
echo "  백업 무결성 검증"
echo "  대상: $BACKUP_DIR"
echo "═══════════════════════════════════════"
echo ""

# ══════════════════════════════════════════════════════════════
# 1. 백업 디렉토리 존재 확인
# ══════════════════════════════════════════════════════════════

if [[ ! -d "$BACKUP_DIR/daily" ]]; then
  fail "백업 디렉토리 없음: $BACKUP_DIR/daily"
  echo "백업이 한 번도 실행되지 않았습니다."
  exit 1
fi
ok "백업 디렉토리 존재"

# ══════════════════════════════════════════════════════════════
# 공통 유틸리티: 파일 age 검사
# ══════════════════════════════════════════════════════════════

check_age() {
  local file="$1"
  local label="$2"

  local mtime
  mtime=$(stat -f%m "$file" 2>/dev/null || stat -c%Y "$file" 2>/dev/null || echo "0")
  local now
  now=$(date +%s)
  local age_hours=$(( (now - mtime) / 3600 ))

  if [[ "$age_hours" -gt "$BACKUP_MAX_AGE_HOURS" ]]; then
    warn "${label}: 백업 ${age_hours}시간 경과 (임계값: ${BACKUP_MAX_AGE_HOURS}시간)"
  fi
}

# ══════════════════════════════════════════════════════════════
# 2. PostgreSQL dump 파일 검증
# ══════════════════════════════════════════════════════════════

verify_pg_dump() {
  local label="$1"
  local latest
  latest=$(ls -1t "$BACKUP_DIR/daily/${label}-"*.dump 2>/dev/null | head -1 || true)

  if [[ -z "$latest" ]]; then
    fail "pg_dump 파일 없음: ${label}"
    return
  fi

  # 파일 크기 확인 (0바이트 아닌지)
  local size
  size=$(stat -f%z "$latest" 2>/dev/null || stat -c%s "$latest" 2>/dev/null || echo "0")
  if [[ "$size" -eq 0 ]]; then
    fail "pg_dump 파일 크기 0: $latest"
    return
  fi

  # 파일 age 확인
  check_age "$latest" "$label pg_dump"

  ok "pg_dump ${label}: $(du -h "$latest" | cut -f1) — $latest"
}

verify_pg_dump "registry"
verify_pg_dump "trace"

# ══════════════════════════════════════════════════════════════
# 3. DKG JSON 파일 검증
# ══════════════════════════════════════════════════════════════

verify_json() {
  local pattern="$1"
  local label="$2"
  local latest
  latest=$(ls -1t $BACKUP_DIR/daily/${pattern}*.json 2>/dev/null | head -1 || true)

  if [[ -z "$latest" ]]; then
    warn "JSON 파일 없음: ${label} — qa-sdk CLI 미설치일 수 있음"
    return
  fi

  # JSON 파싱 가능 확인
  if command -v jq &>/dev/null; then
    if jq empty "$latest" 2>/dev/null; then
      ok "JSON 유효: ${label} — $latest"
    else
      fail "JSON 파싱 실패: $latest"
      return
    fi
  elif command -v python3 &>/dev/null; then
    if python3 -c "import json; json.load(open('$latest'))" 2>/dev/null; then
      ok "JSON 유효: ${label} — $latest"
    else
      fail "JSON 파싱 실패: $latest"
      return
    fi
  else
    warn "jq/python3 없음 — JSON 파싱 검증 건너뜀"
  fi

  check_age "$latest" "$label"
}

verify_json "dkg-decisions" "DKG decisions"
verify_json "catalogs" "카탈로그"

# ══════════════════════════════════════════════════════════════
# 4. SQLite 파일 검증
# ══════════════════════════════════════════════════════════════

verify_sqlite() {
  local label="$1"
  local latest
  latest=$(ls -1t "$BACKUP_DIR/daily/${label}-"*.sqlite 2>/dev/null | head -1 || true)

  if [[ -z "$latest" ]]; then
    warn "SQLite 파일 없음: ${label}"
    return
  fi

  # SQLite 열기 가능 확인
  if command -v sqlite3 &>/dev/null; then
    if sqlite3 "$latest" "SELECT 1" >/dev/null 2>&1; then
      ok "SQLite 유효: ${label} — $(du -h "$latest" | cut -f1)"
    else
      fail "SQLite 열기 실패: $latest"
      return
    fi
  else
    # sqlite3 없으면 파일 헤더만 확인
    local header
    header=$(head -c 16 "$latest" 2>/dev/null | tr -d '\0' || true)
    if [[ "$header" == "SQLite format 3"* ]]; then
      ok "SQLite 헤더 유효: ${label} — $(du -h "$latest" | cut -f1)"
    else
      fail "SQLite 헤더 불일치: $latest"
      return
    fi
  fi

  check_age "$latest" "$label"
}

verify_sqlite "gate-service"
verify_sqlite "query-service"
verify_sqlite "registry-service"
verify_sqlite "dkg-state"

# ══════════════════════════════════════════════════════════════
# 5. 보존 정책 현황
# ══════════════════════════════════════════════════════════════

echo ""
log "── 백업 현황 ──"
daily_count=$(find "$BACKUP_DIR/daily" -type f 2>/dev/null | wc -l | tr -d ' ')
weekly_count=$(find "$BACKUP_DIR/weekly" -type f 2>/dev/null | wc -l | tr -d ' ')
total_size=$(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1 || echo "N/A")
log "  Daily:  ${daily_count}개 파일"
log "  Weekly: ${weekly_count}개 파일"
log "  총 크기: ${total_size}"

# ══════════════════════════════════════════════════════════════
# 결과 요약
# ══════════════════════════════════════════════════════════════

echo ""
echo "═══════════════════════════════════════"
echo "  검증 완료: 통과 $CHECKS / 경고 $WARNINGS / 실패 $ERRORS"
echo "═══════════════════════════════════════"

if [[ "$ERRORS" -gt 0 ]]; then
  exit 1
fi
exit 0
