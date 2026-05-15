interface WindowEntry {
  timestamps: number[];
}

const windows = new Map<string, WindowEntry>();

const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 100; // free tier

// Clean up stale entries every 5 minutes
setInterval(() => {
  const cutoff = Date.now() - WINDOW_MS;
  for (const [key, entry] of windows) {
    entry.timestamps = entry.timestamps.filter(t => t > cutoff);
    if (entry.timestamps.length === 0) windows.delete(key);
  }
}, 300_000).unref();

export function checkRateLimit(keyId: string): boolean {
  const now = Date.now();
  const cutoff = now - WINDOW_MS;

  let entry = windows.get(keyId);
  if (!entry) {
    entry = { timestamps: [] };
    windows.set(keyId, entry);
  }

  // Remove expired timestamps
  entry.timestamps = entry.timestamps.filter(t => t > cutoff);

  if (entry.timestamps.length >= MAX_REQUESTS) {
    return false; // rate limited
  }

  entry.timestamps.push(now);
  return true;
}
