import "server-only";

/* Demand-pulse agent — real community discussion from the last ~30 days.
 *
 * Adapted from the `last30days` skill's Reddit + Hacker News connectors, but
 * using each platform's free, key-free public endpoint so it runs inside the
 * serverless research route with no new credentials:
 *   - Hacker News:  hn.algolia.com/api/v1  (free, no auth)
 *   - Reddit:       www.reddit.com/search.json  (public JSON; rate-limited)
 *
 * Degrades gracefully — any source that errors or rate-limits returns []. */

export type DemandPost = {
  title: string;
  url: string;
  source: "reddit" | "hackernews";
  channel: string; // subreddit (r/x) or "Hacker News"
  engagement: number; // upvotes/points + comments
  comments: number;
  createdAt: string; // ISO
};

export type DemandPulse = {
  posts: DemandPost[];
  totalPosts: number;
  totalEngagement: number;
  channels: string[]; // distinct communities, most active first
  momentum: "high" | "moderate" | "low" | "quiet";
};

const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

function withTimeout<T>(p: (signal: AbortSignal) => Promise<T>, ms: number, fallback: T): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return p(ctrl.signal)
    .catch(() => fallback)
    .finally(() => clearTimeout(timer));
}

/** Hacker News via the free Algolia API — stories from the last 30 days. */
async function searchHackerNews(query: string, limit = 10): Promise<DemandPost[]> {
  const since = Math.floor((Date.now() - MONTH_MS) / 1000);
  const url =
    `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}` +
    `&tags=story&numericFilters=created_at_i>${since}&hitsPerPage=${limit}`;
  return withTimeout(
    async (signal) => {
      const res = await fetch(url, { signal, cache: "no-store" });
      if (!res.ok) return [];
      const data = (await res.json()) as { hits?: Record<string, unknown>[] };
      return (data.hits ?? [])
        .filter((h) => h.title)
        .map((h) => {
          const points = Number(h.points ?? 0);
          const comments = Number(h.num_comments ?? 0);
          const id = String(h.objectID ?? "");
          return {
            title: String(h.title),
            url: (h.url as string) || `https://news.ycombinator.com/item?id=${id}`,
            source: "hackernews" as const,
            channel: "Hacker News",
            engagement: points + comments,
            comments,
            createdAt: new Date(Number(h.created_at_i ?? 0) * 1000).toISOString(),
          };
        });
    },
    12_000,
    []
  );
}

/** Reddit via the public search JSON — top posts this month. No key required. */
async function searchReddit(query: string, limit = 10): Promise<DemandPost[]> {
  const url =
    `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}` +
    `&sort=top&t=month&limit=${limit}&type=link`;
  return withTimeout(
    async (signal) => {
      const res = await fetch(url, {
        signal,
        cache: "no-store",
        // A descriptive UA reduces Reddit's 429 rate-limiting on anonymous calls.
        headers: { "User-Agent": "RetailSupplyIntel/1.0 (demand-pulse)" },
      });
      if (!res.ok) return [];
      const data = (await res.json()) as {
        data?: { children?: { data?: Record<string, unknown> }[] };
      };
      return (data.data?.children ?? [])
        .map((c) => c.data)
        .filter((d): d is Record<string, unknown> => Boolean(d?.title))
        .map((d) => {
          const score = Number(d.score ?? 0);
          const comments = Number(d.num_comments ?? 0);
          const sub = String(d.subreddit ?? "");
          return {
            title: String(d.title),
            url: `https://www.reddit.com${String(d.permalink ?? "")}`,
            source: "reddit" as const,
            channel: sub ? `r/${sub}` : "Reddit",
            engagement: score + comments,
            comments,
            createdAt: new Date(Number(d.created_utc ?? 0) * 1000).toISOString(),
          };
        });
    },
    12_000,
    []
  );
}

function momentumOf(posts: number, engagement: number): DemandPulse["momentum"] {
  if (posts === 0) return "quiet";
  if (engagement >= 2000 || posts >= 12) return "high";
  if (engagement >= 300 || posts >= 5) return "moderate";
  return "low";
}

/**
 * Run the demand pulse for a product. `query` should be the product class /
 * core subject (e.g. "insulated kids water bottle"), not the full idea title.
 */
export async function demandPulse(query: string): Promise<DemandPulse> {
  const q = query.trim();
  if (!q) return { posts: [], totalPosts: 0, totalEngagement: 0, channels: [], momentum: "quiet" };

  const [hn, reddit] = await Promise.all([searchHackerNews(q, 10), searchReddit(q, 12)]);

  // Merge, dedupe by URL, rank by engagement.
  const seen = new Set<string>();
  const posts = [...reddit, ...hn]
    .filter((p) => {
      const key = p.url.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => b.engagement - a.engagement)
    .slice(0, 12);

  const totalEngagement = posts.reduce((sum, p) => sum + p.engagement, 0);

  // Distinct channels, most active first.
  const channelEngagement = new Map<string, number>();
  for (const p of posts) {
    channelEngagement.set(p.channel, (channelEngagement.get(p.channel) ?? 0) + p.engagement);
  }
  const channels = [...channelEngagement.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([c]) => c);

  return {
    posts,
    totalPosts: posts.length,
    totalEngagement,
    channels,
    momentum: momentumOf(posts.length, totalEngagement),
  };
}
