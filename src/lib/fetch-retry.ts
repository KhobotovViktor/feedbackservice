// fetch() with a hard timeout and exponential-backoff retries for transient
// failures (network errors, 429, 5xx). Used for outbound calls to flaky/rate-
// limited third parties (Bitrix24, Telegram). Does NOT retry 4xx other than
// 429 — those are our bug, not a blip.

interface RetryOpts {
  retries?: number; // additional attempts after the first (default 2)
  baseDelayMs?: number; // backoff base; attempt N waits base * 2^N (default 400)
  timeoutMs?: number; // per-attempt timeout (default 10000)
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function fetchWithRetry(
  url: string,
  init: RequestInit = {},
  opts: RetryOpts = {}
): Promise<Response> {
  const { retries = 2, baseDelayMs = 400, timeoutMs = 10000 } = opts;
  let lastErr: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: ctrl.signal });
      clearTimeout(timer);
      // Retry only on rate-limit / server errors, and only if attempts remain.
      if ((res.status === 429 || res.status >= 500) && attempt < retries) {
        await sleep(baseDelayMs * 2 ** attempt);
        continue;
      }
      return res;
    } catch (e) {
      clearTimeout(timer);
      lastErr = e;
      if (attempt < retries) {
        await sleep(baseDelayMs * 2 ** attempt);
        continue;
      }
      throw e;
    }
  }
  // Unreachable in practice (loop either returns or throws), but satisfies TS.
  throw lastErr ?? new Error("fetchWithRetry: exhausted retries");
}
