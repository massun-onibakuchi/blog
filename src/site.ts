// src/site.ts — single source of truth for identity and origin.
// Why: the end-state doc forbids hard-coding the origin anywhere else, so the
// deploy target can change (workers.dev today, custom domain later) by editing
// one env var. Everything else imports from here.

export const SITE = {
  /** Display name: header wordmark and <title> suffix. */
  name: 'bakuchi',
  /** 3-5 line bio shown on the home page. Kept short by design. */
  bio: [
    'Engineer. I write about the systems I build and take apart —',
    'protocol design, performance work, and whatever I am currently learning.',
  ].join(' '),
  /** Absolute origin, no trailing slash. Overridden in CI via SITE_URL. */
  url: (import.meta.env.SITE_URL ?? 'http://localhost:4321').replace(/\/$/, ''),
  links: {
    github: 'https://github.com/massun-onibakuchi',
    // x: 'https://x.com/...',  // withheld for now; the header renders links it has
  },
} as const;

/** Sections that appear in the header, in order. */
export const SECTIONS = [
  { href: '/publications', label: 'Publications' },
  { href: '/open-source', label: 'Open Source' },
  { href: '/posts', label: 'Posts' },
] as const;
