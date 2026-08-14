# End State

Intended end-state of the personal blog. Scope-defining only: what the delivered
system must be, not how to build it. 

## 1. Purpose

The site exists to function as **evidence of technical ability**.
Primary reader: **a fellow engineer** who judges by the substance of the writing.

Consequences that constrain everything below:

- Depth of content outranks reach, decoration, and engagement mechanics.
- Reading and code/math rendering quality are load-bearing; social features are not.
- Nothing on the site may require ongoing curation to avoid looking stale.

Identity: handle **bakuchi** (header wordmark and `<title>`).
Header links to X and GitHub. _(TBD: X account URL, GitHub profile URL —
git author is `onibakuchi`.)_

## 2. Site structure

Four sections. `Showcases` from the original spec is **out of scope for v1**.

| Path                     | Content                                                       |
| ------------------------ | ------------------------------------------------------------- |
| `/`                      | Short bio + latest excerpts from every section, each linking out |
| `/about`                 | 3–5 line bio + X / GitHub links. Nothing else                  |
| `/publications`          | List of publications                                           |
| `/publications/<slug>`   | Publication article                                            |
| `/posts`                 | List of posts                                                  |
| `/posts/<slug>`          | Post article                                                   |
| `/open-source`           | Flat list of OSS entries. No detail pages                      |
| `/tags/<tag>`            | All articles carrying that tag                                 |

URLs are permanent. No dates in URLs.

### Navigation

Minimal header, present on every page: the `bakuchi` wordmark linking to `/`,
links to the four sections, and — in the top-right corner — X, GitHub, and the
theme toggle. No footer navigation beyond a copyright line.

### Publications vs Posts

Split by **degree of finish**, not length or topic:

- **Publication** — written to be read by others; revised. Research, analysis, design write-ups.
- **Post** — unrevised working log, learning note, progress update.

### Open Source entries

Data only: title, 1–2 line description, external link (GitHub), year.
Deeper commentary lives in a Publication that the entry links to.

## 3. Language

Articles are written in **either Japanese or English, per article** — never both.

- Lists mix languages in one chronological stream; each entry carries a `JA` / `EN` badge.
- No language filter, no locale routing, no auto-detection, no translated duplicates.
- Readers cross the language gap via the translation button (§4).

## 4. Article page

Contains exactly:

- Title, published date, tags (tags link to `/tags/<tag>`)
- **Translation button** — opens ChatGPT in a new tab with a prefilled prompt
  containing an instruction plus the article's public URL. The target language is
  the opposite of the article's own language.
- Article body
- Previous / next links within the same section

Deliberately absent: table of contents, reading time, share buttons, comments,
RSS/Atom, newsletter.

### Rendering capabilities (v1)

- **Code blocks**: syntax highlighting, filename label, line highlighting, copy button
- **Markdown extensions**: tables, footnotes, callouts, task lists, blockquotes,
  automatic heading anchors
- **Math**: inline and block LaTeX

Deferred to v2: Mermaid diagrams.

## 5. Appearance

Typographic and quiet: readable body face, ~65–75 character measure, generous
whitespace, a single accent color. Code and diagrams are the visual interest.

Dark / light toggle. Switching plays a circular reveal expanding from the click
point, degrading to a plain switch where unsupported. Both themes are
first-class — neither is an afterthought.

Responsive: desktop and mobile, including in-app browsers.

## 6. Authoring and publishing

- Articles are Markdown files in this repository; pushing to `main` publishes them.
- No CMS, no admin UI, no external content service.
- **OGP image**: per-article override allowed; otherwise auto-generated at build
  time as a solid-background card carrying the title (falling back to the site name).
- No analytics of any kind.
- Hosted on a free subdomain to start; a custom domain is a later option, so
  nothing may hard-code the origin.

## 7. Definition of done (v1)

Content present at launch:

- About page filled in
- Open Source list populated
- At least **one** Publication
- Posts may be empty

Quality gates, all measured before release:

1. WCAG AA contrast for body text, code, and links in **both** themes.
2. Playwright e2e coverage (agent-browser / computer use acceptable) over the
   core reading paths, desktop and mobile viewports.
3. Final visual confirmation by the author.

## 8. Explicit non-goals (v1)

Showcases section · Mermaid · RSS/Atom · comments · newsletter · full-text search ·
analytics · custom domain · bilingual duplicates of any article · table of contents ·
reading time · share buttons · per-project OSS detail pages · X in-app browser toast.

RSS and Showcases are the cheapest additions later; the content model should not
make them expensive.

## 9. Deferred to v2

Intended, but out of scope until v1 ships:

- **Showcases** — hackathons, bounties, and other accomplishments, as a list
  section in the same shape as Open Source.
- **Mermaid diagrams** in article bodies.
- **X in-app browser toast** — when the user agent identifies an X in-app browser
  (e.g. contains `Twitter for iPhone`), a small toast fades in **once**, near the
  end of reading (~70–80% scroll), asking for a Like. Text only — no link, no
  button. Dismissed by timeout; suppressed on repeat visits to the same article.
  Never shown in ordinary browsers. Credit: catnose99.
