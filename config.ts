// --- Types ---

export type SocialLink =
  | { kind: "email"; address: string; displayName?: string }
  | { kind: string; url: string; displayName?: string };

const defaultSocialDisplayNames: Record<string, string> = {
  email: "mail",
  github: "github",
  website: "site",
};

export function socialHref(social: SocialLink) {
  return "address" in social ? `mailto:${social.address}` : social.url;
}

export function socialDisplayName(social: SocialLink) {
  return (
    social.displayName ?? defaultSocialDisplayNames[social.kind] ?? social.kind
  );
}

export function socialIsExternal(social: SocialLink) {
  return !("address" in social);
}

export interface Author {
  name: string;
  tagline: string;
  avatar: string;
  socials: SocialLink[];
}

export interface Friend {
  name: string;
  url: string;
  img: string;
  desc: string;
  socials: SocialLink[];
}

// --- Site Configuration ---
export const site = {
  /** The production URL of your site */
  url: "https://www.justaslime.dev",
  /** The site title, used for RSS/Sitemap */
  title: "Brian Duan's Blog",
  /** The site description, used for RSS/Sitemap */
  description: "A lazy guy's blog",
};

// --- Giscus Comments ---
// Configure via https://giscus.app/ — leave repo empty to disable comments entirely.
// Not wired into any page yet — restored for future use.
export const giscus = {
  /** GitHub repository in "owner/repo" format (e.g. 'alice/my-blog') */
  repo: "iceice666/blog-site" as `${string}/${string}`,
  /** Repository ID from giscus.app */
  repoId: "R_kgDORS7QPA",
  /** GitHub Discussions category name */
  category: "Announcements",
  /** Category ID from giscus.app */
  categoryId: "DIC_kwDORS7QPM4C2saZ",
};

// --- Author ---

const primaryContactEmail = "brian1061225@gmail.com";

export const author: Author = {
  name: "Brian Duan",
  tagline: "Making projects when I need. A lazy guy.",
  avatar: "/avatar.png",
  socials: [
    { kind: "email", address: primaryContactEmail },
    { kind: "github", url: "https://github.com/iceice666" },
    { kind: "website", url: "https://code.justaslime.dev/explore/repos" },
    {
      kind: "website",
      url: "https://www.pixiv.net/artworks/72701405",
      displayName: "avatar",
    },
  ],
};

// --- Friends ---

export const friends: Friend[] = [
  {
    name: "Aaron",
    url: "https://ronkao.tw/",
    img: "https://ronkao.tw/favicon.jpg",
    desc: "依舊沒有學校的我 嗚嗚嗚",
    socials: [{ kind: "github", url: "https://github.com/ronkaotw" }],
  },
  {
    name: "s0323010",
    url: "https://devs0323010.github.io/",
    img: "https://avatars.githubusercontent.com/u/147250604?s=400",
    desc: "懂音樂的軟體工程師 | 個網爛爛的不想修",
    socials: [{ kind: "github", url: "https://github.com/DevS0323010" }],
  },
  {
    name: "CoffeeCat",
    url: "https://cat.coffeemeow.com/",
    img: "https://cat.coffeemeow.com/assets/avatar.jpg",
    desc: "這個人很神祕，什麼都沒有寫",
    socials: [
      { kind: "github", url: "https://github.com/Coffeecat2006" },
      { kind: "email", address: "cat@coffeemeow.com" },
    ],
  },
  {
    name: "淳",
    url: "https://chuen666666.github.io/",
    img: "https://chuen666666.github.io/img/avatar.jpg",
    desc: "群除我佬，我是肺霧",
    socials: [],
  },
];
