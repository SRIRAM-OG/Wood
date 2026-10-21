// JSON API shared by the local Node server and the Netlify Function.
// `store` saves enquiries: { add(enquiry), list() }, both may be async.
const products = require('../data/products.json');

const CATEGORIES = [
  { id: 'corners', label: 'Corners' },
  { id: 'profiles', label: 'Profile studies' },
  { id: 'workshop', label: 'In the workshop' },
];

function publicProduct({ original, ...p }) { return p; }

// req: { method, pathname, searchParams, headers: (name) => value, body: string }
// Returns { status, body }.
async function handle(req, store, adminKey) {
  const parts = req.pathname.split('/').filter(Boolean); // ['api', ...]

  if (req.method === 'GET' && parts[1] === 'categories') {
    const counts = Object.fromEntries(CATEGORIES.map((c) => [c.id, 0]));
    products.forEach((p) => counts[p.category]++);
    return { status: 200, body: [
      { id: 'all', label: 'All pieces', count: products.length },
      ...CATEGORIES.map((c) => ({ ...c, count: counts[c.id] })),
    ] };
  }

  if (req.method === 'GET' && parts[1] === 'products' && parts.length === 2) {
    const cat = req.searchParams.get('category');
    const q = (req.searchParams.get('q') || '').toLowerCase();
    const list = products.filter((p) =>
      (!cat || cat === 'all' || p.category === cat) &&
      (!q || p.name.toLowerCase().includes(q) || p.code.includes(q)));
    return { status: 200, body: list.map(publicProduct) };
  }

  if (req.method === 'GET' && parts[1] === 'products' && parts.length === 3) {
    const p = products.find((x) => x.code === parts[2] || String(x.id) === parts[2]);
    return p ? { status: 200, body: publicProduct(p) } : { status: 404, body: { error: 'Not found' } };
  }

  if (req.method === 'POST' && parts[1] === 'enquiries') {
    let body;
    try { body = JSON.parse(req.body); } catch { return { status: 400, body: { error: 'Invalid JSON' } }; }
    const name = String(body.name || '').trim().slice(0, 100);
    const phone = String(body.phone || '').trim().slice(0, 20);
    const message = String(body.message || '').trim().slice(0, 1000);
    const items = (Array.isArray(body.products) ? body.products : []).slice(0, 100)
      .map((i) => ({ code: String(i?.code ?? ''), qty: Number(i?.qty) }));
    if (!name) return { status: 400, body: { error: 'Name is required' } };
    if (!/^[+\d][\d\s-]{6,18}$/.test(phone)) return { status: 400, body: { error: 'Valid phone number is required' } };
    const unknown = items.filter((i) => !products.some((p) => p.code === i.code)).map((i) => i.code);
    if (unknown.length) return { status: 400, body: { error: `Unknown products: ${unknown.join(', ')}` } };
    if (items.some((i) => !Number.isInteger(i.qty) || i.qty < 1 || i.qty > 999)) return { status: 400, body: { error: 'Quantity must be 1 to 999' } };
    const enquiry = { id: Date.now().toString(36), name, phone, message, products: items, createdAt: new Date().toISOString() };
    await store.add(enquiry);
    return { status: 201, body: { ok: true, id: enquiry.id } };
  }

  if (req.method === 'GET' && parts[1] === 'enquiries') {
    if (!adminKey || req.headers('x-admin-key') !== adminKey) return { status: 401, body: { error: 'Unauthorized' } };
    return { status: 200, body: await store.list() };
  }

  return { status: 404, body: { error: 'Not found' } };
}

module.exports = { handle };
