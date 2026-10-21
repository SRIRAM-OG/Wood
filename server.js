// Woodwork catalog server: static frontend + JSON API. No dependencies (Node 18+).
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { handle } = require('./lib/api');

const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const ENQUIRIES_FILE = path.join(ROOT, 'data', 'enquiries.json');
const ADMIN_KEY = process.env.ADMIN_KEY || '';

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
  '.json': 'application/json', '.jpeg': 'image/jpeg', '.jpg': 'image/jpeg',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};

function readEnquiries() {
  try { return JSON.parse(fs.readFileSync(ENQUIRIES_FILE, 'utf8')); } catch { return []; }
}

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function readBody(req, limit = 10_000) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => {
      data += c;
      if (data.length > limit) { reject(new Error('too large')); req.destroy(); }
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

const fileStore = {
  add(enquiry) {
    const all = readEnquiries();
    all.push(enquiry);
    fs.writeFileSync(ENQUIRIES_FILE, JSON.stringify(all, null, 1));
  },
  list: readEnquiries,
};

async function api(req, res, url) {
  const body = req.method === 'POST' ? await readBody(req) : '';
  const out = await handle({
    method: req.method, pathname: url.pathname, searchParams: url.searchParams,
    headers: (name) => req.headers[name], body,
  }, fileStore, ADMIN_KEY);
  send(res, out.status, out.body);
}

function serveStatic(req, res, url) {
  const rel = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
  const file = path.join(PUBLIC, rel);
  if (!file.startsWith(PUBLIC + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': ext === '.jpeg' ? 'public, max-age=604800' : 'no-cache',
    });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.startsWith('/api/')) {
    api(req, res, url).catch(() => send(res, 500, { error: 'Server error' }));
  } else serveStatic(req, res, url);
});

if (require.main === module) {
  const port = process.env.PORT || 3000;
  server.listen(port, () => console.log(`Woodwork catalog on http://localhost:${port}`));
}
module.exports = server;
