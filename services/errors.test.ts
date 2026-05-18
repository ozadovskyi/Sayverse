import { APIConnectionError, APIConnectionTimeoutError, APIError } from 'openai';
import { describe, expect, it } from 'vitest';

import { AppError, AppErrorType, classifyError, userMessage } from './errors';

function apiError(status: number): APIError {
  return new APIError(status, undefined, `HTTP ${status}`, undefined);
}

describe('classifyError', () => {
  it('passes an AppError through unchanged', () => {
    const original = new AppError(AppErrorType.Network, 'offline');
    expect(classifyError(original)).toBe(original);
  });

  it('maps OpenAI API status codes', () => {
    expect(classifyError(apiError(401)).type).toBe(AppErrorType.Auth);
    expect(classifyError(apiError(403)).type).toBe(AppErrorType.Auth);
    expect(classifyError(apiError(429)).type).toBe(AppErrorType.RateLimit);
    expect(classifyError(apiError(500)).type).toBe(AppErrorType.ServerError);
    expect(classifyError(apiError(503)).type).toBe(AppErrorType.ServerError);
  });

  it('classifies fetch failures as network errors', () => {
    expect(classifyError(new TypeError('Failed to fetch')).type).toBe(
      AppErrorType.Network,
    );
  });

  it('classifies SDK connection failures by subclass, not message text', () => {
    // The SDK timeout message is "timed out" — a regex on "timeout" misses it.
    expect(classifyError(new APIConnectionTimeoutError({})).type).toBe(
      AppErrorType.Timeout,
    );
    expect(classifyError(new APIConnectionError({ message: 'connection error' })).type).toBe(
      AppErrorType.Network,
    );
  });

  it('classifies timeouts', () => {
    expect(classifyError(new Error('Request timeout')).type).toBe(
      AppErrorType.Timeout,
    );
  });

  it('falls back to Unknown for unrecognized errors', () => {
    expect(classifyError(new Error('something odd')).type).toBe(
      AppErrorType.Unknown,
    );
    expect(classifyError('a bare string').type).toBe(AppErrorType.Unknown);
  });
});

describe('AppError.retryable', () => {
  it('marks transient failures retryable', () => {
    expect(new AppError(AppErrorType.Network, '').retryable).toBe(true);
    expect(new AppError(AppErrorType.Timeout, '').retryable).toBe(true);
    expect(new AppError(AppErrorType.ServerError, '').retryable).toBe(true);
  });

  it('marks permanent failures non-retryable', () => {
    expect(new AppError(AppErrorType.Auth, '').retryable).toBe(false);
    expect(new AppError(AppErrorType.RateLimit, '').retryable).toBe(false);
    expect(new AppError(AppErrorType.Unknown, '').retryable).toBe(false);
  });
});

describe('userMessage', () => {
  it('returns the error message', () => {
    expect(userMessage(new AppError(AppErrorType.Auth, 'Invalid key'))).toBe(
      'Invalid key',
    );
  });
});
