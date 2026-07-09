declare namespace Cloudflare {
  interface Env {
    DRAFTS: KVNamespace;
    GITHUB_BRANCH?: string;
    GITHUB_CLIENT_ID?: string;
    GITHUB_CLIENT_SECRET?: string;
    GITHUB_OWNER_ID?: string;
    GITHUB_REPO?: string;
    GITHUB_TOKEN?: string;
    SESSION_SECRET?: string;
    UMAMI_API_URL?: string;
    UMAMI_API_TOKEN?: string;
    UMAMI_DOMAINS?: string;
    UMAMI_PASSWORD?: string;
    UMAMI_USERNAME?: string;
    UMAMI_WEBSITE_ID?: string;
  }
}
