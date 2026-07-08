const GITHUB_USER = 'iceice666';

interface GithubApiRepo {
  name: string;
  html_url: string;
  description: string | null;
  language: string | null;
  private: boolean;
  pushed_at: string | null;
  updated_at: string | null;
}

export interface GithubRepo {
  name: string;
  url: string;
  description: string;
  language: string | null;
  pushed: string;
  pushedAt: string | null;
}

export interface GithubData {
  repos: GithubRepo[];
  /** false if the build couldn't reach the GitHub API (offline build, rate limit, etc). */
  live: boolean;
}

const FALLBACK_REPOS: GithubRepo[] = [
  {
    name: 'blog-site',
    url: 'https://github.com/iceice666/blog-site',
    description: 'Self-contained Astro site for justaslime.dev, deployed on Cloudflare Workers.',
    language: 'Astro',
    pushed: 'recently',
    pushedAt: null,
  },
  {
    name: 'dynamic',
    url: 'https://github.com/iceice666/dynamic',
    description: 'Previous TypeScript site-engine experiment that used to power justaslime.dev.',
    language: 'TypeScript',
    pushed: 'recently',
    pushedAt: null,
  },
  {
    name: 'nhnc2026',
    url: 'https://github.com/iceice666/nhnc2026',
    description: 'Writeups and notes from NHNC 2026.',
    language: 'Markdown',
    pushed: 'recently',
    pushedAt: null,
  },
];

function relativeTime(iso: string, now: number): string {
  const days = Math.floor((now - new Date(iso).getTime()) / 86400000);
  if (days < 1) return 'today';
  if (days < 30) return `${days}d`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo`;
  return `${Math.floor(months / 12)}y`;
}

function pushedTimestamp(repo: GithubApiRepo): number {
  return new Date(repo.pushed_at ?? repo.updated_at ?? 0).getTime();
}

function toGithubRepo(repo: GithubApiRepo, now: number): GithubRepo {
  const pushedAt = repo.pushed_at ?? repo.updated_at;
  return {
    name: repo.name,
    url: repo.html_url,
    description: repo.description ?? '',
    language: repo.language,
    pushed: pushedAt ? relativeTime(pushedAt, now) : 'unknown',
    pushedAt,
  };
}

/**
 * Pulls public repositories at build time and shows the three most recently
 * pushed repos. This endpoint needs no auth token, so static/offline builds can
 * still succeed with the fallback data above.
 */
export async function getGithubData(): Promise<GithubData> {
  const now = Date.now();

  let repos: GithubApiRepo[] = [];
  let live = true;
  try {
    const res = await fetch(`https://api.github.com/users/${GITHUB_USER}/repos?per_page=100&type=owner&sort=pushed&direction=desc`, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'justaslime-blog-build' },
    });
    if (res.ok) {
      repos = await res.json();
    } else {
      live = false;
    }
  } catch {
    live = false;
  }

  const activeRepos = repos
    .filter((repo) => !repo.private)
    .sort((a, b) => pushedTimestamp(b) - pushedTimestamp(a))
    .slice(0, 3);

  return {
    repos: activeRepos.length ? activeRepos.map((repo) => toGithubRepo(repo, now)) : FALLBACK_REPOS,
    live: live && activeRepos.length > 0,
  };
}
