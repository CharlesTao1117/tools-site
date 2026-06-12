// EXAM-AI API — Progress Sync Download
// GET /api/sync/download
// Header: Authorization: Bearer <token>

import { verifyToken, corsHeaders } from '../../_auth-utils';

export async function onRequestGet(context) {
  const { request, env } = context;
  const headers = { ...corsHeaders(), 'Content-Type': 'application/json' };

  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers });
    }

    const payload = await verifyToken(authHeader.slice(7), env.JWT_SECRET);
    if (!payload) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401, headers });
    }

    if (!env.EXAM_AI_DB) {
      return new Response(JSON.stringify({
        error: 'Database not configured',
        code: 'DB_NOT_CONFIGURED'
      }), { status: 503, headers });
    }

    const rows = await env.EXAM_AI_DB.prepare(
      'SELECT data_key, data_value, updated_at FROM quiz_progress WHERE user_id = ?'
    ).bind(payload.userId).all();

    const data = {};
    for (const row of rows.results || []) {
      try {
        data[row.data_key] = JSON.parse(row.data_value);
      } catch {
        data[row.data_key] = row.data_value;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      data
    }), { status: 200, headers });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
  }
}
