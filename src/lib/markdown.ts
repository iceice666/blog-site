import { unified, type MarkdownRenderer, type RehypePlugin, type RemarkPlugin } from '@astrojs/markdown-remark';

type MarkdownNode = {
  type?: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: MarkdownNode[];
  value?: string;
  [key: string]: unknown;
};

const LEGACY_POST_ROUTES: Record<string, string> = {
  'nhnc-2026-writeups': '/articles/nhnc-2026-writeups/',
};

/** Rewrite legacy content-authored /posts/<slug>/ links only when a post moved. */
export const rewriteInternalLinks: RehypePlugin = () => {
  return (tree) => {
    function visit(node: MarkdownNode) {
      if (node.type === 'element' && node.tagName === 'a' && node.properties?.href) {
        const href = String(node.properties.href);
        const m = href.match(/^\/posts\/([^/?#]+)\/?$/);
        if (m && LEGACY_POST_ROUTES[m[1]]) node.properties.href = LEGACY_POST_ROUTES[m[1]];
      }
      node.children?.forEach(visit);
    }
    visit(tree as MarkdownNode);
  };
};

/** Copy the `language-xxx` class onto <pre> as data-lang so CSS can print a label. */
export const labelCodeLang: RehypePlugin = () => {
  return (tree) => {
    function visit(node: MarkdownNode) {
      if (node.type === 'element' && node.tagName === 'pre' && node.children?.length === 1) {
        const codeNode = node.children[0];
        if (codeNode?.type === 'element' && codeNode.tagName === 'code') {
          const className = codeNode.properties?.className;
          const classes = Array.isArray(className) ? className : [];
          const cls = classes.find((c): c is string => typeof c === 'string' && c.startsWith('language-'));
          if (cls) {
            node.properties = node.properties || {};
            node.properties['data-lang'] = cls.replace('language-', '');
          }
        }
      }
      node.children?.forEach(visit);
    }
    visit(tree as MarkdownNode);
  };
};

function textOf(node: MarkdownNode): string {
  if (typeof node.value === 'string') return node.value;
  return (node.children ?? []).map(textOf).join('');
}

/** The layout already renders the frontmatter title as the page heading, so a
 * body that opens with the same `# Title` would show it twice — drop it. */
export const stripDuplicateLeadingH1: RehypePlugin = () => {
  return (tree, file) => {
    const title = (file?.data as { astro?: { frontmatter?: { title?: unknown } } })?.astro?.frontmatter?.title;
    if (typeof title !== 'string' || !title.trim()) return;
    const root = tree as MarkdownNode;
    const children = root.children ?? [];
    const first = children.find((c) => c.type === 'element');
    if (!first || first.tagName !== 'h1') return;
    const normalize = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();
    if (normalize(textOf(first)) !== normalize(title)) return;
    root.children = children.filter((c) => c !== first);
  };
};

/** Wrap tables in a scroll container so wide ones don't force page-level
 * horizontal scroll on phones. */
export const wrapTables: RehypePlugin = () => {
  return (tree) => {
    function visit(node: MarkdownNode) {
      node.children?.forEach((child, index) => {
        if (child.type === 'element' && child.tagName === 'table') {
          node.children![index] = {
            type: 'element',
            tagName: 'div',
            properties: { className: ['table-scroll'] },
            children: [child],
          };
        } else {
          visit(child);
        }
      });
    }
    visit(tree as MarkdownNode);
  };
};

function paragraphText(node: MarkdownNode) {
  if (!node || node.type !== 'paragraph') return null;
  return (node.children ?? []).map((c) => c.value ?? '').join('');
}

/**
 * Content authors write `:::|> label` ... `:::` for a collapsible aside.
 * Rewrite that mdast block into a real <details>/<summary> pair for MDX.
 */
export const remarkCollapsibleAside: RemarkPlugin = () => {
  return (tree) => {
    const root = tree as MarkdownNode;
    const out: MarkdownNode[] = [];
    let collecting = false;
    let label = '';
    let inner: MarkdownNode[] = [];
    for (const node of root.children ?? []) {
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
    root.children = out;
  };
};

export const markdownProcessor = unified({
  remarkPlugins: [remarkCollapsibleAside],
  rehypePlugins: [rewriteInternalLinks, labelCodeLang, wrapTables, stripDuplicateLeadingH1],
  gfm: true,
});

let renderer: Promise<MarkdownRenderer> | undefined;

function getMarkdownRenderer() {
  renderer ??= markdownProcessor.createRenderer({ syntaxHighlight: false });
  return renderer;
}

function unwrapSingleParagraph(html: string) {
  const trimmed = html.trim();
  const match = trimmed.match(/^<p(?:\s[^>]*)?>([\s\S]*)<\/p>$/);
  if (!match || match[1].includes('</p>')) return trimmed;
  return match[1];
}

export async function renderInlineMarkdown(markdown: string) {
  const markdownRenderer = await getMarkdownRenderer();
  const { code } = await markdownRenderer.render(markdown);
  return unwrapSingleParagraph(code);
}
