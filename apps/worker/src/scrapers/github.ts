export interface GithubData {
  username: string;
  name: string | null;
  bio: string | null;
  location: string | null;
  company: string | null;
  blog: string | null;
  public_repos: number;
  languages: string[];
  avatar_url: string | null;
}

import { scraperUserAgent } from './http';

const GITHUB_API = 'https://api.github.com';

interface GitHubUser {
  login: string;
  name: string | null;
  bio: string | null;
  location: string | null;
  company: string | null;
  blog: string | null;
  public_repos: number;
  avatar_url: string;
}

interface GitHubRepo {
  language: string | null;
}

async function fetchJson<T>(url: string): Promise<T | null> {
  const res = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': scraperUserAgent(),
    },
  });
  if (!res.ok) return null;
  return (await res.json()) as T;
}

async function getUserRepos(username: string): Promise<string[]> {
  const repos = await fetchJson<GitHubRepo[]>(
    `${GITHUB_API}/users/${username}/repos?per_page=50&sort=pushed`
  );
  if (!repos) return [];

  const langSet = new Set<string>();
  for (const repo of repos) {
    if (repo.language) langSet.add(repo.language);
  }
  return Array.from(langSet).slice(0, 10);
}

/**
 * Scrape GitHub for user info by email or domain.
 * Uses GitHub Search API to find users by email, then falls back
 * to searching by domain in the company field.
 */
export async function scrapeGithub(
  email?: string,
  domain?: string
): Promise<GithubData | null> {
  try {
    let user: GitHubUser | null = null;

    // Strategy 1: search by email
    if (email) {
      const searchResult = await fetchJson<{ items: GitHubUser[] }>(
        `${GITHUB_API}/search/users?q=${encodeURIComponent(email)}+in:email`
      );
      if (searchResult?.items?.length) {
        user = searchResult.items[0];
      }
    }

    // Strategy 2: fallback — search by domain in company field
    if (!user && domain) {
      const searchResult = await fetchJson<{ items: GitHubUser[] }>(
        `${GITHUB_API}/search/users?q=${encodeURIComponent(domain)}+in:company`
      );
      if (searchResult?.items?.length) {
        user = searchResult.items[0];
      }
    }

    if (!user) return null;

    // Get full profile (search results may be abbreviated)
    const fullUser = await fetchJson<GitHubUser>(`${GITHUB_API}/users/${user.login}`);
    const profile = fullUser ?? user;

    // Get languages from repos
    const languages = await getUserRepos(profile.login);

    return {
      username: profile.login,
      name: profile.name,
      bio: profile.bio,
      location: profile.location,
      company: profile.company,
      blog: profile.blog,
      public_repos: profile.public_repos,
      languages,
      avatar_url: profile.avatar_url,
    };
  } catch {
    return null;
  }
}
