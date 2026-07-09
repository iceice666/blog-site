import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const stripExt = (path: string) => path.replace(/\.[^./]+$/, '');

// YAML frontmatter auto-parses bare `2026-07-06` as a Date, not a string —
// normalize both shapes back to a plain YYYY-MM-DD string.
const dateString = z
  .union([z.string(), z.date()])
  .optional()
  .transform((v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v));

const articles = defineCollection({
  loader: glob({
    pattern: '**/*.mdx',
    base: './content/articles',
    generateId: ({ entry }) => stripExt(entry),
  }),
  schema: z.object({
    title: z.string(),
    description: z.string().default(''),
    category: z.string().default(''),
    tags: z.array(z.string()).default([]),
    publishedAt: dateString,
    lang: z.string().optional(),
  }),
});

const posts = defineCollection({
  loader: glob({
    pattern: '**/*.md',
    base: './content/posts',
    generateId: ({ entry }) => stripExt(entry),
  }),
  schema: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    category: z.string().optional(),
    tags: z.array(z.string()).default([]),
    publishedAt: dateString,
    lang: z.string().optional(),
    article: z.string().optional(),
  }),
});

export const collections = { articles, posts };
