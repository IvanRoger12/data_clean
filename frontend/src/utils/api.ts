const BASE =
  (typeof window !== "undefined" && (window as any).__API_BASE__) ||
  import.meta.env.VITE_API_BASE_URL ||
  "https://ivan7889-dataclean-agent-back.hf.space";

type Method = "GET" | "POST";
async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function request<T>(
  path: string,
  opts: { method?: Method; body?: any; form?: FormData; timeoutMs?: number; retries?: number } = {}
): Promise<T> {
  const url = `${BASE}${path}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 20000);
  const retries = Math.max(0, opts.retries ?? 2);
  try {
    const res = await fetch(url, {
      method: opts.method || (opts.form ? "POST" : "GET"),
      body: opts.form ? opts.form : opts.body ? JSON.stringify(opts.body) : undefined,
      headers: opts.form ? undefined : { "Content-Type": "application/json" },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      if (retries > 0 && (res.status >= 500 || res.status === 429)) {
        await sleep(600 * (3 - retries));
        return request<T>(path, { ...opts, retries: retries - 1 });
      }
      throw new Error(`HTTP ${res.status} – ${txt || "Request failed"}`);
    }
    return res.json() as Promise<T>;
  } catch (e: any) {
    clearTimeout(timeout);
    if (retries > 0) {
      await sleep(600 * (3 - retries));
      return request<T>(path, { ...opts, retries: retries - 1 });
    }
    throw new Error(e?.message || "Network error");
  }
}

export const api = {
  health: () => request<{ ok: boolean }>("/api/health"),
  analyze: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return request<any>("/api/analyze", { form: fd, timeoutMs: 30000 });
  },
  autoFix: (file: File, region?: string) => {
    const fd = new FormData();
    fd.append("file", file);
    if (region) fd.append("region", region);
    return request<any>("/api/tools/auto_fix", { form: fd, timeoutMs: 30000 });
  },
  insights: (profile: any, kpi: any, prompt?: string) =>
    request<{ insights: string[] }>("/api/insights", {
      method: "POST",
      body: { profile, kpi, prompt },
    }),
  fuzzy: (rows: any[], keys: string[], threshold = 90) =>
    request<{ pairs: { i: number; j: number; score: number }[] }>("/api/tools/fuzzy", {
      method: "POST",
      body: { rows, keys, threshold },
      timeoutMs: 30000
    }),
  jobs: () => request<{ jobs: any[] }>("/api/jobs"),
  ics: (rule: string) => request<{ ics: string }>("/api/schedule/ics", { method: "POST", body: { rule } }),
};
