#!/usr/bin/env bash
# Production deploy for EZTopUp (VPS user: deploy, PM2: eztu)
# Usage (as deploy):
#   cd /var/www/eztu && bash scripts/deploy-vps.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

APP_NAME="${PM2_APP_NAME:-eztu}"
BRANCH="${DEPLOY_BRANCH:-main}"

echo "==> [1/6] git pull origin ${BRANCH}"
git fetch origin "${BRANCH}"
git checkout "${BRANCH}"
git pull --ff-only origin "${BRANCH}"

echo "==> [2/6] pnpm install"
pnpm install --frozen-lockfile 2>/dev/null || pnpm install

echo "==> [3/6] prisma migrate deploy + generate"
pnpm db:migrate
pnpm prisma:generate

echo "==> [4/6] build web"
pnpm build

echo "==> [5/6] pm2 restart ${APP_NAME}"
if pm2 describe "${APP_NAME}" >/dev/null 2>&1; then
  pm2 restart "${APP_NAME}" --update-env
else
  echo "PM2 process '${APP_NAME}' not found. Starting from apps/web..."
  # Fallback start — adjust cwd if your ecosystem file differs
  cd apps/web
  pm2 start pnpm --name "${APP_NAME}" -- start
  cd "$ROOT"
fi

echo "==> [6/6] pm2 save"
pm2 save

echo ""
echo "OK — deploy finished."
echo "Check: pm2 status && pm2 logs ${APP_NAME} --lines 40"
echo "Site:  https://eztopup.io"
