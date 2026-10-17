// Cloudflare Pages Function. Requires D1 database binding named DB.
// Set up the table in schema.sql before enabling the waitlist.
const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff'
  }
});

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ ok: false, error: 'Waitlist not configured' }, 503);
  const type = request.headers.get('content-type') || '';
  if (!type.includes('application/json')) return json({ ok: false, error: 'Use application/json' }, 415);
  const contentLength = Number(request.headers.get('content-length') || '0');
  if (contentLength > 2048) return json({ ok: false, error: 'Invalid request' }, 413);

  let data;
  try { data = await request.json(); }
  catch { return json({ ok: false, error: 'Invalid JSON' }, 400); }
  if (!data || typeof data !== 'object') return json({ ok: false, error: 'Invalid request' }, 400);
  if (data.website) return json({ ok: true }); // Bot trap; don't store.
  const email = typeof data.email === 'string' ? data.email.trim().toLowerCase() : '';
  if (email.length > 254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)) {
    return json({ ok: false, error: 'Please enter a valid email address' }, 400);
  }

  try {
    await env.DB.prepare('INSERT OR IGNORE INTO waitlist (email) VALUES (?)').bind(email).run();
    return json({ ok: true });
  } catch {
    // Never leak infrastructure details to the visitor.
    return json({ ok: false, error: 'Please try again later' }, 503);
  }
}

export function onRequestGet() { return json({ ok: false, error: 'Method not allowed' }, 405); }