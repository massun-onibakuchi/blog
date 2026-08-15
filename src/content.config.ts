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
  // Set when the writing lives elsewhere (Qiita, Medium, HackMD). The entry then
  // appears in the list with its title and date, linking straight out — no local
  // page is built, because there is no local text to show.
  externalUrl: z.string().url().optional(),
});

const publications = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/publications' }),
  schema: article,
});

const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: article,
});

// The three list sections below are data only — no detail pages, per end-state §2.
const listEntry = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  url: z.string().url(),
  year: z.number().int(),
  // Display position. These lists are curated, not chronological — the order is
  // the author's, carried over from the previous site — and the file loader does
  // not preserve array order on its own.
  order: z.number().int(),
});

const openSource = defineCollection({
  loader: file('./src/content/open-source.json'),
  schema: listEntry,
});

const hackathons = defineCollection({
  loader: file('./src/content/hackathons.json'),
  schema: listEntry.extend({
    /** Team-mates, where the work was not solo. */
    with: z.array(z.string()).default([]),
  }),
});

export const collections = { publications, posts, openSource, hackathons };
