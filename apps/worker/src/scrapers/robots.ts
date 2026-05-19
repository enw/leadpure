/**
 * Minimal robots.txt checker (User-agent: * rules).
 * If robots.txt is missing or unparsable, secondary paths are skipped (fail closed).
 */

function normalizePath(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return p.length > 1 && p.endsWith('/') ? p.slice(0, -1) : p;
}

function parseRules(robotsTxt: string, agent: string): { allow: string[]; disallow: string[] } {
  const allow: string[] = [];
  const disallow: string[] = [];
  let applies = false;

  for (const rawLine of robotsTxt.split('\n')) {
    const line = rawLine.split('#')[0]?.trim() ?? '';
    if (!line) continue;

    const lower = line.toLowerCase();
    if (lower.startsWith('user-agent:')) {
      const ua = line.slice('user-agent:'.length).trim();
      applies = ua === '*' || ua.toLowerCase() === agent.toLowerCase();
      continue;
    }

    if (!applies) continue;

    if (lower.startsWith('disallow:')) {
      const path = line.slice('disallow:'.length).trim();
      disallow.push(path === '' ? '/' : path);
    } else if (lower.startsWith('allow:')) {
      const path = line.slice('allow:'.length).trim();
      allow.push(path === '' ? '/' : path);
    }
  }

  return { allow, disallow };
}

function pathMatches(rulePath: string, requestPath: string): boolean {
  if (rulePath === '/') return true;
  const norm = normalizePath(requestPath);
  const rule = normalizePath(rulePath);
  return norm === rule || norm.startsWith(`${rule}/`);
}

export function isPathAllowed(path: string, robotsTxt: string | null): boolean {
  if (!robotsTxt) return false;

  const requestPath = normalizePath(path);
  const { allow, disallow } = parseRules(robotsTxt, 'leadpure');

  for (const rule of allow) {
    if (pathMatches(rule, requestPath)) return true;
  }

  for (const rule of disallow) {
    if (pathMatches(rule, requestPath)) return false;
  }

  return true;
}

export async function fetchRobotsTxt(
  fetchFn: (url: string) => Promise<string | null>,
  domain: string,
): Promise<string | null> {
  for (const base of [`https://${domain}`, `https://www.${domain}`]) {
    const txt = await fetchFn(`${base}/robots.txt`);
    if (txt) return txt;
  }
  return null;
}
