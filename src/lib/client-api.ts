/** Browser-side fetch wrapper: JSON in, JSON out, and the API's error message surfaced as an ApiError. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type Options = Omit<RequestInit, 'body'> & { json?: unknown; body?: BodyInit };

export async function api<T>(path: string, { json, headers, ...init }: Options = {}): Promise<T> {
  const requestHeaders = new Headers(headers);
  let body = init.body;
  if (json !== undefined) {
    requestHeaders.set('content-type', 'application/json');
    body = JSON.stringify(json);
  }

  let response: Response;
  try {
    response = await fetch(path, { ...init, headers: requestHeaders, body });
  } catch {
    throw new ApiError(0, 'network_error', 'You seem to be offline. Check your connection and try again.');
  }
  if (response.status === 204) return undefined as T;

  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = (data as { error?: { code?: string; message?: string; details?: unknown } } | null)?.error;
    throw new ApiError(
      response.status,
      error?.code ?? 'unknown_error',
      error?.message ?? `Request failed (${response.status}).`,
      error?.details,
    );
  }
  return data as T;
}

export const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Something went wrong. Please try again.';
