// televizorieftin.ro — colector eMAG (CF Worker + KV).
// Primeste produse de la extensie (POST ?k=SECRET {products:[...]}), le pune in KV pe id.
// GET /dump?k=SECRET  -> {count, products:[...]}  (il citesc din pipeline)
// GET /reset?k=SECRET -> sterge tot (inainte de o scanare noua)
const SECRET = 'tvief_emag_2026';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'POST,GET,OPTIONS' };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (url.searchParams.get('k') !== SECRET) return new Response('forbidden', { status: 403, headers: cors });

    if (request.method === 'POST') {
      let body; try { body = await request.json(); } catch { return new Response('bad json', { status: 400, headers: cors }); }
      const items = Array.isArray(body.products) ? body.products : [];
      let saved = 0;
      for (const p of items) { if (p && p.id) { await env.EMAG.put('p:' + p.id, JSON.stringify(p)); saved++; } }
      return Response.json({ saved }, { headers: cors });
    }

    if (url.pathname === '/dump') {
      const out = []; let cursor;
      do {
        const list = await env.EMAG.list({ prefix: 'p:', cursor });
        for (const k of list.keys) { const v = await env.EMAG.get(k.name); if (v) out.push(JSON.parse(v)); }
        cursor = list.list_complete ? null : list.cursor;
      } while (cursor);
      return Response.json({ count: out.length, products: out }, { headers: cors });
    }

    if (url.pathname === '/reset') {
      let cursor, n = 0;
      do {
        const list = await env.EMAG.list({ prefix: 'p:', cursor });
        for (const k of list.keys) { await env.EMAG.delete(k.name); n++; }
        cursor = list.list_complete ? null : list.cursor;
      } while (cursor);
      return Response.json({ deleted: n }, { headers: cors });
    }

    return new Response('tvieftin emag collector ok', { headers: cors });
  }
};
