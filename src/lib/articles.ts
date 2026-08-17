// src/lib/articles.ts — the only place articles are loaded.
// Why funnel every read through here: `isPublished: false` must vanish from the
// build entirely (lists, article routes, tag pages, prev/next, OG endpoints).
// Filtering at each call site is how drafts leak, so call sites don't get the choice.

import { getCollection, type CollectionEntry } from 'astro:content';

export type Section = 'publications' | 'posts';
export type Article = CollectionEntry<Section> & { section: Section };

// Some experiment notes were published on the same calendar day but have a real
// dependency order. Keep that order explicit instead of depending on loader order.
const sameDaySequence = new Map<string, number>([
  ['splendor-first-self-play-generation', 1],
  ['splendor-multigeneration-optimization-ablation', 2],
  ['splendor-search-amplification', 3],
]);

// Undated entries exist only for externally hosted writing whose original shows
// no date; they sit below everything dated rather than jumping to the top.
const byNewest = (a: Article, b: Article) => {
  const dateDifference =
    (b.data.date?.getTime() ?? -Infinity) - (a.data.date?.getTime() ?? -Infinity);
  if (dateDifference !== 0) return dateDifference;
  return (sameDaySequence.get(b.id) ?? 0) - (sameDaySequence.get(a.id) ?? 0);
};

/** Published entries of one section, newest first. */
export async function getSection(section: Section): Promise<Article[]> {
  const entries = await getCollection(section, ({ data }) => data.isPublished);
  return entries.map((entry) => ({ ...entry, section })).sort(byNewest);
}

/** Every published article across sections, newest first. */
export async function getAllArticles(): Promise<Article[]> {
  const sections = await Promise.all((['publications', 'posts'] as const).map(getSection));
  return sections.flat().sort(byNewest);
}

/**
 * Neighbours within the same section, in reading order (newer first in the list,
 * so "previous" means the older article the reader has not seen yet).
 */
export function neighbours(list: Article[], id: string) {
  const i = list.findIndex((a) => a.id === id);
  return {
    newer: i > 0 ? list[i - 1] : undefined,
    older: i >= 0 && i < list.length - 1 ? list[i + 1] : undefined,
  };
}

/**
 * Tag routing key. Japanese tags must survive: ASCII slugifiers collapse them to
 * an empty string and every Japanese tag then collides on one route. We only
 * normalize Unicode form and case, and let the browser percent-encode the rest.
 */
export const tagKey = (tag: string) => tag.normalize('NFC').toLowerCase();

/** All tags in use, with their published article counts, alphabetical. */
export async function getTags(): Promise<{ tag: string; count: number }[]> {
  const articles = await getAllArticles();
  const seen = new Map<string, { tag: string; count: number }>();
  for (const article of articles) {
    for (const tag of article.data.tags) {
      const key = tagKey(tag);
      const hit = seen.get(key);
      if (hit) hit.count += 1;
      else seen.set(key, { tag, count: 1 });
    }
  }
  return [...seen.values()].sort((a, b) => a.tag.localeCompare(b.tag));
}

/** Entries whose text lives elsewhere have no local page — the list links out. */
export const isExternal = (article: Article) => Boolean(article.data.externalUrl);

/** Only the entries that get a page of their own here. */
export const localOnly = (articles: Article[]) => articles.filter((a) => !isExternal(a));

export const href = (article: Article) =>
  article.data.externalUrl ?? `/${article.section}/${article.id}/`;

/**
 * Does the source contain math? KaTeX's stylesheet plus fonts is ~320KB, so it
 * is linked only on pages that actually need it. remark-math's delimiters are
 * `$...$` and `$$...$$`.
 */
export const hasMath = (body = '') => /\$\$[\s\S]+?\$\$|\$[^$\n]+\$/.test(body);

/** YYYY-MM-DD, or YYYY-MM where only the month is known. */
export const formatDate = (date: Date, precision: 'day' | 'month' = 'day') => {
  const iso = new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC' }).format(date);
  return precision === 'month' ? iso.slice(0, 7) : iso;
};

/** `datetime` attribute matching what `formatDate` shows — both are valid HTML. */
export const dateAttr = (date: Date, precision: 'day' | 'month' = 'day') =>
  precision === 'month' ? formatDate(date, 'month') : date.toISOString();
