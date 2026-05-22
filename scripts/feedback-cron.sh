#!/bin/sh
# Scheduled job runner, executed by the server crontab.
#
# Reads SYNC_API_KEY straight from the on-server .env.production (so the secret
# never leaves the box and never lands in GitHub) and pings the admin job
# endpoints over the public URL (through nginx). Both endpoints are exempt from
# the proxy session gate and accept the key via the x-api-key header.
#
# Usage: feedback-cron.sh rating|followup
ENVF="/home/bitrix/ext_www/feedback.alleyadoma.ru/.env.production"
KEY=$(grep -E '^SYNC_API_KEY=' "$ENVF" | head -1 | cut -d= -f2- | tr -d '\r"')
BASE="https://feedback.alleyadoma.ru"

if [ -z "$KEY" ]; then
  echo "$(date -Is) ERROR: SYNC_API_KEY not found in $ENVF" >&2
  exit 1
fi

case "$1" in
  rating)
    echo "$(date -Is) rating-sync ->"
    curl -fsS -m 180 -H "x-api-key: $KEY" "$BASE/api/admin/rating-sync"
    echo
    ;;
  followup)
    echo "$(date -Is) followups ->"
    curl -fsS -m 180 -H "x-api-key: $KEY" "$BASE/api/admin/followups"
    echo
    ;;
  *)
    echo "usage: $0 rating|followup" >&2
    exit 1
    ;;
esac
