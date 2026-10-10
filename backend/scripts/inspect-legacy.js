// Read-only inventory assessment. No migration, balance adjustment or DDL.
require("dotenv").config();
const { mongoose } = require("../src/infrastructure/models");
async function inspect() {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is required");
  await mongoose.connect(process.env.MONGO_URI, { autoIndex: false });
  const db = mongoose.connection.db;
  const products = await db
    .collection("products")
    .find(
      {},
      {
        projection: {
          name: 1,
          stock: 1,
          onHand: 1,
          reserved: 1,
          inventoryVersion: 1,
        },
      },
    )
    .toArray();
  const orders = await db
    .collection("orders")
    .countDocuments({ schemaVersion: { $ne: 1 } });
  const reports = await db
    .collection("reports")
    .countDocuments({ schemaVersion: { $ne: 1 } });
  console.log(
    JSON.stringify(
      {
        readOnly: true,
        products: products.map((p) => ({
          id: String(p._id),
          name: p.name,
          legacyAvailable: p.stock ?? null,
          onHand: p.onHand ?? null,
          reserved: p.reserved ?? null,
          needsOpeningReconciliation: p.inventoryVersion !== 1,
        })),
        legacyOrderCount: orders,
        legacyReportCount: reports,
        warning:
          "Do not infer physical stock from legacy available stock. Reconcile warehouse and each member/lot before cutover.",
      },
      null,
      2,
    ),
  );
}
inspect()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
