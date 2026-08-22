/**
 * Thin fetch wrapper.
 *
 * In production the API serves this bundle, so `/api/...` is same-origin and
 * the session cookie needs no CORS dance. `next dev` runs on its own port, so
 * development points at the API explicitly.
 */

const BASE =
  process.env.NEXT_PUBLIC_API_BASE ??
  (process.env.NODE_ENV === "production" ? "" : "http://localhost:8000");

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    method,
    credentials: "include",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    let detail = `Request failed (${response.status})`;
    try {
      const payload = await response.json();
      // FastAPI uses `detail`; validation errors make it a list of objects.
      if (typeof payload?.detail === "string") detail = payload.detail;
      else if (Array.isArray(payload?.detail)) detail = payload.detail[0]?.msg ?? detail;
    } catch {
      // Non-JSON error body — keep the generic message.
    }
    throw new ApiError(response.status, detail);
  }

  // 204 has no body to parse.
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body),
  delete: <T>(path: string) => request<T>("DELETE", path),
};
