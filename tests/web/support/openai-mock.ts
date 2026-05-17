import type { Page } from '@playwright/test';

/**
 * Intercept the OpenAI chat-completions endpoint — keeps the web tests
 * deterministic and free of API spend.
 *
 * The typed-text path makes two calls to this endpoint: a language-detection
 * call, then the translation call. They are told apart by the system prompt,
 * so the mock answers each correctly: `detectedLanguage` (an ISO code) for
 * detection, `translation` for the translation.
 */
export async function mockTranslation(
  page: Page,
  translation: string,
  detectedLanguage = 'es',
) {
  await page.route('**/api.openai.com/v1/chat/completions', async route => {
    const body = route.request().postDataJSON() as {
      messages?: { role: string; content: string }[];
    };
    const system = body.messages?.find(m => m.role === 'system')?.content ?? '';
    const isDetection = system.includes('Identify the language');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'chatcmpl-test',
        object: 'chat.completion',
        model: 'gpt-4o-mini',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: isDetection ? detectedLanguage : translation,
            },
            finish_reason: 'stop',
          },
        ],
      }),
    });
  });
}

/**
 * Make the OpenAI endpoint fail. Defaults to 401 (auth) — a non-retryable
 * status, so the failure surfaces immediately without retry backoff.
 */
export async function mockOpenAIError(page: Page, status = 401) {
  await page.route('**/api.openai.com/**', async route => {
    await route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify({ error: { message: 'Mocked API error' } }),
    });
  });
}
