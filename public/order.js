// Shared by the browser (window.Order) and the Node tests (require).
(function (root) {
  const SHOP_PHONE = '7981060454';
  const SHOP_WHATSAPP = '91' + SHOP_PHONE;
  const LABELS = { corners: 'Corners', profiles: 'Profile studies', workshop: 'In the workshop' };

  // Cart <-> URL param: "003x2,042x1"
  function encodeCart(items) {
    return items.map((i) => `${i.code}x${i.qty}`).join(',');
  }
  function decodeCart(param) {
    return String(param || '').split(',').map((part) => {
      const m = /^(\d{3})x(\d{1,3})$/.exec(part.trim());
      return m && +m[2] > 0 ? { code: m[1], qty: +m[2] } : null;
    }).filter(Boolean);
  }

  // items: [{ code, qty, name, category }]
  function buildMessage({ name, phone, note, items, siteUrl }) {
    const lines = [
      "New order — Sathish's Veni Beddings",
      `Name: ${name}`,
      `Mobile: ${phone}`,
      '',
      ...items.map((i, n) => `${n + 1}. ${i.name} (${LABELS[i.category] || i.category}) × ${i.qty}`),
      '',
      `Total pieces: ${items.reduce((s, i) => s + i.qty, 0)}`,
    ];
    if (note) lines.push(`Note: ${note}`);
    lines.push('', `View cart: ${siteUrl}/?cart=${encodeCart(items)}`);
    return lines.join('\n');
  }

  function whatsappUrl(message) {
    return `https://wa.me/${SHOP_WHATSAPP}?text=${encodeURIComponent(message)}`;
  }

  const api = { SHOP_PHONE, SHOP_WHATSAPP, LABELS, encodeCart, decodeCart, buildMessage, whatsappUrl };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Order = api;
})(this);
