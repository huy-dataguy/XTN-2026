import { z } from "zod";
function resolveApiBase() {
  const envBase = import.meta.env.VITE_API_BASE_URL;
  if (envBase) return envBase.replace(/\/$/, "");
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    const override =
      params.get("api") ||
      window.localStorage.getItem("xtn_api_base_url");
    if (override) return override.replace(/\/$/, "");
    if (window.location.hostname.endsWith(".vercel.app")) {
      return "https://datalab.tailcba9a1.ts.net/api/v1";
    }
  }
  return "/api/v1";
}
const base = resolveApiBase();
const tokenKey = "xtn_session";
export const session = {
  get: () => sessionStorage.getItem(tokenKey),
  set: (value: string) => sessionStorage.setItem(tokenKey, value),
  clear: () => sessionStorage.removeItem(tokenKey),
};
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
const retryKeys = new Map<string, string>();
export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const fingerprint = JSON.stringify([method, path, body]);
  let key = retryKeys.get(fingerprint);
  if (method !== "GET" && !key) {
    key = crypto.randomUUID();
    retryKeys.set(fingerprint, key);
  }
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(session.get() ? { Authorization: `Bearer ${session.get()}` } : {}),
      ...(key ? { "Idempotency-Key": key } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data: unknown = await response.json();
  if (!response.ok) {
    if (
      response.status >= 400 &&
      response.status < 500 &&
      response.status !== 429
    )
      retryKeys.delete(fingerprint);
    const error = z
      .object({ code: z.string().optional(), message: z.string().optional() })
      .safeParse(data);
    if (response.status === 401 && path !== "/auth/login")
      window.dispatchEvent(new Event("xtn:session-expired"));
    throw new ApiError(
      response.status,
      error.success ? error.data.code || "ERROR" : "ERROR",
      error.success
        ? error.data.message || "Yêu cầu thất bại"
        : "Yêu cầu thất bại",
    );
  }
  retryKeys.delete(fingerprint);
  return data as T;
}
