// Read-only independent reconciliation. Executed inside the API container.
const assert = require("node:assert/strict");
const m = require("/app/backend/src/infrastructure/models");
(async () => {
  await m.mongoose.connect(process.env.MONGO_URI, { autoIndex: false });
  const result = await m.mongoose.connection.transaction(
    async (session) => {
      const products = await m.Product.find({ inventoryVersion: 1 })
        .session(session)
        .lean();
      const lots = await m.Receipt.find().session(session).lean();
      const prices = new Map(lots.map((l) => [String(l._id), l]));
      const warehouse = new Map(),
        memberStock = new Map(),
        reservations = new Map();
      let warehouseDamage = 0,
        warehouseGift = 0;
      for await (const move of m.Movement.find()
        .session(session)
        .lean()
        .cursor()) {
        const collection = move.memberId ? memberStock : warehouse;
        const key = String(move.memberId ? move.lotId : move.productId);
        const balance = collection.get(key) || { sellable: 0, damaged: 0 };
        balance.sellable += move.sellableDelta || 0;
        balance.damaged += move.damagedDelta || 0;
        collection.set(key, balance);
        if (move.kind === "WAREHOUSE_ACTIVITY") {
          warehouseDamage =
            warehouseDamage == null || move.damageCost == null
              ? null
              : warehouseDamage + move.damageCost;
          warehouseGift =
            warehouseGift == null || move.giftCost == null
              ? null
              : warehouseGift + move.giftCost;
        }
      }
      for await (const order of m.Order.find({
        schemaVersion: 1,
        status: { $nin: ["CANCELLED", "REJECTED"] },
      })
        .session(session)
        .lean()
        .cursor())
        for (const item of order.items) {
          const id = String(item.productId);
          reservations.set(
            id,
            (reservations.get(id) || 0) + item.quantity - item.receivedQuantity,
          );
        }
      let warehousePhysical = 0,
        memberPhysical = 0;
      for (const product of products) {
        const balance = warehouse.get(String(product._id)) || {
          sellable: 0,
          damaged: 0,
        };
        assert.equal(
          product.onHand,
          balance.sellable + balance.damaged,
          "Warehouse ledger mismatch",
        );
        assert.equal(
          product.damagedOnHand,
          balance.damaged,
          "Warehouse damage mismatch",
        );
        assert.equal(
          product.reserved,
          reservations.get(String(product._id)) || 0,
          "Reservation mismatch",
        );
        warehousePhysical += product.onHand;
      }
      for (const balance of memberStock.values()) {
        assert.ok(
          balance.sellable >= 0 && balance.damaged >= 0,
          "Negative member stock",
        );
        memberPhysical += balance.sellable + balance.damaged;
      }
      let revenue = 0,
        cost = 0,
        damage = 0,
        gift = 0,
        approvedReports = 0;
      for await (const report of m.Report.find({
        schemaVersion: 1,
        status: "APPROVED",
      })
        .session(session)
        .lean()
        .cursor()) {
        approvedReports++;
        for (const line of report.lines) {
          const lot = prices.get(String(line.lotId));
          assert.ok(lot, "Missing lot");
          assert.equal(
            String(lot.memberId),
            String(report.memberId),
            "Lot ownership mismatch",
          );
          revenue += line.sold * lot.price;
          if (
            lot.unitCost == null &&
            (line.sold || line.damaged || line.giftGood)
          )
            cost = null;
          if (cost != null) cost += line.sold * (lot.unitCost || 0);
          if (lot.unitCost == null && line.damaged) damage = null;
          else if (damage != null) damage += line.damaged * (lot.unitCost || 0);
          if (lot.unitCost == null && line.giftGood) gift = null;
          else if (gift != null) gift += line.giftGood * (lot.unitCost || 0);
        }
      }
      const contribution = [
        cost,
        damage,
        gift,
        warehouseDamage,
        warehouseGift,
      ].some((v) => v == null)
        ? null
        : revenue - cost - damage - gift - warehouseDamage - warehouseGift;
      return {
        status: "passed",
        products: products.length,
        orders: await m.Order.countDocuments({ schemaVersion: 1 }).session(
          session,
        ),
        receipts: lots.length,
        approvedReports,
        warehousePhysical,
        memberPhysical,
        revenue,
        contribution,
      };
    },
    {
      readConcern: { level: "snapshot" },
      readPreference: "primary",
      writeConcern: { w: "majority" },
    },
  );
  console.log(JSON.stringify(result));
})()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => m.mongoose.disconnect());
