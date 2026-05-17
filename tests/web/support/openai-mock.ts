import type { Page } from '@playwright/test';

/**
 * Intercept the OpenAI chat-completions endpoint and return a fixed
 * translation — keeps the web tests deterministic and free of API spend.
 */
export async function mockTranslation(page: Page, translation: string) {
  await page.route('**/api.openai.com/v1/chat/completions', async route => {
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
            message: { role: 'assistant', content: translation },
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
