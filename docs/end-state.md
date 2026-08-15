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
Header links to X (<https://x.com/0xbakuchi>) and GitHub
(<https://github.com/massun-onibakuchi>). The earlier blog at mirror.xyz is
reachable through an externally-hosted entry in the Posts list (§2, "Writing
hosted elsewhere"), not linked from the home page directly.

## 2. Site structure

Four sections.

There is no `/about` page: the bio lives on `/` and stays short (3–5 lines).
X and GitHub are always reachable from the header, so a separate About page
would add nothing.

| Path                     | Content                                                       |
| ------------------------ | ------------------------------------------------------------- |
| `/`                      | Avatar, name, short bio. Sections are reached via the header nav |
| `/publications`          | List of publications                                           |
| `/publications/<slug>`   | Publication article                                            |
| `/posts`                 | List of posts                                                  |
| `/posts/<slug>`          | Post article                                                   |
| `/open-source`           | Flat list of public work. No detail pages                      |
| `/achievements`          | Hackathon wins, bounties and other results. No detail pages    |
| `/tags/<tag>`            | All articles carrying that tag                                 |

URLs are permanent. No dates in URLs.

List entries carry title, date, and tags only — no excerpt, no thumbnail.

**Every link that leaves the site opens in a new tab** — header social links, the
external entries in the lists, the translation button, and links inside article
bodies. Internal navigation stays in the current tab.

### Navigation

Minimal header, present on every page: the `bakuchi` wordmark linking to `/`,
links to the four sections, and — in the top-right corner — X, GitHub and the
theme toggle. No footer navigation beyond a copyright line.

### Publications vs Posts

Split by **degree of finish**, not length or topic:

- **Publication** — written to be read by others; revised. Research, analysis, design write-ups.
- **Post** — unrevised working log, learning note, progress update.

### Open Source and Achievement entries

Data only: title, 1–2 line description, external link, year (achievement entries
also credit team-mates). Security research — exploit reproductions, vulnerability
collections, security challenges — sits in the Open Source list rather than a
section of its own. Deeper commentary lives in a Publication that links to the entry.

Both lists appear in the **author's chosen order**, set by the author. They are
curated, not chronological, so nothing sorts them by year. Curation also decides
membership: a repository may be dropped from the list without being deleted or
archived, and the list is not expected to mirror the GitHub profile.

Descriptions state what the thing is. They do not carry figures that decay —
assets under management, star counts, user numbers — because §1 forbids content
that needs ongoing curation to avoid looking stale.

### Writing hosted elsewhere

Earlier articles live on Qiita, Medium, HackMD and mirror.xyz. They appear in the
Publications list by title, marked as leaving the site, and link straight out — no
copy of the text is kept here and no local page is built for them. Their date is
optional, because some originals show none; undated entries sort to the bottom.
An article hosted here always has a date.

Where the original is datable only to the month, the entry carries that month
rather than a guessed day: it is recorded as the first of the month, marked
`datePrecision: month`, and displayed as `YYYY-MM`. Sorting is unaffected.

## 3. Language

Articles are written in **either Japanese or English, per article** — never both.

- Lists mix languages in one chronological stream, with no language marking.
- No language filter, no locale routing, no auto-detection, no translated duplicates.
- Readers cross the language gap via the translation button (§4), whose label
  already names the language it offers — no separate lang badge is shown.

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

Bare minimal, in the manner of <https://vitalik.eth.limo/>: one column, plain
background, unstyled-looking links, no cards, borders, shadows, or hero areas.
Body face is a readable default at ~65–75 character measure. Code and figures are the only visual interest.

Dark / light toggle. Switching plays a circular reveal expanding from the click
point, degrading to a plain switch where unsupported. Both themes are
first-class — neither is an afterthought.

Responsive: desktop and mobile, including in-app browsers.

## 6. Authoring and publishing

- Articles are Markdown files in this repository; pushing to `main` publishes them.
- No CMS, no admin UI, no external content service.
- Every article carries structured frontmatter, validated at build time:

  ```yaml
  ---
  title:
  date: '2025-12-14' # required, except for externally hosted entries
  datePrecision: day # day | month — month shows YYYY-MM (see §2)
  isPublished: true
  lang: en # en | ja — drives the badge and the translation button's target
  tags: []
  ogImage: # optional; overrides the generated card
  externalUrl: # optional; the text lives elsewhere, so the list links straight out
  ---
  ```

  `isPublished: false` excludes the article from the build entirely. The slug
  comes from the filename, and the section from the directory the file sits in.
- **OGP image**: per-article override allowed; otherwise auto-generated at build
  time as a solid-background card carrying the title (falling back to the site name).
- No analytics of any kind.
- Hosted on a free subdomain to start; a custom domain is a later option, so
  nothing may hard-code the origin.

## 7. Definition of done (v1)

Content present at launch:

- Bio written on `/`
- Open Source list populated
- At least **one** Publication
- Posts may be empty

Quality gates, all measured before release:

1. WCAG AA contrast for body text, code, and links in **both** themes.
2. Playwright e2e coverage (agent-browser / computer use acceptable) over the
   core reading paths, desktop and mobile viewports.
3. Final visual confirmation by the author.

## 8. Explicit non-goals (v1)

Mermaid · RSS/Atom · comments · newsletter · full-text search ·
analytics · custom domain · bilingual duplicates of any article · table of contents ·
reading time · share buttons · per-project OSS detail pages · X in-app browser toast.

RSS is the cheapest addition later; the content model should not make it expensive.

## 9. Deferred to v2

Intended, but out of scope until v1 ships:

- **Mermaid diagrams** in article bodies.
- **X in-app browser toast** — when the user agent identifies an X in-app browser
  (e.g. contains `Twitter for iPhone`), a small toast fades in **once**, near the
  end of reading (~70–80% scroll), asking for a Like. Text only — no link, no
  button. Dismissed by timeout; suppressed on repeat visits to the same article.
  Never shown in ordinary browsers. Credit: catnose99.
