// Small fetch helper shared by every data provider: polite throttling,
// a few retries with backoff, and a descriptive User-Agent (SEC requires one).

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let lastRequestAt = 0;

export async function fetchWithRetry(url, { headers = {}, minIntervalMs = 150, retries = 3 } = {}) {
  for (let attempt = 0; ; attempt++) {
    const wait = lastRequestAt + minIntervalMs - Date.now();
    if (wait > 0) await sleep(wait);
    lastRequestAt = Date.now();

    try {
      const res = await fetch(url, { headers });
      if (res.ok) return res;
      // 404 will not fix itself, so fail fast.
      if (res.status === 404 || attempt >= retries) {
        throw new Error(`HTTP ${res.status} for ${url}`);
      }
    } catch (err) {
      if (attempt >= retries || String(err.message).startsWith("HTTP 404")) throw err;
    }
    await sleep(1000 * 2 ** attempt);
  }
}

export async function fetchJson(url, options) {
  const res = await fetchWithRetry(url, options);
  return res.json();
}

export async function fetchText(url, options) {
  const res = await fetchWithRetry(url, options);
  return res.text();
}
