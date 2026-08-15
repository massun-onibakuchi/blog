// src/lib/lists.ts — loading for the curated data sections (Open Source and
// Hackathons). They share a shape and, more importantly, a rule:
// entries appear in the author's chosen order, never sorted by year.

import { getCollection } from 'astro:content';

type ListCollection = 'openSource' | 'hackathons';

export async function getList(name: ListCollection) {
  const entries = await getCollection(name);
  return entries.map((entry) => entry.data).sort((a, b) => a.order - b.order);
}
