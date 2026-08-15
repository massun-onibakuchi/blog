// src/lib/og.ts — resolves the OG image URL for an article page's <head>.
// Why a helper: the frontmatter `ogImage` override must always win over the
// generated card (end-state §6), and every article page needs the same rule.
// The result is origin-free (root-relative) so BaseLayout can resolve it
// against Astro.site without this file knowing the deploy origin.

import type { Article } from './articles';

/** Root-relative OG image path for `article`: the frontmatter override, or the
 *  build-time generated card at `/<section>/<slug>/og.png`. */
export function ogImageUrl(article: Article): string {
  if (article.data.ogImage) return article.data.ogImage;
  return `/${article.section}/${article.id}/og.png`;
}
