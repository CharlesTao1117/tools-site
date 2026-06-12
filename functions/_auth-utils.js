// EXAM-AI Auth — Shared utility functions
// Used by all API endpoints

export async function hashPassword(password, secret) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + ':' + secret);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function generateJWT(payload, secret) {
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

export async function verifyToken(token, secret) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    // Verify signature
    const encoder = new TextEncoder();
    const data = encoder.encode(parts[0] + '.' + parts[1] + ':' + secret);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const expectedSig = btoa(String.fromCharCode(...hashArray));
    
    if (parts[2] !== expectedSig) return null;
    
    // Check expiry
    const body = JSON.parse(atob(parts[1]));
    if (body.exp && body.exp < Math.floor(Date.now() / 1000)) return null;
    
    return body;
  } catch {
    return null;
  }
}

export function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}
