#!/usr/bin/env bash
set -euo pipefail
cp /run/secrets/mongo-keyfile /tmp/xtn-mongo-keyfile
chown mongodb:mongodb /tmp/xtn-mongo-keyfile
chmod 400 /tmp/xtn-mongo-keyfile
cp /run/secrets/mongo-root-password /tmp/xtn-mongo-root-password
chown mongodb:mongodb /tmp/xtn-mongo-root-password
chmod 400 /tmp/xtn-mongo-root-password
export MONGO_INITDB_ROOT_PASSWORD_FILE=/tmp/xtn-mongo-root-password
exec /usr/local/bin/docker-entrypoint.sh mongod --auth --replSet xtn-production --keyFile /tmp/xtn-mongo-keyfile --bind_ip_all --wiredTigerCacheSizeGB 0.5
