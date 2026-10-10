const { Product, Movement } = require("../infrastructure/models");
const { periodId, fail, inventoryReady } = require("../domain/policy");
async function movement(data, actor, session) {
  return (
    await Movement.create(
      [
        {
          sold: 0,
          damaged: 0,
          giftGood: 0,
          giftDamaged: 0,
          revenue: 0,
          cogs: 0,
          damageCost: 0,
          giftCost: 0,
          damagedDelta: 0,
          ...data,
          periodId: periodId(data.effectiveAt),
          actorId: actor.id,
        },
      ],
      { session },
    )
  )[0];
}
async function getProduct(id, session) {
  const p = await Product.findById(id).session(session);
  if (!p) fail(404, "NOT_FOUND", "Không tìm thấy sản phẩm");
  inventoryReady(p);
  return p;
}

module.exports = { movement, getProduct };
