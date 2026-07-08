const GITHUB_USER = 'iceice666';
const WEEKS = 18;
const DAYS = WEEKS * 7;

export interface GithubActivityItem {
  ev: string;
  repo: string;
  when: string;
}

export interface GithubData {
  /** DAYS cells, oldest first, intensity 0-3 — bucketed from real public events when available. */
  heatmap: number[];
  activity: GithubActivityItem[];
  /** false if the build couldn't reach the GitHub API (offline build, rate limit, etc). */
  live: boolean;
}

export const PINNED_REPOS = [
  {
    name: 'blog-site',
    desc: 'Self-contained Astro site for justaslime.dev, deployed on Cloudflare Workers.',
    lang: 'Markdown',
    langVar: '--lang-md',
  },
  {
    name: 'dynamic',
    desc: 'Previous TypeScript site-engine experiment that used to power justaslime.dev.',
    lang: 'TypeScript',
    langVar: '--lang-ts',
  },
];

const FALLBACK_ACTIVITY: GithubActivityItem[] = [
  { ev: 'push', repo: 'blog-site', when: '—' },
  { ev: 'pr', repo: 'blog-site', when: '—' },
];

function relativeTime(iso: string, now: number): string {
  const days = Math.floor((now - new Date(iso).getTime()) / 86400000);
  if (days < 1) return 'today';
  if (days < 30) return `${days}d`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo`;
  return `${Math.floor(months / 12)}y`;
}

function eventLabel(type: string): string | null {
  switch (type) {
    case 'PushEvent':
      return 'push';
    case 'PullRequestEvent':
      return 'pr';
    case 'CreateEvent':
      return 'create';
    case 'IssuesEvent':
      return 'issue';
    case 'WatchEvent':
      return 'star';
    case 'ForkEvent':
      return 'fork';
    default:
      return null;
  }
}

/**
 * Pulls the last ~90 days of public GitHub events at build time. This endpoint
 * needs no auth token, which is what makes it usable here — a real contribution
 * calendar (private commits included) requires GitHub's GraphQL API + a token,
 * which this build doesn't have.
 */
export async function getGithubData(): Promise<GithubData> {
  const now = Date.now();
  const dayBuckets = new Array(DAYS).fill(0);

  let events: any[] = [];
  let live = true;
  try {
    const res = await fetch(`https://api.github.com/users/${GITHUB_USER}/events/public`, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'justaslime-blog-build' },
    });
    if (res.ok) {
      events = await res.json();
    } else {
      live = false;
    }
  } catch {
    live = false;
  }

  for (const event of events) {
    const created = new Date(event.created_at).getTime();
    const dayIndex = DAYS - 1 - Math.floor((now - created) / 86400000);
    if (dayIndex >= 0 && dayIndex < DAYS) dayBuckets[dayIndex]++;
  }

  const max = Math.max(1, ...dayBuckets);
  const heatmap = dayBuckets.map((count) => {
    if (count === 0) return 0;
    const ratio = count / max;
    if (ratio > 0.66) return 3;
    if (ratio > 0.33) return 2;
    return 1;
  });

  const activity = events
    .map((e) => {
      const ev = eventLabel(e.type);
      if (!ev) return null;
      return { ev, repo: e.repo?.name?.split('/')?.[1] ?? e.repo?.name ?? '?', when: relativeTime(e.created_at, now) };
    })
    .filter((e): e is GithubActivityItem => e !== null)
    .slice(0, 3);

  return {
    heatmap,
    activity: activity.length ? activity : FALLBACK_ACTIVITY,
    live: live && events.length > 0,
  };
}
