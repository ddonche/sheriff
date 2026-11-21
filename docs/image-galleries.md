# Image galleries

Implemented locally on 2026-11-18 in Markdown Core and all three built-in themes.
Matching Cloud source is prepared; deployment is pending.

Ordinary left-aligned images float so text can wrap beside them. Several floats
interleaved with paragraphs can form a staircase and squeeze subsequent headings.
Use an explicit gallery when images and their explanations should stay together:

```text
::: gallery 3
[[image:map_big.png|full|center|Fig. B]]

The smooth map.

[[image:map_border.png|full|center|Fig. C]]

The same map with a border.

[[image:map_blocky.png|full|center|Fig. D]]

Smoothing disabled.
:::
```

Write each image on its own line. Text after an image belongs to its gallery item
until the next image. Captions keep their existing syntax; explanations support
ordinary Markdown and wikilinks. Content following the closing fence starts below
the whole gallery. A gallery can contain more images than columns, creating rows.

Use `gallery 2`, `gallery 3`, or `gallery 4`. Images fill their cells while retaining
their aspect ratios. Within the gallery, the grid controls width and placement,
so individual `left`, `right`, or image-size settings do not float items out of
their cells. Ordinary images elsewhere retain their current behavior. Existing
click-to-enlarge behavior is retained.

The four-column layout reduces to two in narrower containers; narrow containers
and phones stack the items. The figures and captions inherit each theme's existing
image styling. Two-, three-, and four-column layouts, light/dark themes, mobile
stacking, following headings, code examples, and ordinary floats are verified.

For now, author this block in Source. Visual preserves it as one protected source
block and round-trips it without changing the text; a dedicated visual gallery
editor is future work. After updating the application, build the portal once to
copy its updated theme CSS along with rendering the gallery.
