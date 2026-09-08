#!/usr/bin/env bash
# Run as the same deploy user that owns the application and its Node installation.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [ "$(id -u)" -eq 0 ]; then
  echo "Run this script as deploy, not root." >&2
  exit 1
fi
command -v crontab >/dev/null
FLOCK_BIN="$(command -v flock)"
PNPM_BIN="$(command -v pnpm)"
command -v node >/dev/null
# Cron interprets percent signs even inside shell quotes.
case "$ROOT$PATH$PNPM_BIN$FLOCK_BIN" in
  *%*|*$'\n'*) echo "Unsupported newline or percent sign in runtime paths." >&2; exit 1 ;;
esac
umask 077
PREVIOUS="$(mktemp)"
UPDATED="$(mktemp)"
ERRORS="$(mktemp)"
trap 'rm -f "$PREVIOUS" "$UPDATED" "$ERRORS"' EXIT
if ! LC_ALL=C crontab -l >"$PREVIOUS" 2>"$ERRORS"; then
  if ! grep -qi 'no crontab' "$ERRORS"; then
    echo "Cannot read existing crontab; no changes made." >&2
    exit 1
  fi
fi
# Preserve an owner-only backup; never print existing cron secrets.
BACKUP="$ROOT/.supplier-crontab-backup-$(date +%Y%m%d%H%M%S)"
cp "$PREVIOUS" "$BACKUP"
# Replace this job and older supplier-sync entries, preserving unrelated jobs.
awk '!/eztopup-hourly-supplier-sync/ && !/\/api\/cron\/product-prices/ && !/products:sync:supplier/ && !/sync-supplier-products\.ts/' "$PREVIOUS" >"$UPDATED"
printf '0 * * * * PATH=%q %q -n %q %q --dir %q products:sync:supplier --apply >> %q 2>&1 # eztopup-hourly-supplier-sync\n' \
  "$PATH" "$FLOCK_BIN" "$ROOT/.supplier-sync.lock" "$PNPM_BIN" "$ROOT" "$ROOT/supplier-sync.log" >>"$UPDATED"
crontab "$UPDATED"
echo "Supplier sync scheduled hourly at minute 00 (server timezone)."
echo "Previous crontab backed up to: $BACKUP"
echo "Log: $ROOT/supplier-sync.log"
