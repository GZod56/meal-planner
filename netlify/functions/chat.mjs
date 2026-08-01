export default async (req) => {
  if (req.method !== 'POST') return new Response('POST only', { status: 405 });
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return Response.json({ error: 'ANTHROPIC_API_KEY not set in Netlify env vars.' }, { status: 500 });
  try {
    const { system, messages } = await req.json();
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 1200, system, messages })
    });
    const data = await r.json();
    if (!r.ok) return Response.json({ error: data?.error?.message || 'API error' }, { status: 502 });
    const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
    return Response.json({ text });
  } catch (e) {
    return Response.json({ error: 'Bad request' }, { status: 400 });
  }
};
export const config = { path: '/.netlify/functions/chat' };
