// EXAM-AI API — Progress Sync Upload
// POST /api/sync/upload
// Header: Authorization: Bearer <token>
// Body: { wrong_book, quiz_history, weakness_stats }

import { verifyToken, corsHeaders } from '../../_auth-utils';

export async function onRequestPost(context) {
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

    const body = await request.json();
    const syncTypes = ['wrong_book', 'quiz_history', 'weakness_stats'];

    for (const key of syncTypes) {
      if (body[key] !== undefined) {
        await env.EXAM_AI_DB.prepare(
          `INSERT INTO quiz_progress (user_id, data_key, data_value, updated_at)
           VALUES (?, ?, ?, datetime('now'))
           ON CONFLICT(user_id, data_key) DO UPDATE SET
             data_value = excluded.data_value,
             updated_at = datetime('now')`
        ).bind(payload.userId, key, JSON.stringify(body[key])).run();
      }
    }

    return new Response(JSON.stringify({
      success: true,
      synced: syncTypes.filter(k => body[k] !== undefined)
    }), { status: 200, headers });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
  }
}
