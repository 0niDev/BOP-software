#!/usr/bin/env bash
# Deploy script for BOP ERP on the laptop server
set -euo pipefail

# Check if skip-tests argument is provided
SKIP_TESTS=false
if [[ "$#" -gt 0 ]]; then
    if [[ "$1" == "--skip-tests" || "$1" == "-t" ]]; then
        SKIP_TESTS=true
    fi
fi

REPO_DIR="~/accounting-app/BOP-software/web"
SERVICE="bop-erp"

cd "$REPO_DIR"

echo "==> Pulling latest code..."
git pull

# Check if package-lock.json changed
if git diff HEAD@{1} --name-only 2>/dev/null | grep -q "package-lock.json"; then
    echo "==> package-lock.json changed, reinstalling dependencies..."
    npm ci
else
    echo "==> Dependencies up to date"
fi

if [ "$SKIP_TESTS" = false ]; then
    echo "==> Running tests..."
    npm test
fi

echo "==> Building..."
npm run build

echo "==> Restarting service..."
sudo systemctl restart "$SERVICE"

echo "==> Waiting for service to be ready..."
sleep 3
curl -fsS http://localhost:4000/api/health && echo "==> Deploy OK"
