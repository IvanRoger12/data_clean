export const API_BASE = import.meta.env.VITE_API_BASE_URL as string;

function withQuery(path: string, q?: Record<string, any>) {
  if (!q) return path;
  const usp = new URLSearchParams();
  Object.entries(q).forEach(([k, v]) => {
    if (v !== undefined && v !== null) usp.append(k, String(v));
  });
  return usp.toString() ? `${path}?${usp.toString()}` : path;
}

export async function getJSON<T=any>(path: string, q?: Record<string, any>): Promise<T> {
  const res = await fetch(`${API_BASE}${withQuery(path, q)}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function postJSON<T=any>(path: string, body: any): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function postForm<T=any>(path: string, form: FormData, q?: Record<string, any>): Promise<T> {
  const res = await fetch(`${API_BASE}${withQuery(path, q)}`, { method: "POST", body: form });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
