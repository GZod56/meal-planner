import {authorize,json,readJSON} from '../../server/security.mjs';
export default async (req) => {
  const denied=authorize(req);if(denied)return denied;
  if (req.method !== 'POST') return new Response('POST only', { status: 405 });
  const key = process.env.OPENAI_API_KEY;
  if (!key) return Response.json({ error: 'The ChatGPT kitchen assistant is not connected yet. Add an OpenAI API key in Netlify to finish setup.' }, { status: 503 });
  let body;
  try { body = await readJSON(req,100000); }
  catch { return Response.json({ error: 'Invalid request.' }, { status: 400 }); }
  const { system, messages } = body || {};
  if (typeof system !== 'string' || !Array.isArray(messages) || !messages.length ||
      system.length > 60000 || messages.length > 20 || !messages.every(m => m && ['user', 'assistant'].includes(m.role) && typeof m.content === 'string' && m.content.length <= 6000)) {
    return Response.json({ error: 'Invalid conversation.' }, { status: 400 });
  }
  try {
    const r = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + key },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-5-mini',
        instructions: system,
        input: messages,
        max_output_tokens: 2400,
        reasoning: { effort: 'low' },
        store: false
      }),
      signal: AbortSignal.timeout(25000)
    });
    if (!r.ok) return Response.json({ error: r.status === 429
      ? 'ChatGPT is busy or the API usage limit has been reached. Please try again later.'
      : 'Could not reach ChatGPT. Please check the OpenAI connection and try again.' }, { status: 502 });
    const data = await r.json();
    const text = (data.output || []).filter(item => item.type === 'message')
      .flatMap(item => item.content || [])
      .filter(part => part.type === 'output_text' || part.type === 'refusal')
      .map(part => part.text || part.refusal || '').join('\n').trim();
    if (!text) return Response.json({ error: 'ChatGPT could not finish a reply. Please try a shorter question.' }, { status: 502 });
    return Response.json({ text });
  } catch {
    return Response.json({ error: 'ChatGPT took too long to respond or could not connect. Please try again.' }, { status: 502 });
  }
};
export const config = { path: '/.netlify/functions/chat',rateLimit:{windowLimit:10,windowSize:60,aggregateBy:['ip','domain']} };
