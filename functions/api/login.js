// EXAM-AI Auth API — Login
// POST /api/login
// Body: { email, password }

import { hashPassword, generateJWT, verifyToken } from '../_auth-utils';

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return new Response(JSON.stringify({
        error: '請填寫 Email 和密碼',
        code: 'MISSING_FIELDS'
      }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    if (env.EXAM_AI_DB) {
      const user = await env.EXAM_AI_DB.prepare(
        'SELECT id, email, password_hash, nickname FROM users WHERE email = ?'
      ).bind(email).first();

      if (!user) {
        return new Response(JSON.stringify({
          error: 'Email 或密碼錯誤',
          code: 'AUTH_FAILED'
        }), { status: 401, headers: { 'Content-Type': 'application/json' } });
      }

      const passwordHash = await hashPassword(password, env.JWT_SECRET);
      if (user.password_hash !== passwordHash) {
        return new Response(JSON.stringify({
          error: 'Email 或密碼錯誤',
          code: 'AUTH_FAILED'
        }), { status: 401, headers: { 'Content-Type': 'application/json' } });
      }

      // Update last login
      await env.EXAM_AI_DB.prepare(
        'UPDATE users SET last_login_at = datetime(\'now\') WHERE id = ?'
      ).bind(user.id).run();

      const token = await generateJWT({ userId: user.id, email: user.email }, env.JWT_SECRET);

      return new Response(JSON.stringify({
        success: true,
        user: { id: user.id, email: user.email, nickname: user.nickname },
        token
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    } else {
      return new Response(JSON.stringify({
        error: '伺服器尚未完成資料庫設定（D1 not configured）',
        code: 'DB_NOT_CONFIGURED'
      }), { status: 503, headers: { 'Content-Type': 'application/json' } });
    }
  } catch (err) {
    return new Response(JSON.stringify({
      error: '伺服器錯誤',
      code: 'SERVER_ERROR',
      detail: err.message
    }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
