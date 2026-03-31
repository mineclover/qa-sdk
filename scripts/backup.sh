#!/usr/bin/env bash
set -euo pipefail

# ══════════════════════════════════════════════════════════════
#  qa-sdk 전체 백업 스크립트
#  사용법: ./scripts/backup.sh [--dry-run]
# ══════════════════════════════════════════════════════════════

BACKUP_DIR="${BACKUP_DIR:-/backup}"
BACKUP_RETENTION_DAILY="${BACKUP_RETENTION_DAILY:-30}"
BACKUP_RETENTION_WEEKLY="${BACKUP_RETENTION_WEEKLY:-90}"
DATE=$(date +%Y%m%d_%H%M%S)
DATE_SHORT=$(date +%F)
DAY_OF_WEEK=$(date +%u)  # 1=Monday, 7=Sunday
DRY_RUN=false
ERRORS=0
WARNINGS=0

if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=true
  echo "[DRY-RUN] 실제 백업을 수행하지 않습니다."
fi

log()  { echo "[$(date +%H:%M:%S)] $*"; }
warn() { echo "[$(date +%H:%M:%S)] ⚠ $*"; WARNINGS=$((WARNINGS + 1)); }
fail() { echo "[$(date +%H:%M:%S)] ✗ $*"; ERRORS=$((ERRORS + 1)); }
ok()   { echo "[$(date +%H:%M:%S)] ✓ $*"; }

# ── 디렉토리 생성 ──
ensure_dir() {
  local dir="$1"
  if [[ "$DRY_RUN" == true ]]; then
    log "mkdir -p $dir"
  else
    mkdir -p "$dir"
  fi
}

ensure_dir "$BACKUP_DIR/daily"
ensure_dir "$BACKUP_DIR/weekly"

# ══════════════════════════════════════════════════════════════
# 1. PostgreSQL pg_dump
# ══════════════════════════════════════════════════════════════

backup_postgres() {
  local db_url="$1"
  local label="$2"
  local out="$BACKUP_DIR/daily/${label}-${DATE}.dump"

  if [[ -z "$db_url" ]]; then
    warn "PostgreSQL ${label}: URL이 설정되지 않음 — 건너뜀"
    return
  fi

  log "PostgreSQL ${label} 백업 시작..."
  if [[ "$DRY_RUN" == true ]]; then
    log "pg_dump $db_url → $out"
    return
  fi

  if pg_dump "$db_url" --format=custom --compress=9 -f "$out" 2>/dev/null; then
    ok "PostgreSQL ${label} → $(du -h "$out" | cut -f1)"
  else
    fail "PostgreSQL ${label} pg_dump 실패"
  fi
}

backup_postgres "${REGISTRY_DATABASE_URL:-}" "registry"
backup_postgres "${TRACE_DATABASE_URL:-}" "trace"

# ══════════════════════════════════════════════════════════════
# 2. DKG decisions export (JSON)
# ══════════════════════════════════════════════════════════════

backup_dkg() {
  local out="$BACKUP_DIR/daily/dkg-decisions-${DATE_SHORT}.json"

  if ! command -v qa-sdk &>/dev/null; then
    warn "qa-sdk CLI를 찾을 수 없음 — DKG 백업 건너뜀"
    return
  fi

  log "DKG decisions export 시작..."
  if [[ "$DRY_RUN" == true ]]; then
    log "qa-sdk dkg export --output $out"
    return
  fi

  if qa-sdk dkg export --output "$out" 2>/dev/null; then
    ok "DKG decisions → $out"
  else
    warn "DKG decisions export 실패 — 건너뜀"
  fi
}

backup_dkg

# ══════════════════════════════════════════════════════════════
# 2.5. Definition metadata reverse sync (best effort)
# ══════════════════════════════════════════════════════════════

sync_definition_metadata_to_files() {
  local base_url="${DEFINITION_SERVICE_URL:-http://localhost:3700}"

  log "definition metadata 역동기화 시도..."
  if [[ "$DRY_RUN" == true ]]; then
    log "curl -X POST ${base_url}/sync/to-files"
    return
  fi

  if curl -sf -X POST "${base_url}/sync/to-files" >/dev/null 2>&1; then
    ok "definition metadata → docs frontmatter 역동기화 완료"
  else
    warn "definition metadata 역동기화 실패 — definition DB 백업만 수행"
  fi
}

sync_definition_metadata_to_files

# ══════════════════════════════════════════════════════════════
# 3. SQLite 파일 복사 (definition / gate / query / registry-service)
# ══════════════════════════════════════════════════════════════

