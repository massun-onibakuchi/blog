// src/site.ts — single source of truth for identity and origin.
// Why: the end-state doc forbids hard-coding the origin anywhere else, so the
// deploy target can change (workers.dev today, custom domain later) by editing
// one env var. Everything else imports from here.

export const SITE = {
  /** Display name: header wordmark and <title> suffix. */
  name: 'bakuchi',
  /** Short bio shown on the home page. Carried over from the previous site. */
  bio: 'Research engineer, hunting bounties and building smart contracts, mainly focused on finance.',
  /** Absolute origin, no trailing slash. Overridden in CI via SITE_URL. */
  url: (import.meta.env.SITE_URL ?? 'http://localhost:4321').replace(/\/$/, ''),
  links: {
    github: 'https://github.com/massun-onibakuchi',
    x: 'https://x.com/0xbakuchi',
  },
} as const;

/** Sections that appear in the header, in order. */
export const SECTIONS = [
  { href: '/publications', label: 'Publications' },
  { href: '/open-source', label: 'Open Source' },
  { href: '/achievements', label: 'Achievements' },
  { href: '/posts', label: 'Posts' },
] as const;
