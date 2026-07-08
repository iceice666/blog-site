# blog-site

Personal blog for [justaslime.dev](https://www.justaslime.dev) — an Astro site deployed to Cloudflare Workers.

This repository contains:

- **`content/`** — Blog posts and articles (Markdown/MDX)
- **`config.ts`** — Site config: author bio, friends list, and GitHub Discussions comment config
- **`src/`** — The Astro site itself (layouts, components, pages, content schema)
- **`wrangler.toml`** — Cloudflare Workers deployment config

## Development

```sh
pnpm install
pnpm dev      # astro dev at localhost:4321
```

## Build & deploy

```sh
pnpm build    # wrangler types + astro build -> dist/
pnpm preview  # build, then serve it locally through the real Workers runtime (wrangler dev)
pnpm deploy   # build, then wrangler deploy
```

Deploying requires a Cloudflare account authenticated via `wrangler login` (or a
`CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` pair for non-interactive use).

## Content

Articles live in `content/articles/*.mdx`, short posts in `content/posts/*.md`. Both
are loaded as Astro content collections (see `src/content.config.ts`) — no build step
outside of `astro build` itself. Articles support two custom pieces of MDX beyond
plain markdown:

- `<RepoCard url="..." desc="..." />` and `<SkillGrid label="..." skills={[...]} />` —
  components in `src/components/mdx/`.
- `:::|> label` … `:::` — a collapsible aside, rewritten to `<details>`/`<summary>` by
  a remark plugin in `astro.config.mjs`.

Short posts also have standalone `/posts/<slug>/` pages so they can be linked,
navigated, and commented on independently.

## Comments

Comments use a custom on-site UI backed by GitHub Discussions. The UI reads and
creates Discussions in the repository configured in `config.ts`, then posts
comments with the logged-in visitor's GitHub OAuth token.

Required runtime secrets:

```sh
wrangler secret put GITHUB_TOKEN
wrangler secret put GITHUB_CLIENT_ID
wrangler secret put GITHUB_CLIENT_SECRET
wrangler secret put SESSION_SECRET
```

- `GITHUB_TOKEN` needs access to read/create Discussions in the
  configured public repo. A classic token with `public_repo` works; a
  fine-grained token should allow repository Discussions read/write.
- The OAuth app should request the callback URL
  `https://www.justaslime.dev/api/auth/github/callback` in production and
  whichever local server you use, for example
  `http://localhost:4321/api/auth/github/callback` for `pnpm dev` or
  `http://localhost:8787/api/auth/github/callback` for `pnpm preview`.
- `SESSION_SECRET` should be a long random value, for example from
  `openssl rand -base64 32`.

## Admin editor

`/admin/edit` is a private GitHub-backed editor for `content/posts/*.md` and
`content/articles/*.mdx`.

- Access requires GitHub login, then the logged-in user must match
  `GITHUB_OWNER_ID` by numeric id or login.
- Drafts are saved manually to the `DRAFTS` KV namespace.
- Preview uses GitHub's Markdown renderer. MDX imports and custom components are
  previewed approximately, not executed through Astro.
- Publishing commits directly to `GITHUB_BRANCH` through GitHub's Contents API.
  `GITHUB_TOKEN` needs repository Contents write access.

For local preview with admin APIs, add matching values to `.dev.vars`; remote
Worker secrets are not automatically available in local `wrangler dev`.

## Cloudflare bindings

- **`ASSETS`** — static output, wired automatically by `@astrojs/cloudflare`.
- **`DRAFTS`** (KV) — stores manual drafts from `/admin/edit`.
- **`SESSION`** (KV) — auto-provisioned by the Cloudflare adapter; the custom
  comment login does not use it, because GitHub sessions live in encrypted
  HttpOnly cookies.
