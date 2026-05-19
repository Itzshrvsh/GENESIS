import { type ReactNode } from 'react';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
  headers?: HeadersInit;
  query?: Record<string, string | number | boolean>;
  auth?: boolean;
}

/**
 * Build a query string from an object.
 */
function buildQuery(query?: Record<string, string | number | boolean>): string {
  if (!query) return '';
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    params.append(key, String(value));
  });
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

/**
 * Get the auth token from localStorage (if any).
 */
function getAuthToken(): string | null {
  return localStorage.getItem('authToken');
}

/**
 * Core request function.
 */
export async function request<T = unknown>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const {
    method = 'GET',
    body,
    headers = {},
    query,
    auth = true,
  } = options;

  const baseUrl = (import.meta.env.VITE_API_BASE_URL as string) || '';
  const url = `${baseUrl}${endpoint}${buildQuery(query)}`;

  const init: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    credentials: 'include',
  };

  if (auth) {
    const token = getAuthToken();
    if (token) {
      (init.headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
    }
  }

  if (body !== undefined && method !== 'GET') {
    init.body = JSON.stringify(body);
  }

  const response = await fetch(url, init);

  const contentType = response.headers.get('content-type');
  const isJson = contentType?.includes('application/json');

  const data = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const error = new Error(
      (data && typeof data === 'object' && 'message' in data
        ? (data as any).message
        : response.statusText) as string
    ) as any;
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data as T;
}

/**
 * Helper shortcuts for common verbs.
 */
export const api = {
  get: <T>(endpoint: string, opts?: Omit<RequestOptions, 'method'>) =>
    request<T>(endpoint, { ...opts, method: 'GET' }),
  post: <T>(endpoint: string, body?: unknown, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(endpoint, { ...opts, method: 'POST', body }),
  put: <T>(endpoint: string, body?: unknown, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(endpoint, { ...opts, method: 'PUT', body }),
  del: <T>(endpoint: string, opts?: Omit<RequestOptions, 'method'>) =>
    request<T>(endpoint, { ...opts, method: 'DELETE' }),
};