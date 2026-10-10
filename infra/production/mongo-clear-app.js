// Restore replaces only application data; administrator credentials stay in admin.
const fs = require('fs');
const admin = db.getSiblingDB('admin');
admin.auth(process.env.MONGO_INITDB_ROOT_USERNAME, fs.readFileSync('/run/secrets/mongo-root-password', 'utf8').trim());
const hello = admin.runCommand({ hello: 1 });
if (hello.setName !== 'xtn-production' || !hello.isWritablePrimary) throw Error('Expected production primary');
const result = db.getSiblingDB('xtn_production').dropDatabase();
if (result.ok !== 1) throw Error('Failed to clear application database before restore');
print('Application database cleared for replacement restore');
