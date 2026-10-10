const { z } = require("../src/domain/policy");
const schemas = require("../src/http/schemas");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "../../contracts");
fs.mkdirSync(root, { recursive: true });
const requests = Object.fromEntries(
  Object.entries(schemas).map(([name, schema]) => [
    name,
    z.toJSONSchema(schema, { unrepresentable: "any" }),
  ]),
);
fs.writeFileSync(
  path.join(root, "requests.v1.json"),
  JSON.stringify(
    {
      version: "v1",
      note: "JSON schema for request shape/ranges; custom authorization, timeline, business-date and state validators remain mandatory on the server.",
      requests,
    },
    null,
    2,
  ) + "\n",
);
console.log("Exported versioned request contracts.");
