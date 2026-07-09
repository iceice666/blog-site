import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import mdx from '@astrojs/mdx';
import { existsSync, readdirSync } from 'node:fs';
import { markdownProcessor } from './src/lib/markdown.ts';

function standaloneArticleIds() {
  const root = new URL('./content/articles/', import.meta.url);
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(new URL(`${entry.name}/.standalone`, root)))
    .map((entry) => entry.name)
    .sort();
}

export default defineConfig({
  output: 'server',
  adapter: cloudflare(),
  integrations: [mdx()],
  vite: {
    define: {
      __STANDALONE_ARTICLE_IDS__: JSON.stringify(standaloneArticleIds()),
    },
  },
  markdown: {
    syntaxHighlight: false,
    processor: markdownProcessor,
  },
});
