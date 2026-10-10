#!/usr/bin/env bash
set -euo pipefail
xtn_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
xtn_compose=(docker compose -f "$xtn_root/infra/compose.local.yml")
"${xtn_compose[@]}" up -d --wait
"${xtn_compose[@]}" exec -T mongo mongosh --quiet --eval 'let h=db.hello();if(!h.setName){printjson(rs.initiate({_id:"xtn-local",members:[{_id:0,host:"localhost:27017"}]}))}else if(h.setName!=="xtn-local"){throw Error("Unexpected replica set")}'
for xtn_attempt in $(seq 1 40); do
  if "${xtn_compose[@]}" exec -T mongo mongosh --quiet --eval 'if(!db.hello().isWritablePrimary)quit(1)' >/dev/null 2>&1; then
    echo 'Local Mongo ready: mongodb://127.0.0.1:27017/xtn_local?replicaSet=xtn-local'
    exit 0
  fi
  sleep 1
done
echo 'Local Mongo primary not ready.' >&2
exit 1
