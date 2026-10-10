const fs = require('fs');
const admin = db.getSiblingDB('admin');
admin.auth(process.env.MONGO_INITDB_ROOT_USERNAME, fs.readFileSync('/run/secrets/mongo-root-password', 'utf8').trim());
if (admin.runCommand({ ping: 1 }).ok !== 1) quit(1);
