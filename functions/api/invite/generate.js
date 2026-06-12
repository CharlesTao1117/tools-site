// EXAM-AI Admin API — Generate invite codes
// GET /api/invite/generate?count=5
// Header: Authorization: Bearer <admin-token>

import { verifyToken, corsHeaders } from '../../_auth-utils';

export async function onRequestGet(context) {
  const { request, env } = context;
  const headers = { ...corsHeaders(), 'Content-Type': 'application/json' };

  try {
    // Verify admin
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers });
    }

    const token = authHeader.slice(7);
    const payload = await verifyToken(token, env.JWT_SECRET);
    if (!payload) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401, headers });
    }

    // Check admin status
    if (payload.email !== (env.ADMIN_EMAIL || 'calmestao@gmail.com')) {
      return new Response(JSON.stringify({ error: 'Admin only' }), { status: 403, headers });
    }

    const url = new URL(request.url);
    const count = parseInt(url.searchParams.get('count') || '5', 10);
    const maxUses = parseInt(url.searchParams.get('max_uses') || '1', 10);

    const codes = [];
    for (let i = 0; i < count; i++) {
      const code = generateCode();
      codes.push(code);

      // Store in KV if available
      if (env.INVITE_CODES) {
        await env.INVITE_CODES.put(code, JSON.stringify({
          uses: 0,
          max_uses: maxUses,
          created_at: new Date().toISOString(),
          created_by: payload.userId
        }));
      }
    }

    return new Response(JSON.stringify({
      success: true,
      codes,
      note: env.INVITE_CODES ? 'Stored in KV' : 'No KV binding — codes are ephemeral'
    }), { status: 200, headers });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
  }
}

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'EXAMAI-';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  code += '-';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}
