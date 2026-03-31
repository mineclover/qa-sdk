#!/usr/bin/env bash
set -euo pipefail

# ══════════════════════════════════════════════════════════════
#  qa-sdk 전체 복원 스크립트
#  사용법: ./scripts/restore.sh [--date YYYYMMDD] [--dry-run]
# ══════════════════════════════════════════════════════════════

BACKUP_DIR="${BACKUP_DIR:-/backup}"
RESTORE_DATE=""
DRY_RUN=false
ERRORS=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --date) RESTORE_DATE="$2"; shift 2 ;;
    --dry-run) DRY_RUN=true; shift ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

if [[ -z "$RESTORE_DATE" ]]; then
  # 가장 최근 백업 날짜 자동 감지
  RESTORE_DATE=$(ls -1 "$BACKUP_DIR/daily/" 2>/dev/null | grep -oE '[0-9]{8}' | sort -u | tail -1 || true)
  if [[ -z "$RESTORE_DATE" ]]; then
    echo "✗ 백업을 찾을 수 없습니다: $BACKUP_DIR/daily/"
    exit 1
  fi
fi

log()  { echo "[$(date +%H:%M:%S)] $*"; }
ok()   { echo "[$(date +%H:%M:%S)] ✓ $*"; }
fail() { echo "[$(date +%H:%M:%S)] ✗ $*"; ERRORS=$((ERRORS + 1)); }
warn() { echo "[$(date +%H:%M:%S)] ⚠ $*"; }

echo "═══════════════════════════════════════"
echo "  복원 대상 날짜: $RESTORE_DATE"
echo "  백업 디렉토리: $BACKUP_DIR"
echo "═══════════════════════════════════════"
echo ""

# ══════════════════════════════════════════════════════════════
# 1. PostgreSQL pg_restore
# ══════════════════════════════════════════════════════════════

restore_postgres() {
  local db_url="$1"
  local label="$2"
  local dump
  dump=$(ls -1t "$BACKUP_DIR/daily/${label}-${RESTORE_DATE}"*.dump 2>/dev/null | head -1 || true)

  if [[ -z "$dump" ]]; then
    warn "PostgreSQL ${label}: 백업 파일 없음 — 건너뜀"
    return
  fi

  log "PostgreSQL ${label} 복원: $dump"
  if [[ "$DRY_RUN" == true ]]; then
    log "pg_restore $dump → $db_url"
    return
  fi

  if [[ -z "$db_url" ]]; then
    fail "PostgreSQL ${label}: DATABASE_URL 미설정"
    return
  fi

  if pg_restore "$db_url" --clean --if-exists -d "$db_url" "$dump" 2>/dev/null; then
    ok "PostgreSQL ${label} 복원 완료"
  else
    fail "PostgreSQL ${label} 복원 실패"
  fi
}

restore_postgres "${REGISTRY_DATABASE_URL:-}" "registry"
restore_postgres "${TRACE_DATABASE_URL:-}" "trace"

# ══════════════════════════════════════════════════════════════
# 2. DKG decisions import
# ══════════════════════════════════════════════════════════════

restore_dkg() {
  local short_date="${RESTORE_DATE:0:4}-${RESTORE_DATE:4:2}-${RESTORE_DATE:6:2}"
  local json
  json=$(ls -1t "$BACKUP_DIR/daily/dkg-decisions-${short_date}"*.json 2>/dev/null | head -1 || true)

  if [[ -z "$json" ]]; then
    warn "DKG decisions: 백업 파일 없음 — 건너뜀"
    return
  fi

  log "DKG decisions import: $json"
  if [[ "$DRY_RUN" == true ]]; then
    log "qa-sdk dkg import $json"
    return
  fi

  if ! command -v qa-sdk &>/dev/null; then
    warn "qa-sdk CLI 미설치 — DKG 복원 건너뜀"
    return
  fi

  if qa-sdk dkg import "$json" 2>/dev/null; then
    ok "DKG decisions 복원 완료"
  else
    fail "DKG decisions 복원 실패"
  fi
}

restore_dkg

# ══════════════════════════════════════════════════════════════
# 3. SQLite 파일 복원
# ══════════════════════════════════════════════════════════════

restore_sqlite() {
  local label="$1"
  local target="$2"
  local short_date="${RESTORE_DATE:0:4}-${RESTORE_DATE:4:2}-${RESTORE_DATE:6:2}"
  local src
  src=$(ls -1t "$BACKUP_DIR/daily/${label}-${short_date}"*.sqlite 2>/dev/null | head -1 || true)

  if [[ -z "$src" ]]; then
    warn "SQLite ${label}: 백업 파일 없음 — 건너뜀"
    return
  fi

  log "SQLite ${label} 복원: $src → $target"
  if [[ "$DRY_RUN" == true ]]; then
    return
  fi

  if cp "$src" "$target"; then
    ok "SQLite ${label} 복원 완료"
  else
    fail "SQLite ${label} 복원 실패"
  fi
}

