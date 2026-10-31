#!/usr/bin/env bash
# ===========================================================================
#  Daily start file for Linux - the twin of start.bat.
#
#  - pulls the latest code from git (skipped when offline or not a repo;
#    never stashes or discards local changes - it asks instead)
#  - checks that the npm dependencies are installed (installs them if not,
#    or if the update changed package-lock.json)
#  - creates web/.env from .env.example when it is missing
#  - pulls the latest data from the cloud maindb.db into data/erp.sqlite
#  - starts the API + client (npm run dev)
#  - opens the app in the default browser once the client answers
#
#  Run with:  ./start.sh        Ctrl+C stops the app.
#  For a fresh machine install Node.js 22 LTS or newer first.
# ===========================================================================
set -u
cd "$(dirname "$0")" || exit 1

fail() { echo "$@"; read -r -p "Press Enter to close... " _; exit 1; }

if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
    echo
    echo "[X] Node.js / npm was not found on this machine."
    echo "    Install Node.js 22 LTS or newer from https://nodejs.org/en/download"
    echo
    command -v xdg-open >/dev/null 2>&1 && xdg-open "https://nodejs.org/en/download"
    exit 1
fi

# --- 1/5: update from git ---------------------------------------------------
# The repository root is one level above this web directory.
REPO_ROOT=$(cd .. && pwd)
FORCE_INSTALL=""

echo "[1/5] Checking for updates..."
if command -v git >/dev/null 2>&1 && [ -d "$REPO_ROOT/.git" ]; then
    OLD_HEAD=$(git -C "$REPO_ROOT" rev-parse HEAD 2>/dev/null)
    if [ -z "$OLD_HEAD" ]; then
        echo "      No git or not a git checkout - skipping the update."
    # fetch alone tests connectivity: if it fails (offline) we still start.
    elif ! git -C "$REPO_ROOT" fetch; then
        echo "      [!] Update check failed - starting with the current code."
    elif ! git -C "$REPO_ROOT" pull --ff-only; then
        echo
        echo "[X] git pull failed - local changes conflict with the latest code."
        echo "    Current local changes:"
        git -C "$REPO_ROOT" status --short
        echo
        echo "    Continue with the current (older) code, or cancel and fix it first,"
        echo "    e.g. \"git stash\" and then run start.sh again."
        read -r -p "      Continue anyway? [C/A]: " answer
        case "$answer" in
            [Aa]*) echo; echo "App stopped."; exit 1 ;;
            *)     ;; # C or Enter: continue with the current code
        esac
    else
        NEW_HEAD=$(git -C "$REPO_ROOT" rev-parse HEAD 2>/dev/null)
        if [ -n "$NEW_HEAD" ] && [ "$OLD_HEAD" != "$NEW_HEAD" ]; then
            echo "      Updated to the latest code."
            # Reinstall packages when the update touched the lockfile.
            if git -C "$REPO_ROOT" diff --name-only "$OLD_HEAD" "$NEW_HEAD" | grep -q "package-lock.json"; then
                FORCE_INSTALL=1
            fi
        fi
    fi
else
    echo "      No git or not a git checkout - skipping the update."
fi

# --- 2/5: dependencies ------------------------------------------------------
echo "[2/5] Checking npm packages..."
if [ -n "$FORCE_INSTALL" ] || [ ! -d node_modules ] || \
   ! npx --no-install concurrently --version >/dev/null 2>&1; then
    echo "      Installing packages (missing, broken, or changed by the update - this can take a few minutes)..."
    # npm ci wipes node_modules and installs exactly what package-lock.json says,
    # so a half-copied tree cannot survive. Fall back to install if the lockfile
    # and package.json disagree.
    npm ci --no-audit --no-fund || npm install --no-audit --no-fund || \
        fail "[X] npm install failed. Check the messages above (network/proxy) and retry."
else
    echo "      All packages are installed."
fi

# --- 3/5: configuration -----------------------------------------------------
if [ ! -f .env ] && [ -f .env.example ]; then
    cp .env.example .env || fail "[X] Could not create web/.env. Copy .env.example to .env manually and retry."
    echo "      Created web/.env from .env.example (local SQLite database)."
fi

# --- 4/5: pull the latest data from the cloud maindb.db ---------------------
#  Remote wins at startup: the pull goes to a temp file and only replaces
#  data/erp.sqlite after it passes its integrity check, so an offline start
#  keeps the local data. Local writes made since the last replica push are
#  discarded here (they were already pushed if the previous run had time).
echo "[4/5] Pulling the latest data from maindb.db..."
[ -d data ] || mkdir data
rm -f data/erp.startup.sqlite data/erp.startup.sqlite-wal data/erp.startup.sqlite-shm
if node scripts/pull-cloud.mjs --out data/erp.startup.sqlite && \
   mv data/erp.startup.sqlite data/erp.sqlite; then
    #  A leftover -wal/-shm from the replaced file corrupts the new one on open.
    rm -f data/erp.sqlite-wal data/erp.sqlite-shm
    echo "      Local data refreshed from the cloud."
else
    echo "      [!] Pull failed - starting with the existing local data."
    rm -f data/erp.startup.sqlite data/erp.startup.sqlite-wal data/erp.startup.sqlite-shm
fi

# --- 5/5: start -------------------------------------------------------------
echo
echo "[5/5] Starting API (http://localhost:4000) and client (http://localhost:5173)..."
echo "      The browser opens automatically when the client is ready."
echo
echo "      Press Ctrl+C in this window to stop the app."
echo

if command -v xdg-open >/dev/null 2>&1; then
    # Background waiter: opens the browser as soon as Vite answers on 5173.
    (
        for _ in $(seq 1 180); do
            if curl -fsS --max-time 2 http://localhost:5173 >/dev/null 2>&1; then
                xdg-open http://localhost:5173 >/dev/null 2>&1
                break
            fi
            sleep 1
        done
    ) &
fi

npm run dev

echo
echo "App stopped."
