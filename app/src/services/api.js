/**
 * Base API Client — Bridges frontend state with Django REST APIs.
 * Supports timeout, retry, query builder, JWT authentication, idempotency keys,
 * structured ApiError, safe JSON parsing, and unauthorized session handling.
 */

const API_BASE_URL = (import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/+$/, '');
const DEFAULT_TIMEOUT_MS = Number(import.meta.env.VITE_API_TIMEOUT_MS) || 15000;

export class ApiError extends Error {
  constructor(message, { status = 0, endpoint = '', payload = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.endpoint = endpoint;
    this.payload = payload;
  }
}

export function buildQuery(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    if (Array.isArray(value)) {
      value.forEach((v) => search.append(key, String(v)));
    } else {
      search.append(key, String(value));
    }
  });
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export function getAuthToken(storage = typeof localStorage !== 'undefined' ? localStorage : null) {
  try {
    return storage?.getItem('evenmore_auth_token') || storage?.getItem('auth_token') || '';
  } catch {
    return '';
  }
}

export function clearAuthTokens(storage = typeof localStorage !== 'undefined' ? localStorage : null) {
  try {
    storage?.removeItem('evenmore_auth_token');
    storage?.removeItem('auth_token');
    storage?.removeItem('evenmore_refresh_token');
    storage?.removeItem('evenmore_token_expires_at');
    storage?.removeItem('evenmore_saved_user');
  } catch {}
}

async function fetchWithTimeout(url, config, timeoutMs, externalSignal) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  if (externalSignal) {
    externalSignal.addEventListener('abort', () => controller.abort());
  }

  try {
    return await fetch(url, { ...config, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function parseBodySafe(response) {
  try {
    const text = await response.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return { message: text };
    }
  } catch {
    return null;
  }
}

function normalizeEndpoint(endpoint) {
  if (!endpoint) return '/';
  let ep = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  // Ensure trailing slash for DRF unless it has a query or extension
  if (!ep.endsWith('/') && !ep.includes('?') && !ep.includes('.')) {
    ep = `${ep}/`;
  }
  return ep;
}

export async function apiClient(
  endpoint,
  {
    data,
    method = 'GET',
    headers = {},
    timeoutMs = DEFAULT_TIMEOUT_MS,
    retries = 0,
    query = null,
    clearAuthOnUnauthorized = true,
    idempotencyKey = null,
    signal = null,
    ...customConfig
  } = {},
) {
  const token = getAuthToken();
  const normalizedEp = normalizeEndpoint(endpoint);
  const url = `${API_BASE_URL}${normalizedEp}${query ? buildQuery(query) : ''}`;

  const requestHeaders = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
    ...headers,
  };

  const config = {
    method,
    headers: requestHeaders,
    ...customConfig,
  };

  if (data !== undefined) {
    config.body = JSON.stringify(data);
  }

  let attempt = 0;
  for (;;) {
    try {
      const response = await fetchWithTimeout(url, config, timeoutMs, signal);
      if (response.status === 401 && clearAuthOnUnauthorized) {
        clearAuthTokens();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('evenmore:unauthorized'));
        }
      }

      const result = await parseBodySafe(response);
      if (response.ok) {
        return result;
      }

      let message =
        (result && (result.message || result.detail || result.error)) ||
        (result && typeof result === 'object' && Object.values(result)[0]?.[0]) ||
        `Request failed with status ${response.status}`;
      // Error pages (Django DEBUG 404/500, proxies) come back as HTML, not
      // JSON — never surface raw markup in the toast, just the status.
      if (typeof message === 'string' && /<\s*!?doctype|<\s*html/i.test(message)) {
        message = `Request failed with status ${response.status}`;
      }
      if (typeof message !== 'string') message = `Request failed with status ${response.status}`;
      if (message.length > 300) message = `${message.slice(0, 297)}…`;

      throw new ApiError(message, { status: response.status, endpoint: normalizedEp, payload: result });
    } catch (err) {
      const retryable =
        err?.name === 'AbortError' ||
        (err instanceof ApiError && (err.status >= 500 || err.status === 429)) ||
        err instanceof TypeError;

      if (retryable && attempt < retries) {
        attempt += 1;
        await new Promise((r) => setTimeout(r, 300 * attempt));
        continue;
      }
      if (err instanceof ApiError) throw err;
      throw new ApiError(err?.message || 'Network error occurred', { endpoint: normalizedEp });
    }
  }
}

export const api = {
  get: (url, config) => apiClient(url, { ...config, method: 'GET' }),
  post: (url, data, config) => apiClient(url, { ...config, data, method: 'POST' }),
  put: (url, data, config) => apiClient(url, { ...config, data, method: 'PUT' }),
  patch: (url, data, config) => apiClient(url, { ...config, data, method: 'PATCH' }),
  delete: (url, config) => apiClient(url, { ...config, method: 'DELETE' }),
};

export default api;
