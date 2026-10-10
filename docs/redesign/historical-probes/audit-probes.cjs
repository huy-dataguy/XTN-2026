// Reproduce baseline defects in real route handlers with fake persistence.
// No server.js, environment file, network, or database connection is used.
// These are defect probes, not integration tests or redesign acceptance tests.
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const path = require('node:path');
const backendRequire = createRequire(path.resolve(__dirname, '../backend/package.json'));
const Product = backendRequire('./models/Product');
const Order = backendRequire('./models/Order');
const User = backendRequire('./models/User');
const Report = backendRequire('./models/Report');
const Task = backendRequire('./models/Task');
const orders = backendRequire('./routes/orders');
const auth = backendRequire('./routes/auth');
const reports = backendRequire('./routes/reports');
const tasks = backendRequire('./routes/tasks');
const output = [];
function patch(target, key, value, restores) {
  const original = target[key];
  target[key] = value;
  restores.push(() => { target[key] = original; });
}
async function probe(id, run) {
  const restores = [];
  try {
    const evidence = await run((target, key, value) => patch(target, key, value, restores));
    output.push({ id, reproduced: true, evidence });
  } finally {
    restores.reverse().forEach(restore => restore());
  }
}
async function invoke(router, method, routePath, body, params = {}, user = { id: '507f1f77bcf86cd799439011', role: 'DISTRIBUTOR' }) {
  const layer = router.stack.find(entry => entry.route?.path === routePath && entry.route.methods[method]);
  assert.ok(layer, `Missing route ${method} ${routePath}`);
  // Auth middleware is deliberately bypassed; req.user represents a valid token.
  const handler = layer.route.stack.at(-1).handle;
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(data) { this.body = data; return this; },
    send(data) { this.body = data; return this; },
  };
  await handler({ body, params, user }, res);
  return res;
}
async function main() {
  await probe('P01-negative-order-quantity', async set => {
    let stock = 10;
    set(Product, 'findById', async () => ({ _id: '507f1f77bcf86cd799439012', name: 'A', price: 100, stock, async save() { stock = this.stock; } }));
    set(Order.prototype, 'save', async function () { return this; });
    const res = await invoke(orders, 'post', '/', { items: [{ productId: '507f1f77bcf86cd799439012', quantity: -2 }] });
    assert.equal(res.statusCode, 200);
    assert.equal(stock, 12);
    assert.equal(res.body.totalAmount, -200);
    return { status: res.statusCode, stock, totalAmount: res.body.totalAmount };
  });
  await probe('P02-partial-stock-write', async set => {
    let stock = 10;
    set(Product, 'findById', async id => id === 'missing' ? null : ({ _id: '507f1f77bcf86cd799439012', name: 'A', price: 100, stock, async save() { stock = this.stock; } }));
    const res = await invoke(orders, 'post', '/', { items: [{ productId: '507f1f77bcf86cd799439012', quantity: 2 }, { productId: 'missing', quantity: 1 }] });
    assert.equal(res.statusCode, 404);
    assert.equal(stock, 8);
    return { status: res.statusCode, stockBefore: 10, stockAfter: stock, orderCreated: false };
  });
  await probe('P03-cross-owner-received', async set => {
    let write;
    set(Order, 'findByIdAndUpdate', async (id, update) => {
      write = update;
      return { id, distributorId: 'another-user', ...update };
    });
    const res = await invoke(orders, 'put', '/:id/received', { isReceived: true }, { id: 'someone-elses-order' });
    assert.equal(res.statusCode, 200);
    assert.equal(write.isReceived, true);
    return { status: res.statusCode, callerRole: 'DISTRIBUTOR', owner: res.body.distributorId, updated: write };
  });
  await probe('P04-missing-admin-invite-config', async set => {
    const previous = process.env.ADMIN_REGISTRATION_CODE;
    delete process.env.ADMIN_REGISTRATION_CODE;
    try {
      set(User, 'findOne', async () => null);
      set(User.prototype, 'save', async function () { assert.equal(this.role, 'ADMIN'); return this; });
      const res = await invoke(auth, 'post', '/register', { username: 'probe', password: 'probe-only', name: 'Probe', role: 'ADMIN' });
      assert.equal(res.statusCode, 200);
      return { status: res.statusCode, roleGranted: 'ADMIN', securityCodeOmitted: true, inviteConfigMissing: true };
    } finally {
      if (previous === undefined) delete process.env.ADMIN_REGISTRATION_CODE;
      else process.env.ADMIN_REGISTRATION_CODE = previous;
    }
  });
  await probe('P05-client-report-totals', async set => {
    set(Report.prototype, 'save', async function () { return this; });
    const res = await invoke(reports, 'post', '/', { weekStartDate: '2026-10-05', totalRevenue: 999999, totalSold: 900, totalDamaged: -5, details: [] });
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.totalRevenue, 999999);
    assert.equal(res.body.details.length, 0);
    return { status: res.statusCode, totalRevenue: res.body.totalRevenue, totalDamaged: res.body.totalDamaged, detailCount: 0 };
  });
  await probe('P06-distributor-delete-internal-task', async set => {
    let deleted;
    set(Task, 'findByIdAndDelete', async id => { deleted = id; return {}; });
    const res = await invoke(tasks, 'delete', '/:id', {}, { id: 'another-admins-task' });
    assert.equal(res.statusCode, 200);
    assert.equal(deleted, 'another-admins-task');
    return { status: res.statusCode, callerRole: 'DISTRIBUTOR', deleted };
  });
  await probe('P07-schema-allows-negative-values', async () => {
    const product = new Product({ name: 'A', price: -100, stock: -5 });
    const order = new Order({ distributorId: '507f1f77bcf86cd799439011', totalAmount: -200, items: [{ quantity: -2, price: 100 }] });
    const report = new Report({ distributorId: '507f1f77bcf86cd799439011', weekStartDate: '2026-10-05', totalDamaged: -5, details: [] });
    await product.validate();
    await order.validate();
    await report.validate();
    return { realMongooseValidation: 'accepted', productPrice: -100, productStock: -5, orderQuantity: -2, reportDamaged: -5 };
  });
  console.log(JSON.stringify({ mode: 'isolated-real-handlers-fake-persistence', results: output }, null, 2));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
