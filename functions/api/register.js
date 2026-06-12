// EXAM-AI Auth API — Register
// POST /api/register
// Body: { email, password, nickname, invite_code }

export async function onRequestPost(context) {
  const { request, env } = context;
  
  try {
    const body = await request.json();
    const { email, password, nickname, invite_code } = body;

    // Validate required fields
    if (!email || !password || !invite_code) {
      return new Response(JSON.stringify({
        error: '請填寫 Email、密碼和邀請碼',
        code: 'MISSING_FIELDS'
      }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({
        error: 'Email 格式不正確',
        code: 'INVALID_EMAIL'
      }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // Password minimum length
    if (password.length < 6) {
      return new Response(JSON.stringify({
        error: '密碼至少需要 6 個字元',
        code: 'WEAK_PASSWORD'
      }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // Verify invite code
    // Check KV first, then D1
    let inviteValid = false;
    
    if (env.INVITE_CODES) {
      const kvCode = await env.INVITE_CODES.get(invite_code);
      if (kvCode) {
        const codeData = JSON.parse(kvCode);
        if (codeData.uses < codeData.max_uses && (!codeData.expires_at || new Date(codeData.expires_at) > new Date())) {
          inviteValid = true;
          codeData.uses++;
          await env.INVITE_CODES.put(invite_code, JSON.stringify(codeData));
        }
      }
    }

    // Fallback: check hardcoded beta invite codes if no KV binding
    if (!inviteValid) {
      const BETA_CODES = (env.BETA_INVITE_CODES || 'EXAMAI-BETA-001,EXAMAI-BETA-002,EXAMAI-BETA-003').split(',');
      if (BETA_CODES.includes(invite_code.trim())) {
        inviteValid = true;
      }
    }

    if (!inviteValid) {
      return new Response(JSON.stringify({
        error: '邀請碼無效或已使用完畢',
        code: 'INVALID_INVITE'
      }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    }

    // Hash password (simple SHA-256 for beta — use bcrypt for production)
    const passwordHash = await hashPassword(password, env.JWT_SECRET || 'exam-ai-beta-secret-20260612');

    // Store user in D1
    if (env.EXAM_AI_DB) {
      const existingUser = await env.EXAM_AI_DB.prepare(
        'SELECT id FROM users WHERE email = ?'
      ).bind(email).first();

      if (existingUser) {
        return new Response(JSON.stringify({
          error: '此 Email 已註冊過',
          code: 'EMAIL_EXISTS'
        }), { status: 409, headers: { 'Content-Type': 'application/json' } });
      }

      await env.EXAM_AI_DB.prepare(
        'INSERT INTO users (email, password_hash, nickname, invite_code_used) VALUES (?, ?, ?, ?)'
      ).bind(email, passwordHash, nickname || '', invite_code).run();

      // Get the new user
      const user = await env.EXAM_AI_DB.prepare(
        'SELECT id, email, nickname, created_at FROM users WHERE email = ?'
      ).bind(email).first();

      // Generate JWT
      const token = await generateJWT({ userId: user.id, email: user.email }, env.JWT_SECRET);

      return new Response(JSON.stringify({
        success: true,
        user: { id: user.id, email: user.email, nickname: user.nickname },
        token
      }), { status: 201, headers: { 'Content-Type': 'application/json' } });
    } else {
      // Demo mode — no D1 configured
      // Store in env for session duration only (not persistent)
      return new Response(JSON.stringify({
        success: true,
        user: { id: 1, email, nickname: nickname || '' },
        token: await generateJWT({ userId: 1, email }, env.JWT_SECRET),
        _warning: 'D1 not configured — data not persistent'
      }), { status: 201, headers: { 'Content-Type': 'application/json' } });
    }
  } catch (err) {
    return new Response(JSON.stringify({
      error: '伺服器錯誤，請稍後再試',
      code: 'SERVER_ERROR',
      detail: err.message
    }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

async function hashPassword(password, secret) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + ':' + secret);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function generateJWT(payload, secret) {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const body = btoa(JSON.stringify({ ...payload, iat: now, exp: now + 86400 * 7 }));
  const encoder = new TextEncoder();
  const data = encoder.encode(header + '.' + body + ':' + secret);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const signature = btoa(String.fromCharCode(...hashArray));
  return header + '.' + body + '.' + signature;
}
