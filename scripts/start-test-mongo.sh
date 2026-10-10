#!/usr/bin/env bash
# Isolated local test infrastructure only; never connects to an existing DB.
set -euo pipefail
xtn_nodes=(xtn-refactor-test xtn-refactor-secondary-1 xtn-refactor-secondary-2)
for xtn_node in "${xtn_nodes[@]}"; do
  if docker inspect "$xtn_node" >/dev/null 2>&1; then
    echo "Container $xtn_node already exists; refusing to replace it." >&2
    exit 1
  fi
done
if docker network inspect xtn-refactor-test-net >/dev/null 2>&1; then
  echo 'Test network already exists; refusing to replace it.' >&2
  exit 1
fi
docker network create --label xtn.refactor=test xtn-refactor-test-net >/dev/null
for xtn_node in "${xtn_nodes[@]}"; do
  xtn_port=()
  if [[ "$xtn_node" == xtn-refactor-test ]]; then xtn_port=(-p 127.0.0.1:27028:27017); fi
  docker run -d --name "$xtn_node" --label xtn.refactor=test --ulimit nofile=64000:64000 --network xtn-refactor-test-net "${xtn_port[@]}" mongo:7.0 --replSet xtn-test --bind_ip_all >/dev/null
done
for xtn_node in "${xtn_nodes[@]}"; do
  for xtn_attempt in $(seq 1 40); do
    if docker exec "$xtn_node" mongosh --quiet --eval 'db.adminCommand({ping:1})' >/dev/null 2>&1; then break; fi
    sleep 1
  done
  docker exec "$xtn_node" mongosh --quiet --eval 'db.adminCommand({ping:1})' >/dev/null
done
docker exec xtn-refactor-test mongosh --quiet --eval 'rs.initiate({_id:"xtn-test",members:[{_id:0,host:"xtn-refactor-test:27017",priority:2},{_id:1,host:"xtn-refactor-secondary-1:27017"},{_id:2,host:"xtn-refactor-secondary-2:27017"}]})' >/dev/null
for xtn_attempt in $(seq 1 40); do
  if docker exec xtn-refactor-test mongosh --quiet --eval 'if(!db.hello().isWritablePrimary)quit(1)' >/dev/null 2>&1; then break; fi
  sleep 1
done
docker exec xtn-refactor-test mongosh --quiet --eval 'if(!db.hello().isWritablePrimary)quit(1)' >/dev/null
echo 'Dedicated test replica ready at 127.0.0.1:27028 (directConnection=true).'
