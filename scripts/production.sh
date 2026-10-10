#!/usr/bin/env bash
set -euo pipefail
umask 077
xtn_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
xtn_dir="${XTN_DEPLOY_DIR:-$xtn_root/.local/production}"
[[ -f "$xtn_dir/env" ]] || { echo 'Prepare private configuration first: python3 scripts/prepare-production.py --domain example.com' >&2; exit 1; }
xtn_compose=(docker compose --env-file "$xtn_dir/env" -f "$xtn_root/infra/compose.production.yml")
exec 9>"$xtn_dir/operation.lock"
flock -n 9 || { echo 'Another deployment/backup/restore is running.' >&2; exit 1; }
RELEASE_TAG=local
[[ ! -f "$xtn_dir/current-release" ]] || RELEASE_TAG=$(cat "$xtn_dir/current-release")
export RELEASE_TAG
case "${1:-}" in
  init)
    [[ ! -f "$xtn_dir/current-release" ]] || { echo "Already initialized; use up or release TAG." >&2; exit 1; }
    "${xtn_compose[@]}" build api web
    "${xtn_compose[@]}" up -d --wait mongo
    "${xtn_compose[@]}" run --rm mongo-init
    "${xtn_compose[@]}" run --rm migrate
    "${xtn_compose[@]}" run --rm bootstrap
    "${xtn_compose[@]}" up -d --wait --wait-timeout 180 api web
    printf '%s\n' "$RELEASE_TAG" > "$xtn_dir/current-release"
    ;;
  up) "${xtn_compose[@]}" up -d --wait --wait-timeout 180 --no-build api web ;;
  release|rollback)
    [[ "${2:-}" =~ ^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,63}$ ]] || { echo 'Supply a valid release tag' >&2; exit 1; }
    RELEASE_TAG="$2"
    if [[ "$1" == release ]]; then
      if docker image inspect "xtn-api:$RELEASE_TAG" >/dev/null 2>&1 || docker image inspect "xtn-web:$RELEASE_TAG" >/dev/null 2>&1; then
        echo 'Release tag already exists; use a new tag to preserve rollback images.' >&2; exit 1
      fi
      "${xtn_compose[@]}" build api web
    else
      docker image inspect "xtn-api:$RELEASE_TAG" "xtn-web:$RELEASE_TAG" >/dev/null
    fi
    "${xtn_compose[@]}" up -d --wait --wait-timeout 180 --no-build api web
    printf '%s\n' "$RELEASE_TAG" > "$xtn_dir/current-release"
    mkdir -p "$xtn_dir/releases"
    docker image inspect --format '{{json .Id}}' "xtn-api:$RELEASE_TAG" "xtn-web:$RELEASE_TAG" > "$xtn_dir/releases/$RELEASE_TAG.images"
    ;;
  backup)
    xtn_backup="$xtn_dir/backups/xtn-$(date -u +%Y%m%dT%H%M%S)-$(date +%s%N).archive.gz"
    # Quiesce the only application writer for a consistent database-only backup.
    "${xtn_compose[@]}" stop api
    xtn_recover_api() { "${xtn_compose[@]}" up -d --wait --wait-timeout 180 --no-build api >/dev/null; }
    trap xtn_recover_api EXIT
    "${xtn_compose[@]}" exec -T mongo bash /opt/xtn/mongo-backup.sh dump > "$xtn_backup.partial"
    gzip -t "$xtn_backup.partial"
    mv "$xtn_backup.partial" "$xtn_backup"
    python3 - "$xtn_backup" "$RELEASE_TAG" <<'PY'
import datetime,hashlib,json,sys
from pathlib import Path
p=Path(sys.argv[1]);h=hashlib.sha256()
with p.open('rb') as f:
 for block in iter(lambda:f.read(1048576),b''):h.update(block)
p.with_suffix(p.suffix+'.json').write_text(json.dumps({'database':'xtn_production','format':'quiesced-app-db-v1','createdAtUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sha256':h.hexdigest(),'bytes':p.stat().st_size,'release':sys.argv[2]},indent=2)+'\n')
PY
    xtn_recover_api
    trap - EXIT
    printf '%s\n' "$xtn_backup"
    ;;
  restore)
    [[ "${3:-}" == --replace-database ]] || { echo 'Restore replaces the selected production database. Usage: production.sh restore archive.gz --replace-database' >&2; exit 1; }
    xtn_backup="${2:?Backup path required}"
    python3 - "$xtn_backup" <<'PY'
import hashlib,json,sys
from pathlib import Path
p=Path(sys.argv[1]);m=json.loads(p.with_suffix(p.suffix+'.json').read_text());assert m['database']=='xtn_production' and m['format']=='quiesced-app-db-v1'
h=hashlib.sha256()
with p.open('rb') as f:
 for block in iter(lambda:f.read(1048576),b''):h.update(block)
assert h.hexdigest()==m['sha256'],'Backup checksum mismatch'
PY
    gzip -t "$xtn_backup"
    "${xtn_compose[@]}" stop web api
    "${xtn_compose[@]}" exec -T mongo bash /opt/xtn/mongo-backup.sh restore < "$xtn_backup"
    "${xtn_compose[@]}" up -d --wait --wait-timeout 180 --no-build api web
    ;;
  status) "${xtn_compose[@]}" ps --all ;;
  logs) "${xtn_compose[@]}" logs --tail 100 api web ;;
  stop) "${xtn_compose[@]}" stop web api mongo ;;
  *) echo 'Usage: production.sh init|up|release TAG|rollback TAG|backup|restore FILE --replace-database|status|logs|stop' >&2; exit 1 ;;
esac
