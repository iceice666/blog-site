# blog-site

Personal blog for [justaslime.dev](https://www.justaslime.dev) — an Astro site deployed to Cloudflare Workers.

This repository contains:

- **`content/`** — Blog posts and articles (Markdown/MDX)
- **`config.ts`** — Site config: author bio, friends list, plus giscus config not wired up yet
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

## Cloudflare bindings

- **`ASSETS`** — static output, wired automatically by `@astrojs/cloudflare`.
- **`DRAFTS`** (KV) — reserved for a future admin/drafts editor; unused for now.
- **`SESSION`** (KV) — auto-provisioned by the Cloudflare adapter on first deploy;
  unused since the site has no session-backed features yet.
