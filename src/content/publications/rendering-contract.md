---
title: 'The rendering contract of this site'
date: '2026-08-15'
isPublished: false
lang: en
tags: ['meta', 'astro']
---

This is the reference article for everything the site can render. It exists so
that a change to the Markdown pipeline has something to break loudly, and so a
reader can see the whole vocabulary in one place. Replace it with real work when
there is real work to show.

## Code

Code blocks carry a filename, highlight the lines that matter, and can be copied
with one click.

```ts title="src/lib/articles.ts" {3-4}
export async function getSection(section: Section): Promise<Article[]> {
  const entries = await getCollection(section, ({ data }) => data.isPublished);
  // Drafts are filtered here and nowhere else, so they cannot leak into
  // listings, tag pages, prev/next chains or generated cards.
  return entries.map((entry) => ({ ...entry, section })).sort(byNewest);
}
```

Inline `code` sits in running text without breaking the line rhythm.

## Math

Inline math such as $O(n \log n)$ renders alongside display math:

$$
\sum_{i=1}^{n} \frac{1}{i^2} \xrightarrow{n \to \infty} \frac{\pi^2}{6}
$$

## Callouts

> [!NOTE]
> Callouts use GitHub's alert syntax, so the same source renders in a README.

> [!WARNING]
> They are for asides that a reader can skip without losing the argument.

## Tables, lists, footnotes

| Section      | Standard                       | Revised |
| ------------ | ------------------------------ | ------- |
| Publications | written to be read by others   | yes     |
| Posts        | working log, learning note     | no      |

- [x] Frontmatter validated at build time
- [x] Tags route without slugifying[^1]
- [ ] Mermaid diagrams — deliberately out of scope for v1

[^1]: ASCII slugifiers map Japanese tags to an empty string, which collapses
every Japanese tag onto one route. The raw tag is the route key instead.
