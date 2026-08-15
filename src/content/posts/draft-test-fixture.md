---
title: 'Draft Fixture (isPublished false, test-only)'
date: '2025-01-01'
isPublished: false
lang: en
tags: ['draft-fixture-tag']
---

This entry exists only for tests/drafts.spec.ts (see the UI test suite). It has
`isPublished: false` and must therefore 404 on its own URL and be absent from
every list, its own tag page, and the sitemap. Safe to delete once a real draft
exists in the content set — repoint the constants at the top of
tests/drafts.spec.ts if so.
