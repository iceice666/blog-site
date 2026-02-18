---
title: Markdown Features Showcase
description: Built-in Markdown features plus math, emoji accessibility, and admonitions.
category: meta
categoryName: Meta
tags: [example, hello]
publishedAt: 2026-02-16
draft: false
lang: en
---

# Markdown Features Showcase

This page demonstrates Markdown built-ins (GFM, smartypants, code fences) plus plugin features (math, emoji accessibility, admonitions).

## Built-in Markdown (GFM + Smartypants)

Smart punctuation: "quotes", "double quotes", and dashes -- all rendered nicely.

Inline code: `astro.config.mjs`

### Task list

- [x] Markdown parsing
- [x] Tables
- [ ] Finish writing all docs

### Table

| Feature             | Status | Notes                             |
| ------------------- | ------ | --------------------------------- |
| GFM                 | ✅      | Tables, task lists, strikethrough |
| Syntax highlighting | ✅      | Shiki themes                      |
| Plugins             | ✅      | Math, emoji, admonitions          |

### Strikethrough

This is ~~deprecated~~ updated content.

### Blockquote

> “Markdown should be readable and expressive.” — Everyone

### Code fences

```ts
export function sum(a: number, b: number): number {
  return a + b;
}
```

## Plugins

### Math (remark-math + rehype-katex)

Inline: $E = mc^2$

Block:

$$
\int_0^\infty e^{-x} dx = 1
$$

### Emoji (rehype-accessible-emojis)

Make sure emojis are accessible: 😄 ✨ 🚀

### Admonitions (remark-admonitions)

:::note
This is a note callout. Use it for helpful context.
:::

:::tip
This is a tip callout. Use it for best practices.
:::

:::warning
This is a warning callout. Use it for gotchas.
:::

:::danger
This is a danger callout. Use it for critical risks.
:::
