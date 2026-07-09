---
version: alpha
name: Terminal Broadsheet
description: >-
  The tmux/terminal-inspired visual identity for justaslime.dev — a compact,
  content-first personal blog. Flat rectangular panels, hairline borders, a
  single teal accent, and a Catppuccin Latte (light) / Mocha (dark) palette.
  Monospace chrome frames long-form prose set in a humanist sans.
colors:
  # --- Light theme (Catppuccin Latte) — the :root default ---
  bg: "#eff1f5"            # page background (latte base)
  surface: "#e6e9ef"       # raised chrome: pane titles, status rows (latte mantle)
  surface-2: "#dce0e8"     # deeper chrome: pills, top/bottom bars (latte crust)
  text: "#4c4f69"          # primary body text (latte text)
  text-muted: "#5c5f77"    # metadata, captions, inactive chrome (latte subtext1)
  accent: "#0d7278"        # the single interaction/brand color (deep teal)
  accent-strong: "#0a5a5f" # hover/pressed accent
  bold: "#8839ef"          # <strong> emphasis in prose (latte mauve)
  border: "#bcc0cc"        # hairline dividers and outlines (latte surface2)
  pill-post: "#6b57d6"     # "post" content-type tag
  lang-ts: "#1a5ce0"       # category / language accent (blue)
  lang-md: "#6c6f85"       # muted language accent
  flag: "#df8e1d"          # warnings, CTF flag callouts, dirty-state markers
  danger: "#d20f39"        # destructive actions, shell blocks, errors
  code-panel: "#dce0e8"    # rendered code-block surface (distinct from bg)
  code-bg: "#181825"       # always-dark editor pane + flag-chip text (latte-independent)
  code-text: "#cdd6f4"     # text on the always-dark editor pane
  code-lang: "#7f849c"     # neutral language-label ink
  # --- Dark theme (Catppuccin Mocha) — [data-theme="dark"] override ---
  bg-dark: "#1e1e2e"       # mocha base
  surface-dark: "#313244"  # mocha surface0
  surface-2-dark: "#45475a" # mocha surface1
  text-dark: "#cdd6f4"     # mocha text
  text-muted-dark: "#a6adc8" # mocha subtext0
  accent-dark: "#94e2d5"   # mocha teal
  accent-strong-dark: "#b4f5ea"
  bold-dark: "#cba6f7"     # mocha mauve
  border-dark: "#45475a"   # mocha surface1
  pill-post-dark: "#b4befe" # mocha lavender
  lang-ts-dark: "#89b4fa"  # mocha blue
  flag-dark: "#f9e2af"     # mocha yellow
  danger-dark: "#f38ba8"   # mocha red
  code-panel-dark: "#11111b" # mocha crust
typography:
  display:
    fontFamily: Sarasa UI TC
    fontSize: 31px
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: 0em
  title:
    fontFamily: Sarasa UI TC
    fontSize: 25px
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: 0em
  heading:
    fontFamily: Sarasa UI TC
    fontSize: 20px
    fontWeight: 700
    lineHeight: 1.35
  section:
    fontFamily: Sarasa UI TC
    fontSize: 23px
    fontWeight: 700
    lineHeight: 1.35
  subsection:
    fontFamily: Sarasa UI TC
    fontSize: 18px
    fontWeight: 700
    lineHeight: 1.45
  prose:
    fontFamily: Sarasa UI TC
    fontSize: 17px
    fontWeight: 400
    lineHeight: 1.78
  ui:
    fontFamily: Sarasa Term TC
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: Sarasa Term TC
    fontSize: 13px
    fontWeight: 700
    letterSpacing: 0.08em
  code:
    fontFamily: Sarasa Fixed TC
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.6
rounded:
  sm: 2px
  md: 3px
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 22px
  xxl: 34px
components:
  session-tag:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.bg}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: 3px 8px
  window-active:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.accent}"
    typography: "{typography.ui}"
    rounded: "{rounded.sm}"
    padding: 3px 9px
  pill:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.accent}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: 3px 8px
  chip:
    backgroundColor: transparent
    textColor: "{colors.text-muted}"
    typography: "{typography.ui}"
    rounded: "{rounded.sm}"
    padding: 3px 8px
  status-bar:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.text}"
    typography: "{typography.ui}"
    rounded: "{rounded.md}"
    padding: 7px 12px
  code-block:
    backgroundColor: "{colors.code-panel}"
    textColor: "{colors.text}"
    typography: "{typography.code}"
    padding: 20px 16px 14px
  code-lang-label:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.bg}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: 2px 8px
  spotlight:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.sm}"
    padding: 16px 18px
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.bg}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: 4px 8px
  button-primary-hover:
    backgroundColor: "{colors.accent-strong}"
    textColor: "{colors.bg}"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    typography: "{typography.ui}"
    rounded: "{rounded.sm}"
    padding: 8px 10px
  input-focus:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
