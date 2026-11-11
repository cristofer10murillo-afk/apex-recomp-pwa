export default async (req) => {
  const apiKey =
    (typeof Netlify !== 'undefined' && Netlify.env ? Netlify.env.get('GEMINI_API_KEY') : '') ||
    process.env.GEMINI_API_KEY ||
    '';

  if (req.method === 'GET') {
    return Response.json({ configured: Boolean(apiKey) });
  }

  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  if (!apiKey) {
    return Response.json(
      { error: 'GEMINI_API_KEY environment variable not configured on Netlify.' },
      { status: 503 }
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON request body' }, { status: 400 });
  }

  const model = typeof body?.model === 'string' ? body.model.trim() : '';
  const payload = body?.payload;

  if (!model || !/^[a-zA-Z0-9._-]+$/.test(model) || !payload || typeof payload !== 'object') {
    return Response.json({ error: 'Invalid model or payload' }, { status: 400 });
  }

  const upstreamUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;

  try {
    const upstreamRes = await fetch(upstreamUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const text = await upstreamRes.text();
    return new Response(text, {
      status: upstreamRes.status,
      headers: {
        'Content-Type': upstreamRes.headers.get('content-type') || 'application/json',
      },
    });
  } catch {
    return Response.json({ error: 'Upstream Gemini request failed' }, { status: 502 });
  }
};
