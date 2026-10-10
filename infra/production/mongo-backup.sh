#!/usr/bin/env bash
set -euo pipefail
export XTN_TOOLS_CONFIG
XTN_TOOLS_CONFIG=$(mktemp /tmp/xtn-tools.XXXXXX)
trap 'rm -f "$XTN_TOOLS_CONFIG"' EXIT
mongosh --nodb --quiet --file /opt/xtn/tools-config.js
exec_args=(--config "$XTN_TOOLS_CONFIG" --archive --gzip)
case "${1:-}" in
  dump) mongodump "${exec_args[@]}" --db xtn_production ;;
  restore)
    # --drop alone only clears collections present in the archive; later-created
    # collections must also disappear when recovering an older snapshot.
    mongosh --quiet --file /opt/xtn/mongo-clear-app.js
    mongorestore "${exec_args[@]}" --nsInclude "xtn_production.*" --drop
    ;;
  *) echo 'Expected dump or restore' >&2; exit 1 ;;
esac
