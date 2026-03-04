^^^^
title: Glossary Tooltips
author: Sheriff Docs
layout: docs
meta_kind: tutorial
meta_type: docs
summary: Add instant hover explanations to wikilinks using the `gloss` frontmatter field.
gloss: You can add definitions or one-line overviews to articles. People can view them by hovering links.
^^^^

Glossary tooltips allow Sheriff pages to show **instant explanations when hovering over a link**.

Instead of forcing readers to open a new page just to understand a term, Sheriff displays a short definition directly in the interface.

This page always shows:

* The **exact Markdown you type**
* The **rendered result**

So you never have to guess.

---

## The Smallest Possible Tooltip

Glossary tooltips come from the **`gloss` field in frontmatter**.

If a page defines `gloss`, any wikilink pointing to that page will show the tooltip.

What you write

```md
^^^^
title: Glossary Tooltips
author: Sheriff Docs
layout: docs
meta_kind: tutorial
meta_type: docs
summary: Add instant hover explanations to wikilinks using the `gloss` frontmatter field.
gloss: You can add definitions or one-line overviews to articles. People can view them by hovering links.
^^^^
```

Then link to it:

```md
You can add [[footnotes]] to articles to produce references and citations, footnotes, and more.
```

What it renders

You can add [[footnotes]] to articles to produce references and citations, footnotes, and more.

Hover the link to see the glossary explanation.

---

## How Tooltips Work

When Sheriff builds a portal, it collects metadata from each page.

If a page includes a `gloss` field, Sheriff stores it in the portal routing data.

Example route entry:

```json
{
  "slug": "capture",
  "href": "/docs/capture.html",
  "title": "Capture",
  "gloss": "Taking an enemy unit via invasion or perfect siege."
}
```

When the renderer encounters:

```md
[[capture]]
```

Sheriff attaches the glossary text to the generated link.

Hovering the link displays the tooltip.

---

## Writing Good Gloss Entries

Gloss entries should be **short and readable**.

They are meant to clarify a concept quickly, not replace the article itself.

Good:

```md
gloss: A siege formed by surrounding an enemy token from four directions.
```

Too long:

```md
gloss: A complex tactical maneuver involving coordinated unit placement that occurs when...
```

If the explanation needs multiple sentences, it belongs in the article.

---

## Why Tooltips Include a CTA

Each tooltip ends with:

```
CLICK TO VISIT FULL ARTICLE
```

This prevents readers from assuming the tooltip contains the entire explanation.

The tooltip is only a **preview**.

Clicking the link opens the full article.

---

## Common Mistakes

No `gloss` field

```md
^^^^
title: Capture
^^^^
```

If a page has no glossary definition, no tooltip will appear (it will use the summary if one is available).

---

## Gloss is too long

Bad:

```md
gloss: A maneuver in which a player surrounds the opposing token from several directions in order to...
```

Tooltips should be readable **in one glance**.

---

## Quick Copy / Paste

Add the glossary entry to your article's frontmatter section, typically below summary:

```md
^^^^
title: Title of the Page
author: Author Name
layout: docs (or whatever layout you want to use)
meta_kind: tutorial 
meta_type: docs
summary: A summary of the article.
gloss: Your tooltip entry text.
^^^^
```

Then link it anywhere:

```md
See [[example-term]] for details.
```

Hover the link to see the explanation instantly.
