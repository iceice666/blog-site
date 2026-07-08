import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';
import cloudflare from '@astrojs/cloudflare';
import mdx from '@astrojs/mdx';

/** Rewrite content-authored /articles/<slug>/ and /posts/<slug>/ links to real routes. */
function rewriteInternalLinks() {
  return (tree) => {
    function visit(node) {
      if (node.type === 'element' && node.tagName === 'a' && node.properties?.href) {
        const href = String(node.properties.href);
        const m = href.match(/^\/(articles|posts)\/([\w-]+)\/?$/);
        if (m) node.properties.href = `/${m[2]}`;
      }
      if (node.children) node.children.forEach(visit);
    }
    visit(tree);
  };
}

/** Copy the `language-xxx` class rehype-highlight would normally add off the <code> onto a
 *  data-lang attribute on <pre>, so CSS can print a language label without Shiki. */
function labelCodeLang() {
  return (tree) => {
    function visit(node) {
      if (node.type === 'element' && node.tagName === 'pre' && node.children?.length === 1) {
        const codeNode = node.children[0];
        if (codeNode?.type === 'element' && codeNode.tagName === 'code') {
          const cls = (codeNode.properties?.className || []).find(
            (c) => typeof c === 'string' && c.startsWith('language-')
          );
          if (cls) {
            node.properties = node.properties || {};
            node.properties['data-lang'] = cls.replace('language-', '');
          }
        }
      }
      if (node.children) node.children.forEach(visit);
    }
    visit(tree);
  };
}

function paragraphText(node) {
  if (!node || node.type !== 'paragraph') return null;
  return (node.children ?? []).map((c) => c.value ?? '').join('');
}

/**
 * Content authors write `:::|> label` ... `:::` for a collapsible aside (see
 * content/articles/about-me.mdx) — not standard markdown/MDX syntax. Rewrite
 * the mdast tree so that block into a real <details>/<summary> pair, since
 * MDX renders those natively.
 */
function remarkCollapsibleAside() {
  return (tree) => {
    const out = [];
    let collecting = false;
    let label = '';
    let inner = [];
    for (const node of tree.children) {
      const text = paragraphText(node);
      if (!collecting && text && text.trimStart().startsWith(':::|>')) {
        collecting = true;
        label = text.trim().slice(':::|>'.length).trim();
        inner = [];
        continue;
      }
      if (collecting && text && text.trim() === ':::') {
        out.push({
          type: 'mdxJsxFlowElement',
          name: 'details',
          attributes: [{ type: 'mdxJsxAttribute', name: 'open', value: null }],
          children: [
            {
              type: 'mdxJsxFlowElement',
              name: 'summary',
              attributes: [],
              children: [{ type: 'text', value: label }],
            },
            ...inner,
          ],
        });
        collecting = false;
        continue;
      }
      if (collecting) {
        inner.push(node);
      } else {
        out.push(node);
      }
    }
    tree.children = out;
  };
}

export default defineConfig({
  output: 'server',
  adapter: cloudflare(),
  integrations: [mdx()],
  markdown: {
    syntaxHighlight: false,
    processor: unified({
      remarkPlugins: [remarkCollapsibleAside],
      rehypePlugins: [rewriteInternalLinks, labelCodeLang],
      gfm: true,
    }),
  },
});
