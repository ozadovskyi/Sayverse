import { APIError } from 'openai';

export enum AppErrorType {
  Network = 'Network',
  Timeout = 'Timeout',
  Auth = 'Auth',
  RateLimit = 'RateLimit',
  ServerError = 'ServerError',
  /** No recording captured, or it was silent — not retryable as-is. */
  NoSpeech = 'NoSpeech',
  Unknown = 'Unknown',
}

const RETRYABLE: Set<AppErrorType> = new Set([
  AppErrorType.Network,
  AppErrorType.Timeout,
  AppErrorType.ServerError,
]);

export class AppError extends Error {
  readonly type: AppErrorType;

  constructor(type: AppErrorType, message: string) {
    super(message);
    this.type = type;
  }

  get retryable(): boolean {
    return RETRYABLE.has(this.type);
  }
}

export function classifyError(error: unknown): AppError {
  if (error instanceof AppError) return error;

  const msg = error instanceof Error ? error.message : String(error);

  // OpenAI SDK errors
  if (error instanceof APIError) {
    const status = error.status;
    if (status === 401 || status === 403) {
      return new AppError(AppErrorType.Auth, 'Invalid or expired API key.');
    }
    if (status === 429) {
      return new AppError(AppErrorType.RateLimit, 'Rate limit reached. Please wait a moment.');
    }
    if (status && status >= 500) {
      return new AppError(AppErrorType.ServerError, 'OpenAI server error. Please try again.');
    }
  }

  // Network / fetch failures
  if (error instanceof TypeError && /fetch|network/i.test(msg)) {
    return new AppError(AppErrorType.Network, 'No internet connection. Check your network and try again.');
  }

  // Timeout
  if (/timeout/i.test(msg)) {
    return new AppError(AppErrorType.Timeout, 'Request timed out. Please try again.');
  }

  return new AppError(AppErrorType.Unknown, msg || 'Something went wrong.');
}

export function userMessage(error: AppError): string {
  return error.message;
}
