// @ts-check
// astro.config.mjs — the markdown pipeline is the product here (end-state §4).
// Expressive Code covers filename labels, line highlighting and the copy button;
// the remark/rehype chain covers math, anchors and callouts. Nothing ships a
// client framework: the only client JS is the theme toggle and the copy button.

import { defineConfig } from 'astro/config';
import expressiveCode from 'astro-expressive-code';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import { rehypeGithubAlerts } from 'rehype-github-alerts';

export default defineConfig({
  site: process.env.SITE_URL ?? 'http://localhost:4321',
  trailingSlash: 'always',
  integrations: [
    expressiveCode({
      // Both themes are emitted at once and swapped by the [data-theme] attribute,
      // so code blocks follow the toggle instantly and stay AA-legible in both.
      themes: ['github-light', 'github-dark'],
      themeCssSelector: (theme) => `[data-theme='${theme.type}']`,
      useDarkModeMediaQuery: false,
      styleOverrides: {
        borderRadius: '0',
        borderWidth: '1px',
        codeFontSize: '0.875rem',
      },
    }),
  ],
  markdown: {
    remarkPlugins: [remarkMath],
    rehypePlugins: [
      rehypeKatex,
      rehypeSlug,
      [rehypeAutolinkHeadings, { behavior: 'wrap' }],
      rehypeGithubAlerts,
    ],
  },
});
