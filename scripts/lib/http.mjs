// Small fetch helper shared by every data provider: polite per-host throttling,
// a few retries with backoff, and a descriptive User-Agent (SEC requires one).

import { createWriteStream } from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Next allowed request time per host, so concurrent workers still respect the limit.
const nextSlot = new Map();

async function throttle(url, minIntervalMs) {
  const host = new URL(url).host;
  const now = Date.now();
  const slot = Math.max(now, nextSlot.get(host) ?? 0);
  nextSlot.set(host, slot + minIntervalMs);
  if (slot > now) await sleep(slot - now);
}

export async function fetchWithRetry(url, { headers = {}, minIntervalMs = 150, retries = 3 } = {}) {
  for (let attempt = 0; ; attempt++) {
    await throttle(url, minIntervalMs);
    try {
      const res = await fetch(url, { headers });
      if (res.ok) return res;
      // Not found / forbidden will not fix themselves, so fail fast.
      if (res.status === 403 || res.status === 404 || attempt >= retries) {
        throw new Error(`HTTP ${res.status} for ${url}`);
      }
      // Rate limited: back off much longer before trying again.
      if (res.status === 429) await sleep(30_000 * (attempt + 1));
    } catch (err) {
      if (attempt >= retries || /^HTTP 40[34]/.test(err.message)) throw err;
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

// Streams a large download straight to disk.
export async function downloadToFile(url, filePath, options) {
  const res = await fetchWithRetry(url, options);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(filePath));
}

// Runs `fn` over `items` with at most `limit` in flight; results keep input order.
export async function mapPool(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
