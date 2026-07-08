# AGENTS.md

## Project Overview

This is a personal Astro blog for `justaslime.dev`, deployed to Cloudflare
Workers through `@astrojs/cloudflare`.

- Use `pnpm`; do not introduce another package manager lockfile.
- The site is ESM-only (`"type": "module"`) and TypeScript uses Astro strict
  settings.
- Keep changes small and aligned with the existing terminal/tmux-inspired UI.

## Repository Map

- `content/articles/*.mdx` - long-form articles loaded as the `articles`
  content collection.
- `content/posts/*.md` - short posts loaded as the `posts` collection.
- `src/pages/` - Astro routes, mostly prerendered static pages.
- `src/layouts/Shell.astro` - shared tmux-style page shell.
- `src/components/` - sidebar and MDX-only components.
- `src/lib/content.ts` - content normalization, route slug mapping, reading
  time, language inference, and nav items.
- `src/lib/markdown.ts` - custom remark/rehype plugins and inline markdown
  rendering.
- `src/scripts/vim-nav.ts` - client-side keyboard navigation.
- `src/styles/global.css` - global theme tokens and all page styling.
- `config.ts` - site, author, friends, socials, and giscus configuration.
- `wrangler.toml` - Cloudflare Worker, assets, routes, and KV bindings.

## Commands

- `pnpm install` - install dependencies.
- `pnpm dev` - generate Wrangler types, then run Astro dev at
  `localhost:4321`.
- `pnpm check` - run Astro/TypeScript checks.
- `pnpm build` - generate Wrangler types and build to `dist/`.
- `pnpm preview` - build, then serve through the local Workers runtime.
- `pnpm deploy` - build and deploy to Cloudflare; only run this when the user
  explicitly asks for a deploy.

Prefer `pnpm check` for fast validation after code changes and `pnpm build`
before changes that affect content loading, routing, Astro config, or
Cloudflare adapter behavior.

## Coding Guidelines

- Follow the style already present in the touched file; avoid broad formatting
  churn.
- Prefer typed helpers in `src/lib/` over duplicating content or routing logic
  in pages.
- Keep markdown pipeline changes centralized in `src/lib/markdown.ts` and wire
  them through `astro.config.mjs`.
- Preserve accessibility attributes already used by the shell, buttons, and
  keyboard navigation.
- When adding interactive elements that Vim navigation should target, use the
  existing `data-vim-target` and `data-vim-open` patterns.
- Do not rename Cloudflare bindings or route settings without updating
  `wrangler.toml` and checking any generated Worker types.

## Content Guidelines

- Articles must satisfy the schema in `src/content.config.ts`: `title` is
  required; `description`, `category`, `tags`, `publishedAt`, and `lang` are
  supported.
- Posts may omit most frontmatter, but dates should be explicit
  `YYYY-MM-DD` strings when possible.
- `publishedAt` accepts YAML date objects or strings, then normalizes to
  `YYYY-MM-DD`.
- If an article needs a public slug different from its filename, update
  `ARTICLE_SLUGS` in `src/lib/content.ts`.
- About pages are special-cased by `isAboutArticleId`; preserve `/about` and
  `/about-zh-tw` behavior.
- A post with the same id as an article becomes a feed stub linking to that
  article.
- MDX articles may use `<RepoCard />`, `<SkillGrid />`, and the custom
  collapsible aside syntax:

```md
:::|> label
content
:::
```

## UI And Styling

- The visual direction is compact, terminal-like, and content-first. Avoid
  unrelated design shifts, marketing-style sections, or decorative refactors.
- Use existing CSS custom properties in `src/styles/global.css` before adding
  new colors.
- Keep responsive behavior consistent with the current `901px` shell/sidebar
  breakpoint unless a change specifically requires otherwise.
- Preserve multilingual typography behavior for English, Traditional Chinese,
  Simplified Chinese, and Japanese content.

## Git

- Use Conventional Commits for commit messages.
- Do not revert user changes unless explicitly asked.
