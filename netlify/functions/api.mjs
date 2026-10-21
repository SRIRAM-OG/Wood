// Netlify Function serving /api/*. Enquiries are kept in Netlify Blobs, one key per enquiry.
import { getStore } from '@netlify/blobs';
import api from '../../lib/api.js';

const blobStore = {
  add: (enquiry) => getStore('enquiries').setJSON(`${enquiry.createdAt}-${enquiry.id}`, enquiry),
  async list() {
    const store = getStore('enquiries');
    const { blobs } = await store.list();
    const all = await Promise.all(blobs.map((b) => store.get(b.key, { type: 'json' })));
    return all.filter(Boolean).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },
};

export default async (req) => {
  const url = new URL(req.url);
  const body = req.method === 'POST' ? await req.text() : '';
  if (body.length > 10_000) return Response.json({ error: 'Too large' }, { status: 413 });
  try {
    const out = await api.handle({
      method: req.method, pathname: url.pathname, searchParams: url.searchParams,
      headers: (name) => req.headers.get(name), body,
    }, blobStore, process.env.ADMIN_KEY || '');
    return Response.json(out.body, { status: out.status });
  } catch {
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
};

export const config = { path: '/api/*' };
