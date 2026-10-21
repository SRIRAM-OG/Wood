const $ = (s) => document.querySelector(s);
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(pointer: fine)').matches;
const { LABELS } = window.Order;

let all = [];          // every product, for the ring and the cart
let shown = [];        // products currently in the grid, for viewer prev/next
let current = 0;       // index into `shown` while the viewer is open
let cart = new Map(loadCart()); // code -> qty

function loadCart() {
  try { return Object.entries(JSON.parse(localStorageGet('cart') || '{}')).filter(([, q]) => q > 0); } catch { return []; }
}

function localStorageGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function localStorageSet(k, v) { try { localStorage.setItem(k, v); } catch {} }

const getJSON = (url) => fetch(url).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); });

// ---------- 3D tilt with glare ----------
function addTilt(el, max = 10) {
  if (reduceMotion || !finePointer) return;
  el.classList.add('tilt');
  if (!el.querySelector('.glare')) el.insertAdjacentHTML('beforeend', '<span class="glare"></span>');
  el.addEventListener('pointermove', (e) => {
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    el.style.transform = `perspective(900px) rotateY(${(x - .5) * max * 2}deg) rotateX(${(.5 - y) * max * 2}deg) translateZ(10px)`;
    el.style.setProperty('--gx', `${x * 100}%`);
    el.style.setProperty('--gy', `${y * 100}%`);
  });
  el.addEventListener('pointerleave', () => { el.style.transform = ''; });
}

// ---------- Hero ring carousel ----------
function buildRing(items) {
  const ring = $('#ring'), stage = $('#stage');
  const n = items.length, step = 360 / n;
  const radius = () => Math.round((ring.offsetWidth / 2) / Math.tan(Math.PI / n)) + 40;
  ring.innerHTML = items.map((p, i) =>
    `<figure data-i="${i}"><img src="${p.image}" alt="${p.name}" loading="lazy"></figure>`).join('');
  const place = () => ring.querySelectorAll('figure').forEach((f, i) => {
    f.style.transform = `rotateY(${i * step}deg) translateZ(${radius()}px)`;
  });
  place();
  addEventListener('resize', place);

  let angle = 0, velocity = reduceMotion ? 0 : -0.15, dragging = false, lastX = 0, tiltX = -8;
  stage.addEventListener('pointerdown', (e) => { dragging = true; lastX = e.clientX; stage.setPointerCapture(e.pointerId); });
  stage.addEventListener('pointermove', (e) => {
    if (dragging) { velocity = (e.clientX - lastX) * 0.25; lastX = e.clientX; }
    else if (finePointer) { const r = stage.getBoundingClientRect(); tiltX = -8 + ((e.clientY - r.top) / r.height - .5) * -14; }
  });
  stage.addEventListener('pointerup', () => { dragging = false; });
  stage.addEventListener('pointercancel', () => { dragging = false; });

  (function frame() {
    angle += velocity;
    if (!dragging && !reduceMotion) velocity += (-0.15 - velocity) * 0.03; // ease back to idle spin
    ring.style.transform = `rotateX(${tiltX}deg) rotateY(${angle}deg)`;
    requestAnimationFrame(frame);
  })();
}

// ---------- Filters & grid ----------
async function loadCategories() {
  const cats = await getJSON('/api/categories');
  $('#filters').innerHTML = cats.map((c, i) =>
    `<button class="chip" role="tab" data-cat="${c.id}" aria-selected="${i === 0}">${c.label}<small>${c.count}</small></button>`).join('');
  $('#footer-count').textContent = `${cats[0].count} pieces in the collection.`;
  $('#filters').addEventListener('click', (e) => {
    const b = e.target.closest('.chip');
    if (!b) return;
    document.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-selected', c === b));
    loadGrid();
  });
}

let searchTimer;
$('#search').addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(loadGrid, 200); });

async function loadGrid() {
  const cat = document.querySelector('.chip[aria-selected="true"]')?.dataset.cat || 'all';
  const q = $('#search').value.trim();
  shown = await getJSON(`/api/products?category=${cat}&q=${encodeURIComponent(q)}`);
  const grid = $('#grid');
  if (!shown.length) { grid.innerHTML = '<p class="empty">No pieces match that search.</p>'; return; }
  grid.innerHTML = shown.map((p, i) => `
    <article class="card" tabindex="0" data-i="${i}" aria-label="${p.name}, ${LABELS[p.category]}">
      <div class="img-wrap"><img src="${p.image}" alt="${p.name}" loading="lazy"></div>
      <button class="add" data-code="${p.code}" aria-pressed="${cart.has(p.code)}" aria-label="Add ${p.name} to cart">${cart.has(p.code) ? '✓' : '+'}</button>
      <div class="meta"><h3>${p.name}</h3><span class="tag">${LABELS[p.category]}</span></div>
    </article>`).join('');
  grid.querySelectorAll('.card').forEach((card, i) => {
    addTilt(card, 8);
    card.style.transitionDelay = `${(i % 8) * 40}ms`;
    revealer.observe(card);
  });
}

$('#grid').addEventListener('click', (e) => {
  const add = e.target.closest('.add');
  if (add) { toggleCart(add.dataset.code); return; }
  const card = e.target.closest('.card');
  if (card) openViewer(+card.dataset.i);
});
$('#grid').addEventListener('keydown', (e) => {
  const card = e.target.closest('.card');
  if (card && e.key === 'Enter') openViewer(+card.dataset.i);
});

