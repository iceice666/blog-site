import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import mdx from '@astrojs/mdx';
import { markdownProcessor } from './src/lib/markdown.ts';

export default defineConfig({
  output: 'server',
  adapter: cloudflare(),
  integrations: [mdx()],
  markdown: {
    syntaxHighlight: false,
    processor: markdownProcessor,
  },
});
