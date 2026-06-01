import OpenAI from 'openai';
import { fetch as expoFetch } from 'expo/fetch';
import { AppError, AppErrorType, classifyError } from './errors';
import {
  E2E_DETECTED_LANGUAGE,
  E2E_TRANSCRIPTION,
  E2E_TRANSLATION,
  IS_E2E,
} from './e2e';
import {
  isNonSpeechTranscription,
  meanSpeechLogprob,
  type WhisperSegment,
} from './transcription';

let client: OpenAI | null = null;
let storedApiKey: string = '';

export function initOpenAI(apiKey: string): void {
  storedApiKey = apiKey;
  client = new OpenAI({
    apiKey,
    timeout: 15_000,
    // The SDK blocks browser use by default so apps don't ship one shared
    // secret to many clients. Sayverse is BYOK — the key is the user's
    // own, entered on and confined to their own device — so that risk does
    // not apply, and the web build needs this to run at all.
    dangerouslyAllowBrowser: true,
    // React Native's stock `fetch()` does not expose `response.body` as a
    // ReadableStream, which makes the SDK's `stream: true` path bail with
    // "default react-native fetch does not support streaming". `expo/fetch`
    // is Expo's drop-in replacement that delegates to the native HTTP
    // layer and DOES surface `body` as a proper ReadableStream — the
    // single-line fix the Expo docs explicitly recommend. The cast is
    // because expo/fetch's `Request`/`RequestInit` types are nominally
    // distinct from the lib.dom ones the SDK declares; the runtime
    // shapes are identical (FetchResponse `implements Response`).
    fetch: expoFetch as unknown as typeof fetch,
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
  /**
   * Mean Whisper-segment `avg_logprob` across non-silence segments — the
   * model's own per-token log-confidence averaged over the clip. Closer to
   * `0` means a confident transcription, well below `-1` indicates the
   * model is hallucinating. Used by bilingual conversation mode to compare
   * two parallel hinted calls and pick the one Whisper actually believes.
   *
   * Returns `-Infinity` when the clip has no usable segments (silent / all
   * non-speech) so any real-speech result is selected over it in a
   * confidence comparison.
   */
  avgLogprob: number;
}

/**
 * Short neutral sentences per source language, used as Whisper's `prompt`
 * parameter when the caller passes a language hint.
 *
 * The decoder uses the prompt's style — punctuation, casing, script — to
 * bias the output. A prompt in the source language suppresses the
 * silence-hallucinations Whisper otherwise emits in English ("Thank you for
 * watching.", "Subtitles by..."). Kept short and neutral on purpose:
 * domain-irrelevant content in the prompt hurts accuracy, so this is a
 * style seed only, not a vocabulary hint.
 */
const STYLE_PROMPTS: Record<string, string> = {
  en: 'Hello, this is a conversation.',
  es: 'Hola, esta es una conversación.',
  ru: 'Привет, это разговор.',
  uk: 'Привіт, це розмова.',
  fr: 'Bonjour, ceci est une conversation.',
  de: 'Hallo, dies ist ein Gespräch.',
  it: 'Ciao, questa è una conversazione.',
  pt: 'Olá, isto é uma conversa.',
  zh: '你好，这是一段对话。',
  ja: 'こんにちは、これは会話です。',
  ko: '안녕하세요, 이것은 대화입니다.',
  ar: 'مرحباً، هذه محادثة.',
  hi: 'नमस्ते, यह एक बातचीत है।',
  tr: 'Merhaba, bu bir konuşmadır.',
  pl: 'Cześć, to jest rozmowa.',
};

/**
 * Transcribe audio using the Whisper API.
 *
 * Accepts a file URI (from an expo-audio recording). Uses `verbose_json` so
 * the detected source language is returned alongside the text — both
 * conversation and single-shot mode rely on it to auto-route the translation.
 *
 * `languageHint` (ISO-639-1 lowercase, e.g. `'es'`) is passed when the caller
 * knows the expected source language — single-shot mode does, the picker
 * commits to one source. It removes Whisper's auto-detection step, which on
 * short or quiet clips biases toward English (the dominant training language)
 * and produces cross-language hallucinations like a Spanish utterance
 * transcribed as `"Hello, how are you?"`. Conversation mode is bilingual and
 * intentionally omits the hint so auto-detection still routes the turn.
 */
export async function transcribeAudio(
  fileUri: string,
  languageHint?: string,
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
    // Explicit `0` documents intent — the Whisper API's default is already 0,
    // but it uses a temperature-fallback ladder (up to 1.0) when its internal
    // compression-ratio or logprob thresholds trip, and the higher rungs are
    // what spawn repetition loops. Pinning the initial pass keeps it
    // deterministic and self-documenting.
    formData.append('temperature', '0');
    if (languageHint) {
      formData.append('language', languageHint);
      const stylePrompt = STYLE_PROMPTS[languageHint];
      if (stylePrompt) formData.append('prompt', stylePrompt);
    }

    // The SDK client carries a 15s timeout; this raw fetch (used because of
    // React Native FormData upload quirks) must abort itself to match, or a
    // stalled upload would hang forever.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    let res: Response;
    try {
      res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${storedApiKey}` },
        body: formData,
        signal: controller.signal,
      });
    } catch (e) {
      // An abort is our own 15s timeout. Anything else, let `classifyError`
      // decide — a genuine fetch failure becomes Network, an unexpected throw
      // becomes Unknown — so `withRetry` retries the retryable ones only and
      // the real error is never masked as "no connection".
      if (controller.signal.aborted) {
        throw new AppError(AppErrorType.Timeout, 'Request timed out. Please try again.');
      }
      throw classifyError(e);
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      // Classify by status so `withRetry` retries 5xx (as it does for the GPT
      // calls) but not auth / rate-limit failures.
      if (res.status === 401 || res.status === 403) {
        throw new AppError(AppErrorType.Auth, 'Invalid or expired API key.');
      }
      if (res.status === 429) {
        throw new AppError(AppErrorType.RateLimit, 'Rate limit reached. Please wait a moment.');
      }
      if (res.status >= 500) {
        throw new AppError(AppErrorType.ServerError, 'OpenAI server error. Please try again.');
      }
      throw new AppError(
        AppErrorType.Unknown,
        err?.error?.message ?? `Whisper API error: ${res.status}`,
      );
    }

    const data = await res.json();
    const segments = (data.segments ?? []) as WhisperSegment[];
    const rawText = ((data.text as string) ?? '').trim();
    return {
      // Whisper hallucinates on non-speech audio — words ("you", "Thank you")
      // on silence, note glyphs ("♪ ♪") on music. When the clip reads as
      // non-speech, return an empty transcript so the caller surfaces "no
      // speech detected" instead of translating garbage.
      text: isNonSpeechTranscription(rawText, segments) ? '' : rawText,
      language: (data.language as string) ?? '',
      avgLogprob: meanSpeechLogprob(segments),
    };
  });
}

/**
 * Translate text from one language to another using GPT-4o-mini.
 *
 * Non-streaming variant — kept for callers that don't need progressive
 * rendering (the LLM-eval suite and any place where the partial-render flicker
 * is not worth the perceived-latency win).
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
 * Streaming translation. The same prompt + model as {@link translateText}, but
 * the SDK is asked for `stream: true` and each token's delta is folded into
 * an accumulator that is published to `onProgress`. Callers use this for the
 * in-flight result rendering — the perceived latency is dominated by the
 * first-token gap (typically 0.3-0.8 s for gpt-4o-mini) rather than the full
 * generation time, so even a long translation feels responsive.
 *
 * Returns the final trimmed text, identical to {@link translateText}'s output,
 * so `onProgress` is purely additive — callers can ignore it and treat this
 * like the non-streaming variant.
 */
export async function translateTextStreaming(
  text: string,
  sourceLang: string,
  targetLang: string,
  onProgress: (accumulated: string) => void,
): Promise<string> {
  // E2E: emit the canned translation as a single chunk so the live-render
  // path is exercised but the eval fixture is byte-stable.
  if (IS_E2E) {
    onProgress(E2E_TRANSLATION);
    return E2E_TRANSLATION;
  }

  if (!client) throw new Error('OpenAI not initialized. Set API key first.');

  return withRetry(async () => {
    const stream = await client!.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a translator. Translate the following text from ${sourceLang} to ${targetLang}. Return ONLY the translation, nothing else.`,
        },
        { role: 'user', content: text },
      ],
      temperature: 0.3,
      max_tokens: 1024,
      stream: true,
    });

    let accumulated = '';
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content ?? '';
      if (delta) {
        accumulated += delta;
        onProgress(accumulated);
      }
    }
    // Match the non-streaming variant's trim. Emit one final progress callback
    // only if trimming actually changed the text, so the UI settles on the
    // exact same string both modes return.
    const trimmed = accumulated.trim();
    if (trimmed !== accumulated) onProgress(trimmed);
    return trimmed;
  });
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
