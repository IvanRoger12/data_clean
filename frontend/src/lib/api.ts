import { AnalyzeResponse, AutoFixResponse, FuzzyPair } from './types'
import { saveApiBase, loadApiBase } from './storage'

const ENV_BASE = import.meta.env.VITE_API_BASE_URL as string | undefined
let BASE = (ENV_BASE && ENV_BASE.trim()) || loadApiBase() || ''

export function setApiBase(b: string) {
  BASE = b.replace(/\/$/, '')
  saveApiBase(BASE)
}

export function getApiBase() {
  return BASE
}

// --- Fetch with timeout + retries + simple circuit breaker ---
let failCount = 0
let breakerUntil = 0

async function apiFetch(path: string, init: RequestInit, opts?: { timeout?: number; retries?: number }): Promise<Response> {
  const now = Date.now()
  if (now < breakerUntil) throw new Error('Backend temporarily unavailable')

  const timeout = opts?.timeout ?? 20000
  const retries = opts?.retries ?? 2

  let lastErr: any
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const ac = new AbortController()
      const id = setTimeout(() => ac.abort(), timeout)
      const res = await fetch(`${BASE}${path}`, {
        credentials: 'omit',
        ...init,
        signal: ac.signal,
        headers: { accept: 'application/json', ...(init.headers || {}) }
      })
      clearTimeout(id)
      if (!res.ok) {
        if (res.status >= 500 && attempt < retries) {
          await new Promise(r => setTimeout(r, 500 * (attempt + 1)))
          continue
        }
      }
      // success path
      failCount = 0
      return res
    } catch (e) {
      lastErr = e
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 500 * (attempt + 1)))
        continue
      }
    }
  }
  failCount++
  if (failCount >= 3) breakerUntil = Date.now() + 30_000
  throw lastErr ?? new Error('Network error')
}

// --- Endpoints ---
export async function llmTest() {
  const r = await apiFetch('/api/llm/test', { method: 'GET' })
  return r.json()
}

export async function analyze(file: File): Promise<AnalyzeResponse> {
  const fd = new FormData()
  fd.append('file', file)
  const r = await apiFetch('/api/analyze', { method: 'POST', body: fd })
  return r.json()
}

export async function getInsights(profile: any, kpi: any, prompt?: string): Promise<string[]> {
  const r = await apiFetch('/api/insights', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ profile, kpi, prompt })
  })
  const j = await r.json()
  return j.insights ?? []
}

export async function autoFix(file: File, region?: string): Promise<AutoFixResponse> {
  const fd = new FormData()
  fd.append('file', file)
  if (region) fd.append('region', region)
  const r = await apiFetch('/api/tools/auto_fix', { method: 'POST', body: fd }, { timeout: 30000 })
  return r.json()
}

export async function fuzzy(rows: Record<string, any>[], keys: string[], threshold = 90): Promise<FuzzyPair[]> {
  const r = await apiFetch('/api/tools/fuzzy', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ rows, keys, threshold })
  })
  const j = await r.json()
  return j.pairs ?? []
}

export async function scheduleICS(rule: string): Promise<string> {
  const r = await apiFetch('/api/schedule/ics', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ rule })
  })
  const j = await r.json()
  return j.ics
}

export async function getJobs() {
  const r = await apiFetch('/api/jobs', { method: 'GET' })
  return r.json()
}
