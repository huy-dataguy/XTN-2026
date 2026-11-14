const repo = require("../infrastructure/repository");
const { periodId, fail, inventoryReady } = require("../domain/policy");
async function movement(data, actor, tx) {
  return repo.createMovement(tx, {
    ...data,
    periodId: periodId(data.effectiveAt),
    actorId: actor.id,
  });
}
async function getProduct(id, tx) {
  const product = await repo.getProductForUpdate(tx, id);
  if (!product) fail(404, "NOT_FOUND", "Không tìm thấy sản phẩm");
  inventoryReady(product);
  return product;
}

module.exports = { movement, getProduct };
