import OpenAI from 'openai';
import { classifyError } from './errors';
import {
  E2E_DETECTED_LANGUAGE,
  E2E_TRANSCRIPTION,
  E2E_TRANSLATION,
  IS_E2E,
} from './e2e';
import { isSilentTranscription, type WhisperSegment } from './transcription';

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
 * the detected source language is returned alongside the text — both
 * conversation and single-shot mode rely on it to auto-route the translation.
 */
export async function transcribeAudio(fileUri: string): Promise<Transcription> {
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
    const segments = (data.segments ?? []) as WhisperSegment[];
    return {
      // Whisper hallucinates words ("you", "Thank you") on silent audio.
      // When the clip reads as silence, return an empty transcript so the
      // caller surfaces "no speech detected" instead of translating garbage.
      text: isSilentTranscription(segments)
        ? ''
        : ((data.text as string) ?? '').trim(),
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

/**
 * Detect the language of a piece of text — a small constrained GPT-4o-mini
 * call returning a lowercase ISO 639-1 code (`en`, `es`, `ru`, …).
 *
 * Used to auto-route single-shot typed-text translation. The voice path does
 * not need this — Whisper returns the detected language directly.
 */
export async function detectLanguage(text: string): Promise<string> {
  // E2E: return a canned code instead of calling GPT.
  if (IS_E2E) return E2E_DETECTED_LANGUAGE;

  if (!client) throw new Error('OpenAI not initialized. Set API key first.');

  const completion = await withRetry(() =>
    client!.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'Identify the language of the user message. Respond with ONLY ' +
            'its ISO 639-1 code in lowercase (e.g. "en", "es", "ru", "uk"). ' +
            'No other text.',
        },
        { role: 'user', content: text },
      ],
      temperature: 0,
      max_tokens: 5,
    }),
  );

  return (completion.choices[0]?.message?.content ?? '').trim().toLowerCase();
}
