// Vercel Serverless Function (Node runtime)
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });

  const apiKey = process.env.OPENAI_API_KEY; // ⚠️ doit s'appeler exactement OPENAI_API_KEY dans Vercel
  if (!apiKey) return res.status(500).json({ error: 'Missing OPENAI_API_KEY' });

  try {
    const {
      messages = [],
      model = 'gpt-4o-mini',
      temperature = 0.2
    } = (req.body ?? {}) as {
      messages?: Array<{ role: 'system'|'user'|'assistant'; content: string }>;
      model?: string;
      temperature?: number;
    };

    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({ model, temperature, messages })
    });

    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data?.error?.message || 'OpenAI error' });

    res.status(200).json({
      ok: true,
      provider: 'openai',
      model,
      content: data?.choices?.[0]?.message?.content ?? ''
    });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Server error' });
  }
}
