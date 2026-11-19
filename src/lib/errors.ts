export type ErrorCode =
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'validation_error'
  | 'payload_too_large'
  | 'unsupported_media_type'
  | 'internal_error';

/** An error that is safe to show to the user, with the HTTP status the API should return. */
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const unauthorized = (message = 'Please sign in to continue.') => new AppError(401, 'unauthorized', message);
export const forbidden = (message: string) => new AppError(403, 'forbidden', message);
export const notFound = (message = 'This document does not exist or you no longer have access to it.') =>
  new AppError(404, 'not_found', message);
export const conflict = (message: string, details?: unknown) => new AppError(409, 'conflict', message, details);
export const validationError = (message: string, details?: unknown) =>
  new AppError(422, 'validation_error', message, details);
export const payloadTooLarge = (message: string) => new AppError(413, 'payload_too_large', message);
export const unsupportedMediaType = (message: string) => new AppError(415, 'unsupported_media_type', message);