restore_sqlite "definition-service" "${DEFINITION_SQLITE_PATH:-data/definition-service.sqlite}"
restore_sqlite "gate-service" "${GATE_SQLITE_PATH:-data/gate-service.sqlite}"
restore_sqlite "query-service" "${QUERY_SQLITE_PATH:-data/query-service.sqlite}"
restore_sqlite "registry-service" "${REGISTRY_SQLITE_PATH:-data/registry-service.sqlite}"
restore_sqlite "dkg-state" "${DKG_SQLITE_PATH:-$HOME/.qa-sdk/state.sqlite}"

# ══════════════════════════════════════════════════════════════
# 3.5. Definition docs archive 복원
# ══════════════════════════════════════════════════════════════

restore_definition_docs() {
  local short_date="${RESTORE_DATE:0:4}-${RESTORE_DATE:4:2}-${RESTORE_DATE:6:2}"
  local archive
  archive=$(ls -1t "$BACKUP_DIR/daily/definition-docs-${short_date}"*.tar.gz 2>/dev/null | head -1 || true)

  if [[ -z "$archive" ]]; then
    warn "Definition docs: 백업 파일 없음 — 건너뜀"
    return
  fi

  log "Definition docs 복원: $archive"
  if [[ "$DRY_RUN" == true ]]; then
    return
  fi

  if tar -xzf "$archive"; then
    ok "Definition docs 복원 완료"
  else
    fail "Definition docs 복원 실패"
  fi
}

restore_definition_docs

# ══════════════════════════════════════════════════════════════
# 4. 카탈로그 API 복원
# ══════════════════════════════════════════════════════════════

restore_catalogs() {
  local base_url="${REGISTRY_SERVICE_URL:-http://localhost:3300}"
  local short_date="${RESTORE_DATE:0:4}-${RESTORE_DATE:4:2}-${RESTORE_DATE:6:2}"
  local json
  json=$(ls -1t "$BACKUP_DIR/daily/catalogs-${short_date}"*.json 2>/dev/null | head -1 || true)

  if [[ -z "$json" ]]; then
    warn "카탈로그: 백업 파일 없음 — 건너뜀"
    return
  fi

  log "카탈로그 API 복원: $json"
  if [[ "$DRY_RUN" == true ]]; then
    return
  fi

  # JSON 배열에서 개별 카탈로그를 추출하여 POST
  local count=0
  while IFS= read -r catalog; do
    if curl -sf -X POST "${base_url}/catalogs" \
      -H 'Content-Type: application/json' \
      -d "$catalog" >/dev/null 2>&1; then
      count=$((count + 1))
    fi
  done < <(jq -c '.[]' "$json" 2>/dev/null || true)

  if [[ "$count" -gt 0 ]]; then
    ok "카탈로그 ${count}개 복원 완료"
  else
    warn "카탈로그 복원: 0개 (서비스 미실행 또는 파일 형식 오류)"
  fi
}

restore_catalogs

# ══════════════════════════════════════════════════════════════
# 5. Health check 검증
# ══════════════════════════════════════════════════════════════

health_check() {
  local name="$1"
  local url="$2"

  if [[ "$DRY_RUN" == true ]]; then
    log "health check: $name ($url)"
    return
  fi

  if curl -sf "$url" >/dev/null 2>&1; then
    ok "Health OK: $name"
  else
    warn "Health FAIL: $name ($url) — 서비스 미실행일 수 있음"
  fi
}

echo ""
log "서비스 health check 시작..."
health_check "ingest-server" "http://localhost:${INGEST_SERVER_PORT:-3200}/health/live"
health_check "registry-server" "http://localhost:${REGISTRY_SERVER_PORT:-3001}/health/live"
health_check "registry-service" "http://localhost:${REGISTRY_SERVICE_PORT:-3300}/health/live"
health_check "gate-service" "http://localhost:${GATE_SERVICE_PORT:-3400}/health"
health_check "query-service" "http://localhost:${QUERY_SERVICE_PORT:-3500}/health"
health_check "decode-service" "http://localhost:${DECODE_SERVICE_PORT:-3600}/health"

# ══════════════════════════════════════════════════════════════
# 결과 요약
# ══════════════════════════════════════════════════════════════

echo ""
echo "═══════════════════════════════════════"
echo "  복원 완료: $(date)"
echo "  에러: $ERRORS"
echo "═══════════════════════════════════════"

exit "$ERRORS"