---

## Overview

The site reads like a **tmux session rendered as a blog**. The whole page is a
window: a status bar on top (session name, window tabs, theme toggle), stacked
panes in the middle, and a second status bar at the bottom for Vim-navigation
hints. Chrome is monospace and terminal-flavored; the article body switches to a
humanist sans so long-form reading stays comfortable.

The mood is *compact, quiet, and content-first*. Panels are flat rectangles
separated by hairline borders — no cards floating on drop shadows, no gradients,
no marketing hero sections. A single teal accent does all the interactive and
brand work. Everything else is neutral. The palette is
[Catppuccin](https://catppuccin.com/) Latte in light mode and Mocha in dark
mode, so the two themes are true siblings rather than an inverted afterthought.

Guiding instinct: if an element does not carry information, it should not draw
attention. Decoration earns its place only when it clarifies structure (a left
accent rail on a code block, an uppercase label on a pane).

## Colors

One accent, many neutrals. The teal `accent` is the only saturated color in the
chrome and is reused everywhere a thing is interactive, active, or "ours": the
session tag, the active window tab, links, focus rings, primary buttons, and
list bullets. `accent-strong` is its hover/pressed shade.

The neutral ramp climbs `bg → surface → surface-2`, each step slightly darker in
light mode and slightly lighter in dark mode, giving chrome a subtle sense of
layering without borders alone. `text` / `text-muted` are the two ink levels;
`border` is the single hairline color.

Semantic colors are used sparingly and consistently:

- **`bold` (mauve):** in-prose `<strong>` emphasis only.
- **`flag` (amber):** warnings, dirty/unsaved markers, and CTF flag callouts.
- **`danger` (red):** destructive actions, `shell` code blocks, error banners.
- **`pill-post` / `lang-ts`:** content-type and category tags in feed metadata.

**Theme pairing.** Every `*-dark` token is the Mocha counterpart of its Latte
base and is swapped in under `:root[data-theme="dark"]` (and
`prefers-color-scheme: dark`). Contrast is preserved on both sides: teal darkens
to `#0d7278` on the light base and brightens to mint `#94e2d5` on the dark base.

**Code surfaces are a deliberate exception.** Shiki paints Catppuccin theme
backgrounds that are byte-identical to the page `bg`, so code would vanish into
the page. `code-panel` (latte crust / mocha crust) is a dedicated,
one-step-off-background surface for rendered code blocks. Separately, `code-bg`
(`#181825`) and `code-text` are an *always-dark* pair used for the admin editor
pane and for text sitting on the amber flag chip — they do not flip with the
theme.

## Typography

Three families, one foundry (Sarasa / 更纱黑体), so Latin and CJK share metrics
and the vertical rhythm never breaks across languages:

- **`Sarasa UI`** — the humanist sans for all reading: article titles, headings,
  body prose, descriptions. Everything in the `prose` region.
- **`Sarasa Term`** — the terminal monospace for UI chrome: status bars, tabs,
  chips, labels, buttons.
- **`Sarasa Fixed`** — the fixed-width monospace for code blocks and inline code.

Each family has TC / SC / J / K variants chained in the CSS `font-*` stacks;
`--font-prose-active` re-points per `:lang()` so Traditional Chinese, Simplified
Chinese, and Japanese each get correct glyph shaping. Preserve this
multilingual behavior in any change.

The scale is tight and functional. Body prose is `17px/1.78` for generous
reading; all chrome and code sit at a uniform `13px`. Headings step
`display 31 → title 25 → heading 20`, with in-article `section` (~23px) and
`subsection` (~18px) expressed relative to the prose base. The `label` role is
`13px/700` with `0.08em` tracking and is always rendered **UPPERCASE** via
`text-transform` (kickers, pane titles, subheads, table headers).

`font-variant-numeric: tabular-nums` is applied to counters, stats, timestamps,
and view counts so numbers stay aligned.

## Layout

A single centered column, `max-width: 1280px`, padded `14px 16px`. On viewports
`≥ 901px` the shell becomes a full-height flexbox: fixed top/bottom status bars
with a scrolling pane between them (the page itself never scrolls). Below
`901px` the layout collapses to normal document flow and the sidebar drops — this
`901px` breakpoint is the one structural breakpoint; keep it.

The reading column inside the pane is narrower still: `max-width: 720px`
(`900px` in wide mode), padded `30px 34px 50px`, with prose measures capped at
`~62ch` for comfortable line length.

Spacing is a compact 4-based rhythm (`xs 4 → xxl 34`). Chrome uses the small end
(`3–9px` paddings), reading uses the large end (section gaps of `22–34px`).

## Elevation & Depth

The system is **intentionally flat**. Depth comes from the neutral ramp and
`1px solid border` hairlines, not shadows. There is no ambient card elevation.

Shadows appear only for genuinely floating, transient UI:

- Modal / command-help overlay: `0 18px 60px rgba(0,0,0,0.28)` over a scrim of
  `bg` at 72% opacity.
- Vim hint labels: `0 2px 8px rgba(0,0,0,0.25)`.
- Focus/selection ring: `0 0 0 2px` (inputs) or `0 0 0 8px` (Vim selection) of
  `accent` at ~18% opacity, paired with a solid `2px` accent outline.

Structural emphasis is instead signaled by a **`3px` left accent rail** on code
blocks, the homepage spotlight, and status/editor notices.

## Shapes

Rectangles with barely-there corners. Two radii only: `sm 2px` for small
interactive atoms (chips, pills, buttons, inputs, swatches) and `md 3px` for
larger containers (status bars, cards, panels, the code language chip). Corners
above `3px` are off-brand.

Recurring shape motifs:

- **Hairline-bordered panels** (`1px solid border`), often with a colored
  `3px` left border for emphasis.
- **The language chip** on code blocks: an accent rectangle pinned to the
  top-right corner with only its bottom-left corner rounded (`3px`), echoing a
  tmux window tag.
- **Custom thin scrollbars** (`8px`, `border`-colored thumb, `accent` on hover).
- Icon avatars and skill marks are `2px`-rounded squares, never circles.

## Components

Components inherit from the tokens above; variants (hover, active) are separate
entries.

- **`session-tag`** — the tmux session name at the far left of the top bar.
  Solid `accent` block, `bg`-colored text, `700`. The strongest brand mark.
- **`window-active` / window (inactive)** — window tabs. Active tab gets a
  `surface` fill and `accent` text; inactive tabs are plain `text-muted`.
- **`pill`** — content-type / category tag in feed and article metadata:
  `surface-2` fill, `accent` text, uppercase-ish label styling. Variants recolor
  the text (`pill-post`, `danger`, category blue) rather than the fill.
- **`chip`** — top-bar controls (theme toggle, actions): transparent with a
  `border` outline that turns `accent` on hover. The `.mode` variant fills with
  `accent` when active.
- **`status-bar`** — top and bottom bars: `surface-2` fill, hairline border,
  `md`-rounded outer corners only.
- **`code-block`** — `code-panel` surface, `text` ink, `3px` left accent rail,
  `code` typography, horizontal scroll. Shiki token colors are kept for syntax;
  only the block/background is themed.
- **`code-lang-label`** — the language chip: `accent` fill, `bg` text, pinned
  top-right, bottom-left corner rounded. `flag` and `shell` blocks recolor it to
  amber and red respectively.
- **`spotlight`** — the homepage featured-article panel: `surface` fill with the
  `3px` accent rail and an uppercase kicker.
- **`button-primary` / `button-primary-hover`** — primary actions (e.g. comment
  submit): `accent` fill, `bg` text, `700`; hover deepens to `accent-strong`.
- **`input` / `input-focus`** — text fields and textareas: `surface`/`bg` fill,
  hairline border that turns `accent` on focus with a soft `accent` glow ring.

## Do's and Don'ts

**Do**

- Reuse an existing CSS custom property before inventing a color; the ramp is
  deliberate and small.
- Keep `accent` as the *only* saturated chrome color; let semantic colors
  (`flag`, `danger`, `bold`) mean exactly one thing each.
- Match new tmux-style tags to the `session` / `window-active` pattern.
- Preserve `data-vim-target` / `data-vim-open` hooks and existing accessibility
  attributes on interactive elements.
- Keep both themes in lockstep — add a `*-dark` value whenever you add a color.

**Don't**

- Don't add drop shadows for resting elevation, gradients, or rounded corners
  beyond `3px`.
- Don't introduce a second accent hue or a competing type family.
- Don't let code blocks share the page `bg`; they must sit on `code-panel`.
- Don't put `code-text` on `code-panel` in light mode — it is near-white and
  meant only for the always-dark editor pane; use `text` on `code-panel`.
- Don't move the `901px` shell/sidebar breakpoint or add marketing-style
  sections; the site stays compact and content-first.
