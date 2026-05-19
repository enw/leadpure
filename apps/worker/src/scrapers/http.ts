const DEFAULT_CONTACT = 'dev@leadpure.local';

export function scraperUserAgent(): string {
  const email = process.env.LEADPURE_CONTACT_EMAIL ?? DEFAULT_CONTACT;
  return `LeadPure/1.0 (+https://github.com/enw/leadpure; mailto:${email})`;
}

export async function fetchWithTimeout(
  url: string,
  timeoutMs = 8000,
): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': scraperUserAgent() },
      signal: controller.signal,
      redirect: 'follow',
    });
    if (!res.ok) return null;
    const text = await res.text();
    if (text.length > 1_000_000) return null;
    return text;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
