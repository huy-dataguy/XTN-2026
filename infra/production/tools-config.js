const fs = require('fs');
const password = fs.readFileSync('/run/secrets/mongo-root-password', 'utf8').trim();
const uri = `mongodb://${encodeURIComponent(process.env.MONGO_INITDB_ROOT_USERNAME)}:${encodeURIComponent(password)}@127.0.0.1:27017/?authSource=admin&directConnection=true`;
fs.writeFileSync(process.env.XTN_TOOLS_CONFIG, `uri: ${JSON.stringify(uri)}\n`, { mode: 0o600 });
