import OpenAI from 'openai';
import { classifyError } from './errors';
import { E2E_TRANSCRIPTION, E2E_TRANSLATION, IS_E2E } from './e2e';

let client: OpenAI | null = null;
let storedApiKey: string = '';

export function initOpenAI(apiKey: string): void {
  storedApiKey = apiKey;
  client = new OpenAI({
    apiKey,
    timeout: 15_000,
    // The SDK blocks browser use by default so apps don't ship one shared
    // secret to many clients. OpenTranslator is BYOK — the key is the user's
    // own, entered on and confined to their own device — so that risk does
    // not apply, and the web build needs this to run at all.
    dangerouslyAllowBrowser: true,
  });
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

export interface Transcription {
  /** The transcribed text. */
  text: string;
  /**
   * The source language Whisper detected. May be a full English name
   * ("english") or an ISO code ("en") — normalize via `findByCode`.
   */
  language: string;
}

/**
 * Transcribe audio using the Whisper API.
 *
 * Accepts a file URI (from an expo-audio recording). Uses `verbose_json` so
 * the detected source language is returned alongside the text — this unblocks
 * conversation-mode language auto-detection.
 *
 * `language` is an optional ISO-639-1 hint. When the source language is
 * already known (single-shot mode picks it explicitly), passing it stops
 * Whisper from auto-detecting — auto-detection is unreliable on short or
 * noisy clips and can mis-transcribe speech into the wrong script entirely.
 * Conversation mode is bilingual, so it omits the hint and relies on
 * detection for routing.
 */
export async function transcribeAudio(
  fileUri: string,
  language?: string,
): Promise<Transcription> {
  // E2E: return a canned transcript instead of calling Whisper.
  if (IS_E2E) return E2E_TRANSCRIPTION;

  if (!storedApiKey) throw new Error('OpenAI not initialized. Set API key first.');

  return withRetry(async () => {
    const formData = new FormData();
    formData.append('file', {
      uri: fileUri,
      name: 'recording.m4a',
      type: 'audio/m4a',
    } as any);
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'verbose_json');
    if (language) formData.append('language', language);

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
    return {
      text: ((data.text as string) ?? '').trim(),
      language: (data.language as string) ?? '',
    };
  });
}

/**
 * Translate text from one language to another using GPT-4o-mini.
 */
export async function translateText(
  text: string,
  sourceLang: string,
  targetLang: string,
): Promise<string> {
  // E2E: return a canned translation instead of calling GPT.
  if (IS_E2E) return E2E_TRANSLATION;

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
