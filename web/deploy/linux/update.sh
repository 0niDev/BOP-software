#!/usr/bin/env bash
# ===========================================================================
#  Pull code, rebuild, refresh the local database from SQLite Cloud, restart.
#
#    ./deploy/linux/update.sh               # normal deploy
#    ./deploy/linux/update.sh --skip-tests  # hotfix
#    ./deploy/linux/update.sh --boot        # systemd ExecStartPre: no tests, no restart
#
#  Deliberately NOT `set -e`: a failed pull, install or build must leave the
#  previous build serving rather than take the site down.
#
#  Never touches web/.env, web/data/ or web/backups/ — git ignores all three.
# ===========================================================================
set -uo pipefail

SERVICE="bop-erp"
WEB_DIR=$(cd "$(dirname "$0")/../.." && pwd)
REPO_DIR=$(cd "$WEB_DIR/.." && pwd)

SKIP_TESTS=0
BOOT=0
for arg in "$@"; do
    case "$arg" in
        --skip-tests|-t) SKIP_TESTS=1 ;;
        --boot)          BOOT=1; SKIP_TESTS=1 ;;
        *) echo "[update] unknown option: $arg"; exit 2 ;;
    esac
done

log() { echo "[update] $*"; }

# Read a key from web/.env without sourcing it (values may contain spaces).
envval() {
    [ -f "$WEB_DIR/.env" ] || return 0
    grep -E "^$1=" "$WEB_DIR/.env" | tail -1 | cut -d= -f2- | sed -E 's/^["'\'']//; s/["'\'']$//'
}

PORT=$(envval PORT);                 PORT=${PORT:-4000}
DB_FILE=$(envval ERP_LOCAL_DB);      DB_FILE=${DB_FILE:-./data/erp.sqlite}
case "$DB_FILE" in /*) ;; *) DB_FILE="$WEB_DIR/$DB_FILE" ;; esac
DATA_DIR=$(dirname "$DB_FILE")
mkdir -p "$DATA_DIR"

# --- 1. code ---------------------------------------------------------------
BEFORE=""
if [ -d "$REPO_DIR/.git" ]; then
    BEFORE=$(git -C "$REPO_DIR" rev-parse HEAD 2>/dev/null || echo "")
    git -C "$REPO_DIR" fetch --quiet || log "fetch failed (offline?) - using the current code"
    git -C "$REPO_DIR" pull --ff-only --quiet || \
        log "pull failed (local changes or divergence) - using the current code"
fi
AFTER=$(git -C "$REPO_DIR" rev-parse HEAD 2>/dev/null || echo "")
CHANGED_FILES=""
if [ -n "$BEFORE" ] && [ -n "$AFTER" ] && [ "$BEFORE" != "$AFTER" ]; then
    CHANGED_FILES=$(git -C "$REPO_DIR" diff --name-only "$BEFORE" "$AFTER")
    log "updated $BEFORE -> $AFTER"
fi

# --- 2. dependencies -------------------------------------------------------
NEED_INSTALL=0
[ -d "$WEB_DIR/node_modules" ] || NEED_INSTALL=1
if printf '%s' "$CHANGED_FILES" | grep -q "package-lock.json"; then NEED_INSTALL=1; fi
if [ "$NEED_INSTALL" = 1 ]; then
    log "installing dependencies"
    ( cd "$WEB_DIR" && (npm ci --no-audit --no-fund || npm install --no-audit --no-fund) ) || \
        log "package install FAILED - continuing with what is installed"
fi

# --- 3. build --------------------------------------------------------------
NEED_BUILD=0
[ -n "$CHANGED_FILES" ] && NEED_BUILD=1
[ -f "$WEB_DIR/server/dist/index.js" ]    || NEED_BUILD=1
[ -f "$WEB_DIR/client/dist/index.html" ]  || NEED_BUILD=1
BUILD_OK=1
if [ "$NEED_BUILD" = 1 ]; then
    log "building"
    ( cd "$WEB_DIR" && npm run build ) || { BUILD_OK=0; log "BUILD FAILED"; }
else
    log "code unchanged - skipping build"
fi
if [ "$BUILD_OK" = 0 ] && [ "$BOOT" = 0 ]; then
    log "not restarting: a failed build must not replace a working one"
    exit 1
fi

# --- 4. tests --------------------------------------------------------------
if [ "$SKIP_TESTS" = 0 ] && [ "$BUILD_OK" = 1 ]; then
    log "running tests"
    ( cd "$WEB_DIR" && npm test ) || { log "TESTS FAILED - not deploying"; exit 1; }
fi

# --- 5. stop (so the shutdown push to SQLite Cloud lands first) ------------
if [ "$BOOT" = 0 ]; then
    log "stopping $SERVICE"
    sudo -n systemctl stop "$SERVICE" 2>/dev/null || \
        sudo systemctl stop "$SERVICE" || log "could not stop $SERVICE - continuing"
fi

# --- 6. database: cloud is master at every start --------------------------
# A previous local file is kept as erp.pre-sync-*.sqlite (3 newest) so a pull
# against the wrong cloud state is recoverable.
if [ -f "$DB_FILE" ]; then
    PRE="$DATA_DIR/erp.pre-sync-$(date -u +%Y%m%d_%H%M%S).sqlite"
    cp -f "$DB_FILE" "$PRE" && log "kept previous database as $(basename "$PRE")"
    ls -1t "$DATA_DIR"/erp.pre-sync-*.sqlite 2>/dev/null | tail -n +4 | xargs -r rm -f
fi
PULL="$DATA_DIR/erp.pull.sqlite"
rm -f "$PULL" "$PULL-wal" "$PULL-shm"
if ( cd "$WEB_DIR" && node scripts/pull-cloud.mjs --out "$PULL" ); then
    mv -f "$PULL" "$DB_FILE"
    # A leftover -wal/-shm from the replaced file corrupts the new one.
    rm -f "$DB_FILE-wal" "$DB_FILE-shm"
    log "local database replaced with the SQLite Cloud copy"
else
    rm -f "$PULL" "$PULL-wal" "$PULL-shm"
    log "cloud pull FAILED - starting on the existing local database"
fi

# --- 7. start --------------------------------------------------------------
if [ "$BOOT" = 1 ]; then
    exit 0
fi

log "starting $SERVICE"
sudo -n systemctl start "$SERVICE" 2>/dev/null || sudo systemctl start "$SERVICE" || {
    log "start FAILED - check: journalctl -u $SERVICE -n 50"
    exit 1
}

for _ in $(seq 1 30); do
    if curl -fsS "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1; then
        log "deploy OK - http://127.0.0.1:$PORT/api/health"
        exit 0
    fi
    sleep 1
done

log "health check FAILED after 30s - check: journalctl -u $SERVICE -n 50"
exit 1
