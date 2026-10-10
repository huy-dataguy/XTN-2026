const { Product } = require("../infrastructure/models");
const { entity } = require("../infrastructure/transaction");
const { fail, quantities, valuation } = require("../domain/policy");
const { movement, getProduct } = require("./inventory-shared");
const productDTO = (p) => ({
  ...entity(p),
  stock:
    p.inventoryVersion === 1
      ? p.onHand - (p.damagedOnHand || 0) - p.reserved
      : null,
  physicalStock: p.onHand ?? null,
  needsMigration: p.inventoryVersion !== 1,
});
async function createProduct(input, actor, session) {
  const p = (
    await Product.create(
      [
        {
          ...input,
          onHand: input.openingStock,
          reserved: 0,
          inventoryVersion: 1,
        },
      ],
      { session },
    )
  )[0];
  await movement(
    {
      productId: p.id,
      kind: "OPENING",
      sourceId: p.id,
      sellableDelta: input.openingStock,
      effectiveAt: new Date(),
    },
    actor,
    session,
  );
  return productDTO(p);
}
async function updateProduct(id, input, session) {
  const p = await getProduct(id, session);
  Object.assign(p, input);
  await p.save({ session });
  return productDTO(p);
}
async function adjustProduct(id, input, actor, session) {
  const p = await getProduct(id, session);
  const available = p.onHand - p.damagedOnHand - p.reserved;
  if (input.delta < -available)
    fail(409, "RESERVED_STOCK", "Điều chỉnh vượt hàng khả dụng");
  p.onHand += input.delta;
  await p.save({ session });
  await movement(
    {
      productId: p.id,
      kind: "ADJUSTMENT",
      sourceId: p.id,
      sellableDelta: input.delta,
      effectiveAt: new Date(),
    },
    actor,
    session,
  );
  return productDTO(p);
}
async function warehouseActivity(id, input, actor, session) {
  const p = await getProduct(id, session);
  if (
    input.damaged + input.giftGood > p.onHand - p.damagedOnHand - p.reserved ||
    input.giftDamaged > p.damagedOnHand + input.damaged
  )
    fail(409, "INSUFFICIENT_STOCK", "Không đủ hàng khả dụng/hư");
  p.onHand -= input.giftGood + input.giftDamaged;
  p.damagedOnHand += input.damaged - input.giftDamaged;
  await p.save({ session });
  await movement(
    {
      productId: p.id,
      sourceId: p.id,
      kind: "WAREHOUSE_ACTIVITY",
      ...quantities({ ...input, sold: 0 }),
      ...valuation({ ...input, sold: 0 }, p),
      damaged: input.damaged,
      giftGood: input.giftGood,
      giftDamaged: input.giftDamaged,
      effectiveAt: new Date(),
    },
    actor,
    session,
  );
  return productDTO(p);
}

module.exports = {
  productDTO,
  createProduct,
  updateProduct,
  adjustProduct,
  warehouseActivity,
};
