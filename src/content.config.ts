// src/content.config.ts — the frontmatter contract from docs/end-state.md §6.
// Why validate here: a missing lang or a malformed date must fail the build, not
// surface as a broken page. Directory decides the section; filename decides the slug.

import { defineCollection, z } from 'astro:content';
import { glob, file } from 'astro/loaders';

const article = z.object({
  title: z.string(),
  date: z.coerce.date(),
  isPublished: z.boolean(),
  lang: z.enum(['en', 'ja']),
  tags: z.array(z.string()).default([]),
  // Path under /public, e.g. '/og/my-post.png'. Omit to use the generated card.
  ogImage: z.string().optional(),
});

const publications = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/publications' }),
  schema: article,
});

const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: article,
});

// Data only — no detail pages, per end-state §2.
const openSource = defineCollection({
  loader: file('./src/content/open-source.json'),
  schema: z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    url: z.string().url(),
    year: z.number().int(),
  }),
});

export const collections = { publications, posts, openSource };
