const ORG_TYPES = new Set([
  'Organization',
  'Corporation',
  'LocalBusiness',
  'OnlineBusiness',
  'NewsMediaOrganization',
]);

export interface JsonLdOrgFields {
  name: string | null;
  description: string | null;
  industry: string | null;
  location: string | null;
  company_size: string | null;
  same_as: string[];
}

function isOrgType(type: unknown): boolean {
  if (typeof type === 'string') return ORG_TYPES.has(type);
  if (Array.isArray(type)) return type.some((t) => typeof t === 'string' && ORG_TYPES.has(t));
  return false;
}

function formatAddress(addr: unknown): string | null {
  if (!addr || typeof addr !== 'object') return null;
  const a = addr as Record<string, unknown>;
  const parts = [a.streetAddress, a.addressLocality, a.addressRegion, a.postalCode, a.addressCountry]
    .filter((p) => typeof p === 'string' && p.trim())
    .map((p) => (p as string).trim());
  return parts.length ? parts.join(', ') : null;
}

function pickString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim();
  return null;
}

function pickEmployeeCount(value: unknown): string | null {
  if (typeof value === 'number' && value > 0) return String(value);
  if (value && typeof value === 'object') {
    const q = (value as Record<string, unknown>).value ?? (value as Record<string, unknown>).minValue;
    if (typeof q === 'number' && q > 0) return String(q);
  }
  return null;
}

function extractFromNode(node: Record<string, unknown>): JsonLdOrgFields | null {
  if (!isOrgType(node['@type'])) return null;

  const sameAsRaw = node.sameAs;
  const same_as: string[] = [];
  if (typeof sameAsRaw === 'string') same_as.push(sameAsRaw);
  else if (Array.isArray(sameAsRaw)) {
    for (const u of sameAsRaw) {
      if (typeof u === 'string') same_as.push(u);
    }
  }

  const industry =
    pickString(node.industry) ??
    (typeof node.knowsAbout === 'string'
      ? node.knowsAbout
      : Array.isArray(node.knowsAbout) && typeof node.knowsAbout[0] === 'string'
        ? node.knowsAbout[0]
        : null);

  return {
    name: pickString(node.name),
    description: pickString(node.description),
    industry,
    location: formatAddress(node.address),
    company_size: pickEmployeeCount(node.numberOfEmployees),
    same_as,
  };
}

function collectNodes(value: unknown, out: Record<string, unknown>[]): void {
  if (!value || typeof value !== 'object') return;

  if (Array.isArray(value)) {
    for (const item of value) collectNodes(item, out);
    return;
  }

  const obj = value as Record<string, unknown>;
  out.push(obj);

  if (obj['@graph']) collectNodes(obj['@graph'], out);
}

export function parseJsonLdOrganization(blocks: unknown[]): JsonLdOrgFields | null {
  const nodes: Record<string, unknown>[] = [];
  for (const block of blocks) collectNodes(block, nodes);

  for (const node of nodes) {
    const fields = extractFromNode(node);
    if (fields?.name || fields?.description || fields?.location) return fields;
  }

  for (const node of nodes) {
    const fields = extractFromNode(node);
    if (fields) return fields;
  }

  return null;
}

export function parseJsonLdScripts(html: string): unknown[] {
  const blocks: unknown[] = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;

  while ((match = re.exec(html)) !== null) {
    const raw = match[1]?.trim();
    if (!raw) continue;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) blocks.push(...parsed);
      else blocks.push(parsed);
    } catch {
      /* invalid JSON-LD block */
    }
  }

  return blocks;
}
