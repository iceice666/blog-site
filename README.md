# blog-site

Personal blog content and configuration for [justaslime.dev](https://www.justaslime.dev).

This repository contains:

- **`content/`** — Blog posts and articles (Markdown)
- **`dynamic.config.ts`** — Site configuration (author info, friends, analytics, comments)
- **`wrangler.toml`** — Cloudflare Workers deployment config

## Platform

If you are looking for the underlying blog platform/engine that powers this site, it lives in a separate repository:

> **[justaslime/dynamic](https://github.com/iceice666/dynamic)** — the platform engine

## Deployment

The site is deployed to Cloudflare Workers at [www.justaslime.dev](https://www.justaslime.dev).

Deployment is handled automatically via GitHub Actions on every push to `main`:

1. Checks out this repo and the platform repo (pinned to the SHA in `.last-dynamic-sha`, or latest `main`)
2. Overlays `content/`, `dynamic.config.ts`, and `wrangler.toml` onto the platform source
3. Builds with `pnpm build`
4. Deploys to Cloudflare Workers via `wrangler deploy`

Requires `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` set as GitHub Actions secrets.
