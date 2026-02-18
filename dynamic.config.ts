import type { Author, Friend } from './src/types';

// --- Giscus Comments ---
// Configure via https://giscus.app/ — leave repo empty to disable comments entirely.
export const giscus = {
  /** GitHub repository in "owner/repo" format (e.g. 'alice/my-blog') */
  repo: 'iceice666/blog-site' as `${string}/${string}`,
  /** Repository ID from giscus.app */
  repoId: 'R_kgDORS7QPA',
  /** GitHub Discussions category name */
  category: 'Announcements',
  /** Category ID from giscus.app */
  categoryId: 'DIC_kwDORS7QPM4C2saZ',
};

// --- Umami Analytics ---
// Set UMAMI_API_URL and UMAMI_WEBSITE_ID env vars to enable the visit counter widget.
// Optional: set UMAMI_API_KEY if your instance requires authentication.
export const umami = {
  /**
   * Public base URL of your Umami instance.
   * Used for both the tracking script and the stats API.
   * @example 'https://analytics.example.com'
   * @env UMAMI_API_URL
   */
  apiUrl: import.meta.env.UMAMI_API_URL ?? '',

  /**
   * Website ID found in your Umami dashboard under Settings -> Websites.
   * Required to enable tracking and the visit counter widget.
   * @env UMAMI_WEBSITE_ID
   */
  websiteId: import.meta.env.UMAMI_WEBSITE_ID ?? '',

  /**
   * API key for authenticating requests to the Umami stats API.
   * Only needed if your Umami instance has API key auth enabled.
   * @env UMAMI_API_KEY
   */
  apiKey: import.meta.env.UMAMI_API_KEY ?? '',

  /**
   * Custom URL for the Umami tracking script.
   * Defaults to `{apiUrl}/script.js` when omitted.
   * Useful if you serve the script from a different path or CDN.
   * @env UMAMI_SCRIPT_URL
   */
  scriptUrl: import.meta.env.UMAMI_SCRIPT_URL,

  /**
   * Proxy the Umami tracking script through `/api/uwu.js` on your own domain.
   * Helps avoid ad-blockers that block direct requests to analytics domains.
   * Requires `apiUrl` to be set. When enabled, `scriptUrl` is ignored.
   */
  scriptProxy: false,
};

// --- Author ---

export const author: Author = {
  name: 'Brian Duan',
  tagline: '一般路過史萊姆',
  avatar: 'https://avatars.githubusercontent.com/u/56882049?v=4&size=400',
  socials: [
    { kind: 'email', address: 'me@justaslime.dev' },
    { kind: 'github', url: 'https://github.com/iceice666' },
    { kind: 'website', url: 'https://code.justaslime.dev/explore/repos' },
    { kind: 'rss', url: '/rss.xml' },
  ],
};

// --- Friends ---

export const friends: Friend[] = [
  {
    name: 'Aaron',
    url: 'https://ronkao.tw/',
    img: 'https://ronkao.tw/favicon.jpg',
    desc: '依舊沒有學校的我 嗚嗚嗚',
    socials: [
      { kind: 'github', url: 'https://github.com/ronkaotw' },
    ],
  },
  {
    name: 's0323010',
    url: 'https://devs0323010.github.io/',
    img: 'https://avatars.githubusercontent.com/u/147250604?s=400',
    desc: '懂音樂的軟體工程師 | 個網爛爛的不想修',
    socials: [
      { kind: 'github', url: 'https://github.com/DevS0323010' },
    ],
  },
  {
    name: 'CoffeeCat',
    url: 'https://cat.coffeemeow.com/',
    img: 'https://cat.coffeemeow.com/assets/avatar.jpg',
    desc: '這個人很神祕，什麼都沒有寫',
    socials: [
      { kind: 'github', url: 'https://github.com/Coffeecat2006' },
      { kind: 'email', address: 'cat@coffeemeow.com' },
    ],
  },
  {
    name: '淳',
    url: 'https://chuen666666.github.io/',
    img: 'https://chuen666666.github.io/img/avatar.jpg',
    desc: '群除我佬，我是肺霧',
    socials: [],
  },
];