// ---------- Viewer ----------
const viewer = $('#viewer');
function openViewer(i) {
  current = (i + shown.length) % shown.length;
  const p = shown[current];
  $('#viewer-img').src = p.image;
  $('#viewer-img').alt = p.name;
  $('#viewer-name').textContent = p.name;
  $('#viewer-cat').textContent = LABELS[p.category];
  $('#viewer-add').textContent = cart.has(p.code) ? 'In cart ✓ (remove)' : 'Add to cart';
  if (!viewer.open) viewer.showModal();
}
viewer.addEventListener('click', (e) => {
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (act === 'close' || e.target === viewer) viewer.close();
  if (act === 'prev') openViewer(current - 1);
  if (act === 'next') openViewer(current + 1);
});
viewer.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft') openViewer(current - 1);
  if (e.key === 'ArrowRight') openViewer(current + 1);
});
$('#viewer-add').addEventListener('click', () => { toggleCart(shown[current].code); openViewer(current); });

// ---------- Cart ----------
const drawer = $('#cart');
function saveCart() {
  localStorageSet('cart', JSON.stringify(Object.fromEntries(cart)));
  renderCart();
  document.querySelectorAll('.add').forEach((b) => {
    b.setAttribute('aria-pressed', cart.has(b.dataset.code));
    b.textContent = cart.has(b.dataset.code) ? '✓' : '+';
  });
}
function toggleCart(code) {
  cart.has(code) ? cart.delete(code) : cart.set(code, 1);
  saveCart();
}
function setQty(code, qty) {
  qty > 0 ? cart.set(code, Math.min(qty, 999)) : cart.delete(code);
  saveCart();
}
function cartItems() {
  return [...cart].map(([code, qty]) => ({ ...all.find((p) => p.code === code), qty })).filter((i) => i.name);
}
function renderCart() {
  const total = [...cart.values()].reduce((s, q) => s + q, 0);
  const badge = $('#cart-count');
  badge.textContent = total;
  badge.classList.remove('bump'); void badge.offsetWidth; badge.classList.add('bump');
  const items = cartItems();
  $('#cart-items').innerHTML = items.length
    ? items.map((i) => `
      <li data-code="${i.code}">
        <img src="${i.image}" alt="">
        <div><strong>${i.name}</strong><span class="tag">${LABELS[i.category]}</span></div>
        <div class="qty">
          <button type="button" data-q="-1" aria-label="Decrease">−</button>
          <input type="number" min="1" max="999" value="${i.qty}" aria-label="Quantity of ${i.name}">
          <button type="button" data-q="1" aria-label="Increase">+</button>
        </div>
        <button type="button" class="remove" aria-label="Remove ${i.name}">×</button>
      </li>`).join('')
    : '<li class="empty">Your cart is empty. Tap + on any profile to add it.</li>';
}
$('#cart-items').addEventListener('click', (e) => {
  const li = e.target.closest('li[data-code]');
  if (!li) return;
  const code = li.dataset.code;
  if (e.target.closest('.remove')) setQty(code, 0);
  const q = e.target.closest('[data-q]');
  if (q) setQty(code, (cart.get(code) || 0) + +q.dataset.q);
});
$('#cart-items').addEventListener('change', (e) => {
  const li = e.target.closest('li[data-code]');
  if (li && e.target.matches('input')) setQty(li.dataset.code, Math.floor(+e.target.value) || 0);
});
const openCart = () => { $('#form-status').textContent = ''; if (!drawer.open) drawer.showModal(); };
$('#cart-open').addEventListener('click', openCart);
document.querySelectorAll('[data-open-cart]').forEach((b) => b.addEventListener('click', openCart));
drawer.addEventListener('click', (e) => {
  if (e.target === drawer || e.target.closest('[data-close-cart]')) drawer.close();
});

$('#order-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const form = e.target, status = $('#form-status');
  const items = cartItems();
  status.className = 'form-status err';
  if (!items.length) { status.textContent = 'Add at least one profile to your cart first.'; return; }
  const { name, phone, note } = Object.fromEntries(new FormData(form));
  const message = Order.buildMessage({ name: name.trim(), phone: phone.trim(), note: note.trim(), items, siteUrl: location.origin });
  const url = Order.whatsappUrl(message);
  // Open WhatsApp first, inside the click, so the popup is not blocked; save the order in the background.
  const win = window.open(url, '_blank');
  if (!win) location.href = url;
  fetch('/api/enquiries', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: true,
    body: JSON.stringify({ name, phone, message: note, products: items.map((i) => ({ code: i.code, qty: i.qty })) }),
  }).catch(() => {});
  status.className = 'form-status';
  status.textContent = 'WhatsApp opened with your order. Press Send there to reach us.';
});

// Shared cart link (?cart=003x2,042x1) loads that cart, e.g. when the shop opens a link from WhatsApp.
function loadCartFromUrl() {
  const shared = Order.decodeCart(new URLSearchParams(location.search).get('cart'));
  if (!shared.length) return;
  cart = new Map(shared.filter((i) => all.some((p) => p.code === i.code)).map((i) => [i.code, i.qty]));
  history.replaceState(null, '', location.pathname);
  saveCart();
  openCart();
}

// ---------- Scroll reveal ----------
const revealer = new IntersectionObserver((entries) => entries.forEach((en) => {
  if (en.isIntersecting) { en.target.classList.add('in'); revealer.unobserve(en.target); }
}), { threshold: 0.12 });
document.querySelectorAll('.reveal').forEach((el) => revealer.observe(el));
addTilt($('#spotlight'), 6);

// ---------- Boot ----------
(async () => {
  try {
    all = await getJSON('/api/products');
    const featured = [3, 27, 33, 39, 41, 44, 52, 57, 60, 89, 32, 43].map((id) => all.find((p) => p.id === id)).filter(Boolean);
    buildRing(featured);
    renderCart();
    await loadCategories();
    await loadGrid();
    loadCartFromUrl();
  } catch {
    $('#grid').innerHTML = '<p class="empty">Could not load the collection. Is the server running?</p>';
  }
})();
