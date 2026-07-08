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
  }
}
