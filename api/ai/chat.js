// ── AI Chat Proxy ──
// Proxies AI requests through the server to keep API keys secure.
// Requires: AI_API_KEY env var (OpenAI key) and optional AI_ANTHROPIC_KEY.
// Protected by Firebase Auth — only authenticated users can use AI chat.

import { verifyAuth, corsHeaders } from '../gps/_mapon-client.js';

export default async function handler(req, res) {
    const headers = corsHeaders(req);
    Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    // ── Auth check ──
    const authResult = await verifyAuth(req);
    if (!authResult.ok) {
        return res.status(401).json({ error: 'Unauthorized', detail: authResult.error });
    }

    try {
        const { messages, provider = 'openai', systemPrompt } = req.body;

        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({ error: 'Missing messages array' });
        }

        // ── OpenAI ──
        if (provider === 'openai') {
            const apiKey = process.env.AI_API_KEY;
            if (!apiKey) {
                return res.status(500).json({ error: 'AI_API_KEY not configured on server' });
            }

            const openaiMessages = [];
            if (systemPrompt) openaiMessages.push({ role: 'system', content: systemPrompt });
            openaiMessages.push(...messages);

            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'gpt-4o-mini',
                    messages: openaiMessages,
                    max_tokens: 1024,
                    temperature: 0.3,
                }),
            });

            const data = await response.json();
            if (data.error) {
                return res.status(502).json({ error: data.error.message || 'OpenAI error' });
            }

            return res.status(200).json({
                content: data.choices[0].message.content,
                provider: 'openai',
            });
        }

        // ── Anthropic (Claude) ──
        if (provider === 'anthropic') {
            const apiKey = process.env.AI_ANTHROPIC_KEY || process.env.AI_API_KEY;
            if (!apiKey) {
                return res.status(500).json({ error: 'AI_ANTHROPIC_KEY not configured on server' });
            }

            const response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01',
                    'content-type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'claude-3-haiku-20240307',
                    max_tokens: 1024,
                    system: systemPrompt || '',
                    messages: messages.map(m => ({ role: m.role, content: m.content })),
                }),
            });

            const data = await response.json();
            if (data.error) {
                return res.status(502).json({ error: data.error.message || 'Anthropic error' });
            }

            return res.status(200).json({
                content: data.content[0].text,
                provider: 'anthropic',
            });
        }

        return res.status(400).json({ error: `Unknown provider: ${provider}` });

    } catch (err) {
        console.error('[AI Proxy] Error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
