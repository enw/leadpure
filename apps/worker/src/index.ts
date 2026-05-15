import type { EnrichRequest, EnrichResult } from '@leadpure/core';
import { scrapeCrunchbase } from './scrapers/crunchbase';
import { scrapeGithub } from './scrapers/github';
import { scrapeWebsite } from './scrapers/website';
import { aggregate } from './aggregator';

// ── Types ────────────────────────────────────────────────────────

export interface Job {
  id: string;
  request: EnrichRequest;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: EnrichResult;
  error?: string;
  created_at: string;
  completed_at?: string;
}

// ── In-memory job store (MVP) ────────────────────────────────────

const jobs = new Map<string, Job>();

let nextId = 1;
function generateId(): string {
  return `job_${Date.now()}_${nextId++}`;
}

// ── Public API ───────────────────────────────────────────────────

export function createJob(req: EnrichRequest): Job {
  const id = generateId();
  const job: Job = {
    id,
    request: req,
    status: 'pending',
    created_at: new Date().toISOString(),
  };
  jobs.set(id, job);
  return job;
}

export function getJob(id: string): Job | undefined {
  return jobs.get(id);
}

export async function runJob(id: string): Promise<Job> {
  const job = jobs.get(id);
  if (!job) throw new Error(`Job ${id} not found`);

  job.status = 'processing';

  try {
    const domain = job.request.domain ?? job.request.email?.split('@')[1] ?? 'unknown.com';
    const email = job.request.email ?? `hello@${domain}`;

    const [crunchbaseResult, githubResult, websiteResult] = await Promise.allSettled([
      scrapeCrunchbase(domain),
      scrapeGithub(email, domain),
      scrapeWebsite(domain),
    ]);

    const result = aggregate({
      email,
      domain,
      crunchbase: crunchbaseResult.status === 'fulfilled' ? crunchbaseResult.value : null,
      github: githubResult.status === 'fulfilled' ? githubResult.value : null,
      website: websiteResult.status === 'fulfilled' ? websiteResult.value : null,
    });

    job.result = result;
    job.status = 'completed';
    job.completed_at = new Date().toISOString();
  } catch (err) {
    job.status = 'failed';
    job.error = err instanceof Error ? err.message : String(err);
    job.completed_at = new Date().toISOString();
  }

  return job;
}

/**
 * Process an enrichment request end-to-end:
 * creates a job, runs it, and returns the job.
 */
export async function processEnrichment(req: EnrichRequest): Promise<Job> {
  const job = createJob(req);
  return runJob(job.id);
}
