# blog

A static personal blog. What it is meant to be, and what is deliberately left
out, is written down in [`docs/end-state.md`](docs/end-state.md); the stack
rationale is in [`docs/adr/0001-stack.md`](docs/adr/0001-stack.md).

## Writing

Articles are Markdown files. The directory decides the section, the filename
decides the slug:

```
src/content/publications/<slug>.md   →  /publications/<slug>/
src/content/posts/<slug>.md          →  /posts/<slug>/
src/content/open-source.json         →  /open-source/
```

Every article starts with frontmatter, validated at build time — a missing or
malformed field fails the build:

```yaml
---
title: 'Why the allocator was the problem'
date: '2026-08-15'
isPublished: true
lang: en # en | ja — drives the badge and the translation button
tags: ['performance']
ogImage: # optional; a card is generated when omitted
---
```

`isPublished: false` removes the article from the build entirely: no page, no
listing, no tag entry, no card.

## Commands

| Command            | Does                                            |
| ------------------ | ----------------------------------------------- |
| `pnpm dev`         | Dev server on <http://localhost:4321>           |
| `pnpm build`       | Static build into `dist/`                       |
| `pnpm preview`     | Serve the built site                            |
| `pnpm check`       | Astro + TypeScript diagnostics                  |
| `pnpm test`        | Playwright UI tests and the contrast gate       |

## Deploying

`SITE_URL` is the only place the origin exists — it is set in CI and read by
`astro.config.mjs`. Moving to a custom domain is a change to that variable and
DNS, nothing in the code.
