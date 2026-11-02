// Browser-side fetch wrapper: attaches the access token and transparently refreshes it on 401.

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem("refreshToken");
  if (!refreshToken) return null;
  try {
    const res = await fetch("/api/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return null;
    const { data } = await res.json();
    localStorage.setItem("accessToken", data.accessToken);
    localStorage.setItem("refreshToken", data.refreshToken);
    return data.accessToken;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
}

export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const send = (token: string | null) => {
    const headers = new Headers(init.headers);
    if (token) headers.set("Authorization", `Bearer ${token}`);
    if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    return fetch(input, { ...init, headers });
  };

  const res = await send(localStorage.getItem("accessToken"));
  if (res.status !== 401) return res;

  // Refresh tokens are single-use, so concurrent 401s must share one refresh request
  refreshPromise ??= refreshAccessToken().finally(() => {
    refreshPromise = null;
  });
  const newToken = await refreshPromise;
  if (!newToken) {
    clearSession();
    window.location.href = "/auth/login";
    return res;
  }
  return send(newToken);
}
