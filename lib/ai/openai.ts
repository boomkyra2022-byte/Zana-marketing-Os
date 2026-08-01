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

// Vision-capable JSON-mode call for Video Analyzer — sends the transcript plus
// N sampled frames (as base64 data URLs) in one request. MASTER_PROMPT_V2
// "Cost Control": batch vision where possible, transcript once.
export async function callOpenAIVisionJSON(opts: {
  system: string;
  user: string;
  images: string[]; // data URLs, e.g. `data:image/jpeg;base64,...`
  timeoutMs?: number;
  temperature?: number;
  model?: string;
}): Promise<{ text: string; model: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new AIProviderError('OPENAI_API_KEY is not configured in .env.local', 500);
  }
  const model = opts.model || process.env.AI_MODEL || 'gpt-4o-mini';

  const content: any[] = [{ type: 'text', text: opts.user }];
  for (const image of opts.images) {
    content.push({ type: 'image_url', image_url: { url: image } });
  }

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
        temperature: opts.temperature ?? 0.3,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: opts.system },
          { role: 'user', content }
        ]
      }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 180000)
    });
  } catch (err: any) {
    if (err?.name === 'TimeoutError') {
      throw new AIProviderError(`AI provider timed out after ${(opts.timeoutMs ?? 180000) / 1000}s`, 504);
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

// Audio transcription via OpenAI's /v1/audio/transcriptions endpoint.
// Default model per current OpenAI lineup: gpt-4o-mini-transcribe (whisper-1
// as a stable fallback if the account/model isn't available).
export async function transcribeAudio(opts: { fileBuffer: Buffer; filename: string; model?: string; timeoutMs?: number }): Promise<{ text: string; model: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new AIProviderError('OPENAI_API_KEY is not configured in .env.local', 500);
  }
  const model = opts.model || process.env.TRANSCRIPTION_MODEL || 'gpt-4o-mini-transcribe';

  const form = new FormData();
  form.append('file', new Blob([opts.fileBuffer]), opts.filename);
  form.append('model', model);

  let res: Response;
  try {
    res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal: AbortSignal.timeout(opts.timeoutMs ?? 120000)
    });
  } catch (err: any) {
    if (err?.name === 'TimeoutError') {
      throw new AIProviderError(`Transcription timed out after ${(opts.timeoutMs ?? 120000) / 1000}s`, 504);
    }
    throw new AIProviderError(err?.message || 'Unknown error calling transcription provider', 502);
  }

  if (!res.ok) {
    const errText = await res.text();
    throw new AIProviderError(`Transcription error (${res.status}): ${errText.slice(0, 400)}`, 502);
  }

  const json = await res.json();
  const text = json.text;
  if (typeof text !== 'string') {
    throw new AIProviderError('Transcription provider returned no text', 502);
  }

  return { text, model };
}
