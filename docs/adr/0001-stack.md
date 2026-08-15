# 0001 — Static stack: Astro, Expressive Code, Cloudflare

Date: 2026-08-15
Status: Accepted

## Context

`docs/end-state.md` fixes the product: a bare-minimal static blog whose value is
the writing — validated Markdown frontmatter, first-class code and math, two
themes, bilingual articles, no analytics, no comments, no client framework. The
stack had to serve that and nothing more.

## Decision

- **Astro 7** as the site generator. Content collections give the frontmatter
  contract (§6) build-time validation via Zod, and directory/filename map onto
  section/slug exactly as the doc specifies. Zero JS ships by default, which is
  the doc's stance rather than a discipline we would have to enforce.
- **Expressive Code** for code blocks. Filename labels, line highlighting and the
  copy button are the specified feature set; hand-rolling them over raw Shiki is
  days of rehype plumbing. Both themes are emitted at once and swapped by the
  `[data-theme]` attribute so code follows the toggle.
- **remark-math + rehype-katex**, rendered at build time. KaTeX's stylesheet and
  fonts are vendored under `public/katex/` (woff2 only) and linked only on pages
  whose source contains math, since they weigh ~320KB.
- **satori + @resvg/resvg-js** for OG cards at build time, with a Japanese-capable
  font — a Latin-only font renders Japanese titles as tofu, and the site is
  explicitly bilingual.
- **Cloudflare** for hosting over GitHub Pages. Project pages on GitHub live under
  a `/repo/` base path, which infects every internal link and is painful to undo
  when a custom domain arrives. Cloudflare serves at the root of a free
  subdomain, and the origin exists in exactly one place (`SITE_URL`).
- **Playwright + @axe-core/playwright** for the UI tests and the WCAG AA contrast
  gate, run over both themes because the doc treats neither as secondary.

No CSS framework: a single hand-written stylesheet matches the visual stance
better than utility classes, and the whole site's CSS is smaller than a framework's
config would be.

## Consequences

- Tag routes use the normalized tag as the route key, not an ASCII slug, because
  slugifiers collapse Japanese tags to an empty string and URLs are permanent.
- Every article read goes through `src/lib/articles.ts`, so `isPublished: false`
  cannot leak into listings, tag pages, prev/next chains or generated cards.
- The theme reveal depends on the View Transitions API and falls back to a plain
  swap in browsers without it and under `prefers-reduced-motion`.
- Mermaid is deferred to v2 (end-state §9); adding it later means one more
  build-time plugin, not a stack change.
