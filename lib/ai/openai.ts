// Shared OpenAI JSON-mode caller used by all /api/creative/* routes.
// Keeps provider/model/timeout/error-handling consistent (MASTER_PROMPT_V2
// "Security"/error-handling requirements: timeout + readable error on every AI call).

export class AIProviderError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.status = status;
  }
}

export async function callOpenAIJSON(opts: {
  system: string;
  user: string;
  timeoutMs?: number;
  temperature?: number;
  model?: string;
}): Promise<{ text: string; model: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new AIProviderError('OPENAI_API_KEY is not configured in .env.local', 500);
  }
  const model = opts.model || process.env.AI_MODEL || 'gpt-4o-mini';

  let res: Response;
  try {
    res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        temperature: opts.temperature ?? 0.7,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: opts.system },
          { role: 'user', content: opts.user }
        ]
      }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 45000)
    });
  } catch (err: any) {
    if (err?.name === 'TimeoutError') {
      throw new AIProviderError(`AI provider timed out after ${(opts.timeoutMs ?? 45000) / 1000}s`, 504);
    }
    throw new AIProviderError(err?.message || 'Unknown error calling AI provider', 502);
  }

  if (!res.ok) {
    const errText = await res.text();
    throw new AIProviderError(`AI provider error (${res.status}): ${errText.slice(0, 400)}`, 502);
  }

  const json = await res.json();
  const text = json.choices?.[0]?.message?.content;
  if (!text) {
    throw new AIProviderError('AI provider returned no content', 502);
  }

  return { text, model };
}
