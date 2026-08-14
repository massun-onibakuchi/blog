# AGENTS.md

Blog for a developer

# Blog Specification

## Content

* **About:** Short bio, X and GitHub link.
* **Publications:** In-depth technical research, analysis, and write-ups.
* **Open Source Work:** Open-source projects with links to GitHub.
* **Showcases:** Hackathons, bounties, and other accomplishments.
* **Posts:** Progress updates, learnings, and everyday notes.

## Navigation & UI

* **Header:** Minimal navigation with X and GitHub links in the top-right corner.
* **Theme:** Dark / Light mode switch with smooth dynamic animation.
* **Responsive Design:** Optimized for desktop and mobile.

## Reading Experience

* **Article Pages:** Title, published date, tags, language button, and clean reading layout.
* **AI Translation:** A language button opens ChatGPT with a pre-filled prompt to translate the current article or publication.

## Content Authoring

* **Markdown / MDX:** Write posts and publications in Markdown or MDX.
* **Markdown Features:** Tables, footnotes, callouts, task lists, blockquotes, and automatic heading anchors.

## Technical Content

* **Code:** Syntax highlighting, line highlighting, filenames, and copy buttons for code blocks.
* **Diagrams:** Mermaid support for architecture diagrams, flowcharts, and sequence diagrams.
* **Math:** LaTeX math notation with inline and block equations.

## Environment

- Build command: TBD
- Test command: TBD
- CI/CD production release on merge:
- Free cloudflare workers or GitHub pages
- Frameworks:

## Design stance

- Keep a module stay single-purpose; ~800 LOC is a guideline, not a hard cap.
- Static site.

## Working agreement

- Verify external APIs usage against current docs (context7 MCP).
- For high-risk work, use at least two independent, decorrelated review lenses—different models
  or reviewer perspectives. Keep findings separate until both reviews finish, then
  reconcile material disagreements before acting.
- Split work when a non-mechanical change would exceed roughly 2,000 changed lines, or 1,000
  lines of complex logic excluding tests. Split along real dependencies, not line counts.
