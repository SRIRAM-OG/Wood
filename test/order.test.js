const { test } = require('node:test');
const assert = require('node:assert');
const Order = require('../public/order.js');

const items = [
  { code: '003', qty: 2, name: 'Profile 003', category: 'corners' },
  { code: '042', qty: 1, name: 'Profile 042', category: 'corners' },
];

test('cart link round-trips and rejects junk', () => {
  assert.strictEqual(Order.encodeCart(items), '003x2,042x1');
  assert.deepStrictEqual(Order.decodeCart('003x2,042x1'), [{ code: '003', qty: 2 }, { code: '042', qty: 1 }]);
  assert.deepStrictEqual(Order.decodeCart('003x0,abc,<script>,12x1'), []);
});

test('WhatsApp message has name, mobile, items and cart link, sent to shop number', () => {
  const msg = Order.buildMessage({ name: 'Ravi', phone: '9876543210', note: 'Teak', items, siteUrl: 'http://localhost:3000' });
  for (const part of ['Name: Ravi', 'Mobile: 9876543210', '1. Profile 003 (Corners) × 2', '2. Profile 042 (Corners) × 1',
    'Total pieces: 3', 'Note: Teak', 'View cart: http://localhost:3000/?cart=003x2,042x1']) {
    assert.ok(msg.includes(part), part);
  }
  const url = new URL(Order.whatsappUrl(msg));
  assert.strictEqual(url.origin + url.pathname, 'https://wa.me/917981060454');
  assert.strictEqual(url.searchParams.get('text'), msg);
});
