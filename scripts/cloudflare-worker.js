/**
 * DBS Loot Council — Cloudflare Workers KV Storage
 * Token is hardcoded below — replace with your chosen write token.
 * The Worker source is only visible to the Cloudflare account owner.
 */

const WRITE_TOKEN = 'REPLACE_WITH_YOUR_TOKEN';

const ALLOWED_KEYS = new Set([
  'loot-glossary.json',
  'roster.json',
  'attendance.json',
  'loot-distribution.json',
  'bis-data.json',
  'gear-item-ids.json',
  'set-bonuses.json',
  'wcl-config.json',
  'cla-sheets.json',
]);

export default {
  async fetch(request, env) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Token',
    };

    if (request.method === 'OPTIONS')
      return new Response(null, { status: 204, headers: corsHeaders });

    const url = new URL(request.url);
    const key = url.pathname.replace(/^\/+/, '');

    if (!key || !ALLOWED_KEYS.has(key))
      return new Response(JSON.stringify({ error: 'Unknown key: ' + key }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    // ── GET (open, no auth required) ─────────────────────────────
    if (request.method === 'GET') {
      const value = await env.DB.get(key);
      return value
        ? new Response(value, {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        : new Response(JSON.stringify({ error: 'Not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
    }

    // ── POST /auth-check (token validation only, no side effects) ───
    if (request.method === 'POST' && key === 'auth-check') {
      const token = request.headers.get('X-Token');
      if (!token || token !== WRITE_TOKEN)
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── PUT (write token required) ────────────────────────────────
    if (request.method === 'PUT') {
      const token = request.headers.get('X-Token');
      if (!token || token !== WRITE_TOKEN)
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      const body = await request.text();
      try { JSON.parse(body); } catch {
        return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      await env.DB.put(key, body);
      return new Response(JSON.stringify({ ok: true, key }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  },
};
