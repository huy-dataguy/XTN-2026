const fs = require('fs');
const admin = db.getSiblingDB('admin');
admin.auth(process.env.MONGO_INITDB_ROOT_USERNAME, fs.readFileSync('/run/secrets/mongo-root-password', 'utf8').trim());
const hello = admin.runCommand({ hello: 1 });
if (hello.setName && hello.setName !== 'xtn-production') throw Error('Unexpected replica set');
if (!hello.setName) admin.runCommand({ replSetInitiate: { _id: 'xtn-production', members: [{ _id: 0, host: 'mongo:27017' }] } });
let ready = false;
for (let attempt = 0; attempt < 120; attempt++) {
  if (admin.runCommand({ hello: 1 }).isWritablePrimary) { ready = true; break; }
  sleep(250);
}
if (!ready) throw Error('Mongo primary not ready');
const app = db.getSiblingDB('xtn_production');
const password = fs.readFileSync('/run/secrets/mongo-app-password', 'utf8').trim();
if (!app.getUser('xtn_app')) app.createUser({ user: 'xtn_app', pwd: password, roles: [{ role: 'readWrite', db: 'xtn_production' }] });
const probe = connect('mongodb://mongo:27017/xtn_production?directConnection=true');
probe.auth('xtn_app', password);
if (probe.runCommand({ ping: 1 }).ok !== 1) throw Error('Application authentication failed');
print('Production Mongo ready: authenticated single-node replica set');
