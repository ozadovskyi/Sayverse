import OpenAI from 'openai';
import { classifyError } from './errors';

let client: OpenAI | null = null;
let storedApiKey: string = '';

export function initOpenAI(apiKey: string): void {
  storedApiKey = apiKey;
  client = new OpenAI({ apiKey, timeout: 15_000 });
}

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      const appError = classifyError(e);
      if (!appError.retryable || attempt === maxRetries) throw appError;
      await new Promise(r => setTimeout(r, Math.min(1000 * 2 ** attempt, 4000)));
    }
  }
  throw classifyError(lastError);
}

export function isInitialized(): boolean {
  return client !== null;
}

/**
 * Transcribe audio using Whisper API.
 * Accepts a file URI (from expo-av recording).
 */
export async function transcribeAudio(fileUri: string): Promise<string> {
  if (!storedApiKey) throw new Error('OpenAI not initialized. Set API key first.');

  const result = await withRetry(async () => {
    const formData = new FormData();
    formData.append('file', {
      uri: fileUri,
      name: 'recording.m4a',
      type: 'audio/m4a',
    } as any);
    formData.append('model', 'whisper-1');

    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${storedApiKey}` },
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message ?? `Whisper API error: ${res.status}`);
    }

    const data = await res.json();
    return data.text as string;
  });

  return result;
}

/**
 * Translate text from one language to another using GPT-4o-mini.
 */
export async function translateText(
  text: string,
  sourceLang: string,
  targetLang: string,
): Promise<string> {
  if (!client) throw new Error('OpenAI not initialized. Set API key first.');

  const completion = await withRetry(() =>
    client!.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a translator. Translate the following text from ${sourceLang} to ${targetLang}. Return ONLY the translation, nothing else.`,
        },
        {
          role: 'user',
          content: text,
        },
      ],
      temperature: 0.3,
      max_tokens: 1024,
    }),
  );

  return completion.choices[0]?.message?.content?.trim() ?? '';
}
