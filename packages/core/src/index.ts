export interface EnrichRequest {
  email?: string;
  domain?: string;
}

export interface EnrichResult {
  email: string;
  domain: string;
  name: string | null;
  title: string | null;
  company: string | null;
  company_size: string | null;
  industry: string | null;
  location: string | null;
  social: {
    linkedin: string | null;
    github: string | null;
    twitter: string | null;
  };
  confidence: number;
  cached: boolean;
  cached_at: string | null;
}

export function enrich(req: EnrichRequest): EnrichResult {
  const domain = req.domain ?? req.email?.split('@')[1] ?? 'unknown.com';
  const email = req.email ?? `hello@${domain}`;

  return {
    email,
    domain,
    name: 'Jane Doe',
    title: 'CEO',
    company: domain.charAt(0).toUpperCase() + domain.split('.')[0].slice(1),
    company_size: '50-200',
    industry: 'Technology',
    location: 'San Francisco, CA',
    social: {
      linkedin: `linkedin.com/in/janedoe`,
      github: `github.com/janedoe`,
      twitter: `x.com/janedoe`,
    },
    confidence: 0.85,
    cached: false,
    cached_at: null,
  };
}
