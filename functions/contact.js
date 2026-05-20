/**
 * POST /contact — Submit feedback form
 *
 * Receives JSON { name, email, message, page }
 * Sends an email to cs@anycalculator.site via AgentMail API.
 *
 * Requires environment variable: AGENTMAIL_API_KEY
 */
export async function onRequest(context) {
  const { request, env } = context;

  // CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  const apiKey = env.AGENTMAIL_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'Server config error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  const { name = '', email = '', message = '', page = '' } = body;
  if (!message.trim()) {
    return new Response(JSON.stringify({ error: 'Message is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  const subject = page
    ? `[Feedback] ${page} — ${name || 'Anonymous'}`
    : `[Feedback] ${name || 'Anonymous'}`;

  const textBody = [
    `Name: ${name || 'Not provided'}`,
    `Email: ${email || 'Not provided'}`,
    `Page: ${page || 'N/A'}`,
    '',
    'Message:',
    message,
  ].join('\n');

  try {
    const resp = await fetch(`https://api.agentmail.to/v0/inboxes/anycalculator@agentmail.to/messages/send`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: ['cs@anycalculator.site'],
        subject,
        text: textBody,
        reply_to: email || undefined,
      }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      console.error('AgentMail error:', resp.status, err);
      return new Response(JSON.stringify({ error: 'Failed to send' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  } catch (err) {
    console.error('Fetch error:', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
}
