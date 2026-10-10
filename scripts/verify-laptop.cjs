// Read-only acceptance of the real laptop deployment. Never seeds business data.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('../frontend/node_modules/@playwright/test');
const root = path.resolve(__dirname, '..');
const dir = path.join(root, '.local/production');
const origin = 'http://localhost:8080';
(async () => {
  const credentials = JSON.parse(fs.readFileSync(path.join(dir, 'admin-credentials.json')));
  const ready = await fetch(origin + '/health/ready');
  assert.equal(ready.status, 200);
  const login = await fetch(origin + '/api/v1/auth/login', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(credentials)});
  assert.equal(login.status, 200);
  const session = await login.json();
  assert.equal(session.user.role, 'ADMIN');
  const baselineFile = path.join(dir, 'verified-admin-id');
  if (fs.existsSync(baselineFile)) assert.equal(session.user.id, fs.readFileSync(baselineFile,'utf8').trim());
  else fs.writeFileSync(baselineFile, session.user.id + '\n', {mode:0o600});
  const unauthorized = await fetch(origin + '/api/v1/users');
  assert.equal(unauthorized.status, 401);
  const browser = await chromium.launch({headless:true});
  const errors = [], failures = [], checks = [];
  try {
    const page = await browser.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => {
      if (response.url().includes('/api/v1/') && response.status() >= 400)
        failures.push({path:new URL(response.url()).pathname,status:response.status()});
    });
    await page.goto(origin);
    await page.getByLabel('Tên đăng nhập').fill(credentials.username);
    await page.getByLabel('Mật khẩu',{exact:true}).fill(credentials.password);
    await page.getByRole('button',{name:'Đăng nhập',exact:true}).click();
    await page.getByRole('heading',{name:'Tổng quan hoạt động'}).waitFor();
    await page.screenshot({path:path.join(root,'docs/production/laptop-dashboard.png')});
    for (const [label, heading, endpoint] of [
      ['Cấp hàng','Yêu cầu cấp hàng','orders'],
      ['Báo cáo','Báo cáo bán hàng','reports'],
      ['Kho & sản phẩm','Kho trung tâm & sản phẩm','inventory'],
      ['Thành viên','Đội ngũ','users'],
      ['Thu / chi','Giao dịch thu / chi','statements'],
      ['Công việc','Công việc','tasks'],
    ]) {
      const [response] = await Promise.all([
        page.waitForResponse(r => new URL(r.url()).pathname === '/api/v1/' + endpoint && r.request().method() === 'GET'),
        page.getByRole('link',{name:label,exact:true}).click(),
      ]);
      assert.equal(response.status(),200,endpoint);
      const data = await response.json();
      assert.ok(Array.isArray(endpoint === 'inventory' ? data.warehouse : data.items));
      checks.push({endpoint,status:200,rows:(endpoint === 'inventory' ? data.warehouse : data.items).length});
      await page.getByRole('heading',{name:heading,exact:true}).waitFor();
    }
    assert.deepEqual(errors,[]);assert.deepEqual(failures,[]);
    assert.equal(await page.getByRole('alert').count(),0);
  } finally {await browser.close();}
  const result = {status:'passed',verifiedAtUTC:new Date().toISOString(),origin,administratorIdentityPreserved:true,
    unauthenticatedAccess:'blocked',browserPages:6,checks,jsErrors:errors,failedResponses:failures,
    scope:'Real laptop production DB; read-only business acceptance. Synthetic workflows stay in the separate test databases.'};
  fs.writeFileSync(path.join(root,'docs/production/laptop-runtime.json'),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result));
})().catch(error => {console.error(error.message);process.exitCode=1;});
