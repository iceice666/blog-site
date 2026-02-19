import type { Author, Friend } from './src/types';

// --- Site Configuration ---
export const site = {
  /** The production URL of your site */
  url: 'https://www.justaslime.dev',
  /** The site title, used for RSS/Sitemap */
  title: 'Just A Slime',
  /** The site description, used for RSS/Sitemap */
  description: 'Just A Slime',
};

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
// Sensitive credentials (UMAMI_API_URL, UMAMI_WEBSITE_ID, etc.) are read at
// runtime from Cloudflare Worker bindings (set in the dashboard).
export const umami = {
  /**
   * Proxy the Umami tracking script through `/api/uwu.js` on your own domain.
   * Helps avoid ad-blockers that block direct requests to analytics domains.
   * Requires UMAMI_API_URL env var set in Cloudflare dashboard.
   */
  scriptProxy: true,
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
