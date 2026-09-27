export const API_BASE_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000/v1').replace(/\/$/, '');

type ApiErrorBody = { error?: { code?: string; message?: string } };

export class ApiError extends Error {
  constructor(public readonly code: string, message: string, public readonly status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  } catch {
    throw new ApiError('NETWORK_ERROR', 'NETWORK_ERROR', 0);
  }

  const body = await response.json().catch(() => ({})) as ApiErrorBody & { data?: T };
  if (!response.ok) {
    throw new ApiError(
      body.error?.code ?? 'REQUEST_FAILED',
      body.error?.message ?? 'REQUEST_FAILED',
      response.status,
    );
  }
  return body.data as T;
}