backup_sqlite() {
  local src="$1"
  local label="$2"
  local out="$BACKUP_DIR/daily/${label}-${DATE_SHORT}.sqlite"

  if [[ ! -f "$src" ]]; then
    warn "SQLite ${label}: $src 파일 없음 — 건너뜀"
    return
  fi

  log "SQLite ${label} 백업 시작..."
  if [[ "$DRY_RUN" == true ]]; then
    log "cp $src → $out"
    return
  fi

  if cp "$src" "$out"; then
    ok "SQLite ${label} → $(du -h "$out" | cut -f1)"
  else
    fail "SQLite ${label} 복사 실패"
  fi
}

backup_sqlite "${DEFINITION_SQLITE_PATH:-data/definition-service.sqlite}" "definition-service"
backup_sqlite "${GATE_SQLITE_PATH:-data/gate-service.sqlite}" "gate-service"
backup_sqlite "${QUERY_SQLITE_PATH:-data/query-service.sqlite}" "query-service"
backup_sqlite "${REGISTRY_SQLITE_PATH:-data/registry-service.sqlite}" "registry-service"
backup_sqlite "${DKG_SQLITE_PATH:-$HOME/.qa-sdk/state.sqlite}" "dkg-state"

# ══════════════════════════════════════════════════════════════
# 3.5. Definition docs archive
# ══════════════════════════════════════════════════════════════

backup_definition_docs() {
  local src="${DEFINITION_DOCS_PATH:-docs}"
  local out="$BACKUP_DIR/daily/definition-docs-${DATE_SHORT}.tar.gz"

  if [[ ! -d "$src" ]]; then
    warn "Definition docs: $src 디렉토리 없음 — 건너뜀"
    return
  fi

  log "Definition docs 백업 시작..."
  if [[ "$DRY_RUN" == true ]]; then
    log "tar -czf $out $src"
    return
  fi

  if tar -czf "$out" "$src"; then
    ok "Definition docs → $(du -h "$out" | cut -f1)"
  else
    fail "Definition docs 아카이브 실패"
  fi
}

backup_definition_docs

# ══════════════════════════════════════════════════════════════
# 4. 카탈로그 API 백업
# ══════════════════════════════════════════════════════════════

backup_catalogs() {
  local base_url="${REGISTRY_SERVICE_URL:-http://localhost:3300}"
  local out="$BACKUP_DIR/daily/catalogs-${DATE_SHORT}.json"

  log "카탈로그 API 백업 시작..."
  if [[ "$DRY_RUN" == true ]]; then
    log "curl ${base_url}/catalogs → $out"
    return
  fi

  if curl -sf "${base_url}/catalogs" -o "$out" 2>/dev/null; then
    ok "카탈로그 → $out"
  else
    warn "카탈로그 API 백업 실패 (서비스 미실행?) — 건너뜀"
  fi
}

backup_catalogs

# ══════════════════════════════════════════════════════════════
# 5. Weekly 백업 (일요일)
# ══════════════════════════════════════════════════════════════

if [[ "$DAY_OF_WEEK" == "7" && "$DRY_RUN" != true ]]; then
  log "Weekly 백업 생성..."
  for f in "$BACKUP_DIR/daily/"*"-${DATE_SHORT}"*; do
    if [[ -f "$f" ]]; then
      cp "$f" "$BACKUP_DIR/weekly/"
    fi
  done
  ok "Weekly 백업 복사 완료"
fi

# ══════════════════════════════════════════════════════════════
# 6. 보존 정책 적용
# ══════════════════════════════════════════════════════════════

apply_retention() {
  local dir="$1"
  local days="$2"
  local label="$3"

  if [[ "$DRY_RUN" == true ]]; then
    log "보존 정책: $dir 에서 ${days}일 이전 파일 삭제 (dry-run)"
    return
  fi

  local count
  count=$(find "$dir" -type f -mtime "+${days}" 2>/dev/null | wc -l | tr -d ' ')
  if [[ "$count" -gt 0 ]]; then
    find "$dir" -type f -mtime "+${days}" -delete
    ok "보존 정책 (${label}): ${count}개 파일 삭제 (${days}일 이전)"
  fi
}

apply_retention "$BACKUP_DIR/daily" "$BACKUP_RETENTION_DAILY" "daily"
apply_retention "$BACKUP_DIR/weekly" "$BACKUP_RETENTION_WEEKLY" "weekly"

# ══════════════════════════════════════════════════════════════
# 7. 결과 요약
# ══════════════════════════════════════════════════════════════

echo ""
echo "═══════════════════════════════════════"
echo "  백업 완료: $(date)"
echo "  대상 디렉토리: $BACKUP_DIR"
echo "  에러: $ERRORS / 경고: $WARNINGS"
echo "═══════════════════════════════════════"

exit "$ERRORS"
