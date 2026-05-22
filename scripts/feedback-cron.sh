#!/bin/sh
# Scheduled job runner, executed by the server crontab.
#
# Resolves SYNC_API_KEY from the app's own environment — first from candidate
# .env files (tolerating leading spaces, `export `, and quotes), then as a
# fallback from the running PM2 process env — and pings the admin job endpoints
# over the public URL (through nginx). The key is read but never printed.
#
# Both endpoints are exempt from the proxy session gate and accept the key via
# the x-api-key header.
#
# Usage: feedback-cron.sh rating|followup|diag
DIR="/home/bitrix/ext_www/feedback.alleyadoma.ru"
BASE="https://feedback.alleyadoma.ru"

# Pull SYNC_API_KEY's value out of an env file, robust to formatting.
extract() {
  grep -E '^[[:space:]]*(export[[:space:]]+)?SYNC_API_KEY[[:space:]]*=' "$1" 2>/dev/null \
    | head -1 \
    | sed -E 's/^[^=]*=[[:space:]]*//' \
    | tr -d '\r' \
    | sed -E "s/^[\"']//; s/[\"']\$//"
}

resolve_key() {
  for f in "$DIR/.env.production" "$DIR/.env.local" "$DIR/.env"; do
    v=$(extract "$f")
    [ -n "$v" ] && { printf '%s' "$v"; return 0; }
  done
  # Fallback: the value PM2 actually launched the app with.
  v=$(pm2 jlist 2>/dev/null | grep -o '"SYNC_API_KEY":"[^"]*"' | head -1 | sed -E 's/.*:"//; s/"$//')
  [ -n "$v" ] && { printf '%s' "$v"; return 0; }
  return 1
}

case "$1" in
  diag)
    # Safe: reports WHERE the key lives, never its value.
    echo "DIR=$DIR"
    echo "env files:"
    ls -la "$DIR"/.env* 2>/dev/null || echo "  (none)"
    for f in "$DIR/.env.production" "$DIR/.env.local" "$DIR/.env"; do
      [ -n "$(extract "$f")" ] && echo "SYNC_API_KEY present in: $f"
    done
    pm2 jlist 2>/dev/null | grep -q '"SYNC_API_KEY"' && echo "SYNC_API_KEY present in: PM2 process env"
    echo "diag done"
    ;;
  rating|followup)
    KEY=$(resolve_key)
    if [ -z "$KEY" ]; then
      echo "$(date -Is) ERROR: SYNC_API_KEY could not be resolved" >&2
      exit 1
    fi
    if [ "$1" = "rating" ]; then EP="rating-sync"; else EP="followups"; fi
    echo "$(date -Is) $1 ->"
    curl -fsS -m 180 -H "x-api-key: $KEY" "$BASE/api/admin/$EP"
    echo
    ;;
  *)
    echo "usage: $0 rating|followup|diag" >&2
    exit 1
    ;;
esac
