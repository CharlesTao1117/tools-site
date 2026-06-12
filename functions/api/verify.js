// EXAM-AI Auth API — Verify Token
// GET /api/verify
// Header: Authorization: Bearer <token>

import { verifyToken, corsHeaders } from '../_auth-utils';

export async function onRequestGet(context) {
  const { request, env } = context;
  const headers = { ...corsHeaders(), 'Content-Type': 'application/json' };

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders() });
  }

  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({
        authenticated: false,
        error: '未提供有效的認證資訊'
      }), { status: 401, headers });
    }

    const token = authHeader.slice(7);
    const payload = await verifyToken(token, env.JWT_SECRET || 'exam-ai-beta-secret-20260612');

    if (!payload) {
      return new Response(JSON.stringify({
        authenticated: false,
        error: 'Token 無效或已過期'
      }), { status: 401, headers });
    }

    return new Response(JSON.stringify({
      authenticated: true,
      user: { id: payload.userId, email: payload.email }
    }), { status: 200, headers });
  } catch (err) {
    return new Response(JSON.stringify({
      authenticated: false,
      error: '伺服器錯誤'
    }), { status: 500, headers });
  }
}
