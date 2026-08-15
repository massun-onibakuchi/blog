# Fonts

`NotoSansJP-Regular.otf` is used **only at build time**, by satori, to draw OG
cards. It never reaches a browser, so its size costs repository weight and build
time, not page weight.

It is a subset of Noto Sans CJK JP Regular (`notofonts/noto-cjk`, 16MB). The
variable `NotoSansJP[wght].ttf` from Google Fonts cannot be used: satori's
bundled opentype.js fails to parse its `fvar` table.

Regenerate the subset with:

```sh
uv tool run --from fonttools pyftsubset NotoSansCJKjp-Regular.otf \
  --output-file=NotoSansJP-Regular.otf \
  --unicodes="U+0020-007E,U+00A0-00FF,U+2000-206F,U+2190-21FF,U+2200-22FF,U+3000-30FF,U+31F0-31FF,U+4E00-9FFF,U+FF00-FFEF,U+FE30-FE4F" \
  --layout-features="" --no-hinting --desubroutinize
```

The kanji range is kept whole (`U+4E00-9FFF`) rather than trimmed to common
kanji: a title containing one rare character would otherwise render as tofu, and
that failure would only show up after the post is shared.
