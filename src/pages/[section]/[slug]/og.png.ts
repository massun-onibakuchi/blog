// src/pages/[section]/[slug]/og.png.ts — build-time OG card generation.
// Why here, not a component: this renders a real PNG (satori -> SVG -> resvg),
// one per published article, at /publications/<slug>/og.png and
// /posts/<slug>/og.png. Bare-minimal design per end-state §5 and §6: solid dark
// background, title, site name — no gradients, logos, or borders.
//
// Articles route through getSection (never getCollection) so `isPublished: false`
// never leaks into the build, matching every other route in this codebase.
// Articles with a frontmatter `ogImage` are skipped entirely: that override wins
// and no card is generated for them (see src/lib/og.ts).
//
// The title may be Japanese or English (end-state §3), so the embedded font
// must cover CJK — a Latin-only font renders tofu boxes for Japanese titles.
// We vendor Noto Sans CJK JP (static OTF, covers Japanese + Latin) into
// assets/fonts/ and load it with node:fs, since satori cannot read woff2 and
// this is a build-time (not client) asset. NB: the Google Fonts variable
// instance of Noto Sans JP crashes satori's bundled opentype.js parser on its
// `fvar` table, hence the static (non-variable) OTF here instead.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { getSection, type Article, type Section } from '../../../lib/articles';
import { SITE } from '../../../site';

export const prerender = true;

const WIDTH = 1200;
const HEIGHT = 630;

// Resolved from the build's working directory (astro build/dev always run from
// the project root), not from import.meta.url: this file is bundled into
// dist/.prerender/chunks/ at build time, so a path relative to the module's own
// on-disk location would point at the wrong directory after bundling.
const FONT_PATH = join(process.cwd(), 'assets/fonts/NotoSansJP-Regular.otf');
const fontData = readFileSync(FONT_PATH);

const BG = '#0b0b0c';
const FG = '#f5f5f5';
const MUTED = '#9a9a9a';

const TITLE_FONT_SIZE = 64;
const TITLE_LINE_HEIGHT = 1.3;
const TITLE_MAX_LINES = 4;
// Belt-and-suspenders clamp: satori's WebkitLineClamp only approximates the
// line count from box height, so a title that lands mid-line can still poke a
// sliver of a 5th line past the clamp. A hard maxHeight guarantees it never
// touches the site name below it.
const TITLE_MAX_HEIGHT = TITLE_FONT_SIZE * TITLE_LINE_HEIGHT * TITLE_MAX_LINES;

/** Build the satori element tree for one card. Plain object nodes (satori's
 *  JSX-like shape) so this stays a .ts file with no React/JSX dependency. */
function cardTree(title: string, siteName: string) {
  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        width: `${WIDTH}px`,
        height: `${HEIGHT}px`,
        padding: '80px',
        backgroundColor: BG,
        fontFamily: 'Noto Sans JP',
      },
      children: [
        {
          type: 'div',
          props: {
            style: {
              display: '-webkit-box',
              WebkitBoxOrient: 'vertical',
              WebkitLineClamp: TITLE_MAX_LINES,
              maxHeight: `${TITLE_MAX_HEIGHT}px`,
              overflow: 'hidden',
              color: FG,
              fontSize: `${TITLE_FONT_SIZE}px`,
              // Only a Regular weight is vendored (see font comment above), so
              // fontWeight is left at the font's own default rather than
              // requesting a 700 that satori has no glyphs to render.
              lineHeight: TITLE_LINE_HEIGHT,
            },
            children: title,
          },
        },
        {
          type: 'div',
          props: {
            style: {
              color: MUTED,
              fontSize: '32px',
            },
            children: siteName,
          },
        },
      ],
    },
  };
}

async function renderOgPng(title: string): Promise<Buffer> {
  const svg = await satori(cardTree(title, SITE.name) as never, {
    width: WIDTH,
    height: HEIGHT,
    fonts: [{ name: 'Noto Sans JP', data: fontData, weight: 400, style: 'normal' }],
  });
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: WIDTH } });
  return resvg.render().asPng();
}

export async function getStaticPaths() {
  const sections: Section[] = ['publications', 'posts'];
  const lists = await Promise.all(sections.map(getSection));
  return lists
    .flat()
    .filter((article) => !article.data.ogImage) // frontmatter override wins; skip the card
    .map((article) => ({
      params: { section: article.section, slug: article.id },
      props: { article },
    }));
}

export async function GET({ props }: { props: { article: Article } }) {
  const png = await renderOgPng(props.article.data.title);
  return new Response(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
