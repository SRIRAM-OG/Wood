const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ENQ = path.join(__dirname, '..', 'data', 'enquiries.json');
const backup = fs.existsSync(ENQ) ? fs.readFileSync(ENQ) : null;
process.env.ADMIN_KEY = 'test-key';
const server = require('../server');
let base;

before(() => new Promise((r) => server.listen(0, () => { base = `http://localhost:${server.address().port}`; r(); })));
after(() => {
  server.close();
  backup ? fs.writeFileSync(ENQ, backup) : fs.rmSync(ENQ, { force: true });
});

const post = (body) => fetch(`${base}/api/enquiries`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

test('categories add up to 98', async () => {
  const cats = await (await fetch(`${base}/api/categories`)).json();
  assert.strictEqual(cats[0].count, 98);
  assert.strictEqual(cats.slice(1).reduce((s, c) => s + c.count, 0), 98);
});

test('filter, search and single product; original filename hidden', async () => {
  const corners = await (await fetch(`${base}/api/products?category=corners`)).json();
  assert.ok(corners.length > 0 && corners.every((p) => p.category === 'corners' && !p.original));
  const found = await (await fetch(`${base}/api/products?q=042`)).json();
  assert.deepStrictEqual(found.map((p) => p.code), ['042']);
  assert.strictEqual((await fetch(`${base}/api/products/999`)).status, 404);
});

test('static files and path traversal', async () => {
  assert.strictEqual((await fetch(`${base}/`)).status, 200);
  assert.strictEqual((await fetch(`${base}/images/profile-000.jpeg`)).status, 200);
  assert.notStrictEqual((await fetch(`${base}/..%2fserver.js`)).status, 200);
});

test('enquiry validation, save, and admin listing', async () => {
  assert.strictEqual((await post({ name: '', phone: '9876543210' })).status, 400);
  assert.strictEqual((await post({ name: 'A', phone: 'abc' })).status, 400);
  assert.strictEqual((await post({ name: 'A', phone: '9876543210', products: [{ code: 'xyz', qty: 1 }] })).status, 400);
  assert.strictEqual((await post({ name: 'A', phone: '9876543210', products: [{ code: '003', qty: 0 }] })).status, 400);
  assert.strictEqual((await post({ name: 'Ravi', phone: '+91 98765 43210', products: [{ code: '003', qty: 2 }] })).status, 201);
  assert.strictEqual((await fetch(`${base}/api/enquiries`)).status, 401);
  const list = await (await fetch(`${base}/api/enquiries`, { headers: { 'x-admin-key': 'test-key' } })).json();
  assert.strictEqual(list.at(-1).name, 'Ravi');
  assert.deepStrictEqual(list.at(-1).products, [{ code: '003', qty: 2 }]);
});
